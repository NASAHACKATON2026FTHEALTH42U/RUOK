"""BE-25: hash de contraseña, bloqueo tras 5 fallos y usuarios demo."""

from datetime import timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app import clock, models
from app.services import accounts
from app.services.accounts import (
    LOCK_SECONDS,
    MAX_FAILED_ATTEMPTS,
    AccountLocked,
    check_password,
    hash_secret,
    is_locked,
    seed_users,
    verify_secret,
)


@pytest.fixture
def session():
    """BD en memoria propia: no toca la BD compartida del resto de tests."""
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


@pytest.fixture
def user(session):
    u = models.UserAccount(
        username="vega",
        display_name="Cmdr. Vega",
        role="member",
        env_id="mars",
        password_hash=hash_secret("ruok-mars"),
    )
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


# --- Hash -----------------------------------------------------------------------


def test_hash_and_verify():
    h = hash_secret("ruok-mars")
    assert h.startswith("$2") and "ruok-mars" not in h
    assert verify_secret("ruok-mars", h)
    assert not verify_secret("ruok-moon", h)


def test_hash_is_salted():
    assert hash_secret("1234") != hash_secret("1234")


@pytest.mark.parametrize("bad_hash", [None, "", "not-a-bcrypt-hash"])
def test_verify_never_raises_on_bad_hash(bad_hash):
    assert verify_secret("1234", bad_hash) is False


# --- Login con contraseña ----------------------------------------------------------


def test_correct_password_resets_counter_and_sets_last_login(session, user):
    assert check_password(session, user, "wrong") is False
    assert user.failed_attempts == 1
    assert check_password(session, user, "ruok-mars") is True
    assert user.failed_attempts == 0
    assert user.last_login_at is not None


def test_inactive_user_cannot_log_in(session, user):
    user.active = False
    assert check_password(session, user, "ruok-mars") is False


# --- Bloqueo ------------------------------------------------------------------------


def test_locks_after_5_failures_for_5_minutes(session, user):
    for _ in range(MAX_FAILED_ATTEMPTS - 1):
        assert check_password(session, user, "wrong") is False
    assert not is_locked(user)

    assert check_password(session, user, "wrong") is False  # 5.º fallo
    assert is_locked(user)

    # Bloqueada: ni la contraseña correcta entra.
    with pytest.raises(AccountLocked):
        check_password(session, user, "ruok-mars")

    # A los 5 min se desbloquea (fast-forward del reloj de demo).
    clock.advance(LOCK_SECONDS)
    assert not is_locked(user)
    assert check_password(session, user, "ruok-mars") is True


def test_lock_expires_exactly_at_locked_until(session, user):
    user.locked_until = clock.now() + timedelta(seconds=10)
    assert is_locked(user)
    assert not is_locked(user, clock.now() + timedelta(seconds=10))


# --- Usuarios demo -------------------------------------------------------------------


def members():
    return [
        models.Member(id=1, env_id="mars", name="Cmdr. Vega", position="commander"),
        models.Member(id=2, env_id="mars", name="Ing. Okafor", position="engineer"),
        models.Member(id=3, env_id="iss", name="Cmdte. Vega", position="commander"),
    ]


def test_demo_users_per_environment(session):
    ms = members()
    session.add_all(ms)
    session.flush()
    created = seed_users(session, ms, demo=True)
    session.commit()

    users = {u.username: u for u in session.exec(select(models.UserAccount)).all()}
    assert created == len(users) == 3 + 6 * 4 + 1  # members + 4 roles × 6 entornos + admin

    # Members enlazados y nombres de usuario únicos.
    assert (users["vega"].member_id, users["vega"].env_id) == (1, "mars")
    assert users["vega-2"].member_id == 3  # mismo apellido en la ISS
    assert users["okafor"].role == "member"

    # Por entorno: medic, commander, responder y psych.
    for role in accounts.STAFF_ROLES:
        assert users[f"{role}-geriatric"].env_id == "geriatric"

    # Contraseña ruok-<env> y admin global (no hay PIN: solo usuario y contraseña).
    assert verify_secret("ruok-mars", users["vega"].password_hash)
    assert verify_secret("ruok-hospital", users["medic-hospital"].password_hash)
    assert not hasattr(users["vega"], "pin_hash")
    assert (users["admin"].role, users["admin"].env_id) == ("admin", None)
    assert verify_secret("ruok-admin", users["admin"].password_hash)


def test_without_demo_mode_no_known_passwords(session):
    ms = members()
    session.add_all(ms)
    session.flush()
    seed_users(session, ms, demo=False)
    session.commit()

    users = session.exec(select(models.UserAccount)).all()
    assert [u.username for u in users] == ["admin"]
    known = ["ruok-admin", "ruok-mars", "1234", "admin"]
    assert not any(verify_secret(p, users[0].password_hash) for p in known)


@pytest.mark.parametrize(
    ("value", "expected"),
    [("true", True), ("1", True), ("false", False), ("0", False), (None, True)],
)
def test_demo_mode_env_var(monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv("DEMO_MODE", raising=False)
    else:
        monkeypatch.setenv("DEMO_MODE", value)
    assert accounts.demo_mode() is expected


def test_app_seed_creates_demo_accounts(client):
    """El seed de la app (BE-07) siembra también las cuentas."""
    from app.db import engine

    with Session(engine) as s:
        vega = s.exec(select(models.UserAccount).where(models.UserAccount.username == "vega")).one()
        assert vega.member_id == 1
        assert s.exec(select(models.UserAccount).where(models.UserAccount.role == "admin")).one()
