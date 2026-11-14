"""BE-02: modelos SQLModel, restricciones e índices de docs/data-model.md."""

import datetime as dt
import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select, text

from app import clock
from app.db import init_db, make_engine
from app.models import (
    Alert,
    AlertEvent,
    AppState,
    BadgeAward,
    Device,
    EventLog,
    Kudos,
    LinkMessage,
    LinkState,
    Measurement,
    Member,
    RuokCheck,
    Task,
    TaskCompletion,
    UserAccount,
)
from app.services import app_state

EXPECTED_TABLES = {
    "user_account", "member", "measurement", "task", "task_completion", "alert",
    "alert_event", "ruok_check", "link_message", "link_state", "badge_award",
    "device", "event_log", "kudos", "app_state",
}
EXPECTED_INDEXES = {
    "ux_user_username", "ux_user_member", "ix_member_env", "ix_measurement_series",
    "ix_task_member_date", "ux_task_completion", "ix_alert_member_status",
    "ix_alert_env_delivered", "ux_alert_open_dedupe", "ix_alert_event_alert",
    "ix_ruok_member_pending", "ix_link_due", "ux_badge_award", "ix_device_user",
    "ix_event_env_id", "ix_event_type_at",
}


def uid() -> str:
    return str(uuid.uuid4())


@pytest.fixture
def engine(tmp_path):
    eng = make_engine(f"sqlite:///{tmp_path}/models.db")
    init_db(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def session(engine):
    with Session(engine) as s:
        yield s


@pytest.fixture
def member(session) -> Member:
    m = Member(env_id="mars", name="Cmdr. Vega", position="commander")
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def make_alert(member: Member, **kw) -> Alert:
    data = dict(
        id=uid(), member_id=member.id, env_id="mars", origin="auto",
        category="indicator", severity="warning", dedupe_key=f"{member.id}:cardio",
    )
    data.update(kw)
    return Alert(**data)


# ── Esquema ──────────────────────────────────────────────────────────


def test_all_tables_and_indexes_exist(engine):
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT type, name FROM sqlite_master")).all()
    tables = {name for kind, name in rows if kind == "table"}
    indexes = {name for kind, name in rows if kind == "index"}
    assert EXPECTED_TABLES <= tables
    assert EXPECTED_INDEXES <= indexes


def test_app_creates_tables_on_startup(client):
    from app.db import engine as app_engine

    with app_engine.connect() as conn:
        tables = {r[0] for r in conn.execute(text("SELECT name FROM sqlite_master"))}
    assert EXPECTED_TABLES <= tables


def test_init_db_is_idempotent(engine):
    init_db(engine)  # segunda vez: no falla ni duplica


# ── Crear y leer cada modelo ─────────────────────────────────────────


def test_create_and_read_every_model(session, member):
    now = clock.now()
    user = UserAccount(username="vega", display_name="Cmdr. Vega", role="member",
                       env_id="mars", member_id=member.id, password_hash="x")
    session.add(user)
    session.commit()
    session.refresh(user)

    task = Task(id=f"t_{now.date()}_{member.id}_measure_bp", member_id=member.id,
                date=now.date(), task_type="measure_bp", title="Tensión", points=10)
    alert = make_alert(member, indicator_ids=["heart_rate"], created_by_user_id=user.id)
    session.add_all([task, alert])
    session.commit()

    rows = [
        Device(id=uid(), user_id=user.id, kind="mobile"),
        Measurement(id=uid(), member_id=member.id, indicator_id="heart_rate",
                    value=72, unit="bpm", taken_at=now),
        TaskCompletion(id=uid(), task_id=task.id, member_id=member.id, completed_at=now),
        BadgeAward(member_id=member.id, badge_id="first_week"),
        Kudos(id=uid(), env_id="mars", from_member_id=member.id,
              to_member_id=member.id, message="¡Bien!"),
        AlertEvent(alert_id=alert.id, type="created", payload={"level": 0}),
        RuokCheck(member_id=member.id, alert_id=alert.id),
        LinkMessage(env_id="mars", direction="up", kind="alert", ref_id=alert.id,
                    payload={"a": 1}, eta=now + dt.timedelta(minutes=20)),
        LinkState(env_id="mars", state="delayed"),
        EventLog(type="alert.created", env_id="mars", member_id=member.id,
                 ref_id=alert.id, payload={"severity": "warning"}),
        AppState(key="seed_version", value={"v": 1}),
    ]
    session.add_all(rows)
    session.commit()

    for model in (Member, UserAccount, Device, Measurement, Task, TaskCompletion,
                  BadgeAward, Kudos, Alert, AlertEvent, RuokCheck, LinkMessage,
                  LinkState, EventLog, AppState):
        assert len(session.exec(select(model)).all()) == 1, model.__name__

    session.expire_all()
    got = session.get(Alert, alert.id)
    assert got.indicator_ids == ["heart_rate"]
    assert got.status == "open" and got.authenticated is True
    assert session.get(AppState, "seed_version").value == {"v": 1}
    assert session.exec(select(LinkMessage)).one().payload == {"a": 1}


# ── Restricciones ────────────────────────────────────────────────────


def test_measurement_same_id_is_not_duplicated(session, member):
    mid = uid()
    kw = dict(member_id=member.id, indicator_id="heart_rate", value=72, unit="bpm",
              taken_at=clock.now())
    session.add(Measurement(id=mid, **kw))
    session.commit()

    with Session(session.get_bind()) as other:
        other.add(Measurement(id=mid, **kw))
        with pytest.raises(IntegrityError):
            other.commit()

    assert len(session.exec(select(Measurement)).all()) == 1


def test_foreign_keys_are_enforced(session):
    session.add(Measurement(id=uid(), member_id=999, indicator_id="heart_rate",
                            value=1, unit="bpm", taken_at=clock.now()))
    with pytest.raises(IntegrityError):
        session.commit()


def test_task_completed_only_once(session, member):
    today = clock.now().date()
    task = Task(id=f"t_{today}_{member.id}_checkin", member_id=member.id, date=today,
                task_type="checkin", title="Check-in")
    session.add(task)
    session.commit()
    for _ in range(2):
        session.add(TaskCompletion(id=uid(), task_id=task.id, member_id=member.id,
                                   completed_at=clock.now()))
    with pytest.raises(IntegrityError):
        session.commit()


def test_only_one_open_alert_per_dedupe_key(session, member):
    session.add(make_alert(member, status="resolved"))
    session.add(make_alert(member))  # resuelta + abierta: OK
    session.commit()

    session.add(make_alert(member, status="escalated"))  # segunda abierta: error
    with pytest.raises(IntegrityError):
        session.commit()


def test_badge_awarded_once(session, member):
    session.add(BadgeAward(member_id=member.id, badge_id="streak_7"))
    session.add(BadgeAward(member_id=member.id, badge_id="streak_7"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_username_unique(session):
    session.add(UserAccount(username="admin", display_name="A", role="admin", password_hash="x"))
    session.add(UserAccount(username="admin", display_name="B", role="admin", password_hash="y"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_member_linked_to_one_user_at_most(session, member):
    session.add(UserAccount(username="a", display_name="A", role="member",
                            member_id=member.id, password_hash="x"))
    session.add(UserAccount(username="b", display_name="B", role="medic", password_hash="x"))
    session.add(UserAccount(username="c", display_name="C", role="medic", password_hash="x"))
    session.commit()  # varios usuarios sin member: OK

    session.add(UserAccount(username="d", display_name="D", role="member",
                            member_id=member.id, password_hash="x"))
    with pytest.raises(IntegrityError):
        session.commit()


# ── Fechas ───────────────────────────────────────────────────────────


def test_datetimes_round_trip_as_utc(session, member):
    clock.advance(3600)
    taken = dt.datetime(2026, 11, 14, 12, 0, tzinfo=dt.timezone(dt.timedelta(hours=2)))
    m = Measurement(id=uid(), member_id=member.id, indicator_id="heart_rate",
                    value=60, unit="bpm", taken_at=taken)
    session.add(m)
    session.commit()
    session.expire_all()

    got = session.get(Measurement, m.id)
    assert got.taken_at == taken
    assert got.taken_at.tzinfo == dt.UTC
    assert got.taken_at.hour == 10
    assert got.received_at.tzinfo == dt.UTC
    assert got.received_at - dt.datetime.now(dt.UTC) > dt.timedelta(minutes=59)


def test_naive_datetime_is_rejected(session, member):
    session.add(Measurement(id=uid(), member_id=member.id, indicator_id="heart_rate",
                            value=60, unit="bpm", taken_at=dt.datetime(2026, 1, 1)))
    with pytest.raises(Exception, match="zona horaria"):
        session.commit()


# ── app_state y reloj ────────────────────────────────────────────────


def test_app_state_get_set(session):
    assert app_state.get_value(session, "missing", default=5) == 5
    app_state.set_value(session, "scenario", "mars_sleep_bp")
    app_state.set_value(session, "scenario", "eva_no_contact")
    assert app_state.get_value(session, "scenario") == "eva_no_contact"


def test_clock_offset_persists(session):
    clock.advance(7200)
    app_state.save_clock(session)
    clock.reset()
    app_state.restore_clock(session)
    assert clock.get_offset() == 7200


def test_metadata_has_every_table():
    assert EXPECTED_TABLES <= set(SQLModel.metadata.tables)
