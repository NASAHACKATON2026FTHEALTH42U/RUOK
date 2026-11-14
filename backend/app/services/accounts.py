"""Cuentas de usuario: hash de contraseña/PIN, bloqueo y usuarios demo (BE-25).

Ver docs/auth-and-roles.md:

- Contraseña y PIN con **bcrypt**.
- **5 fallos seguidos → bloqueo de 5 min** (``failed_attempts``, ``locked_until``).
  El contador es común a contraseña y PIN, para que no se pueda alternar entre
  los dos y duplicar los intentos.
- Usuarios demo (contraseña ``ruok-<env>``, PIN ``1234``) **solo con
  ``DEMO_MODE=true``**. Con ``DEMO_MODE=false`` solo se crea el ``admin`` con
  una contraseña aleatoria, que se escribe una vez en el log del servidor.

Los endpoints ``/auth/*`` (login, PIN, me y JWT) son BE-26.
"""

from __future__ import annotations

import logging
import os
import re
import secrets
import unicodedata
from collections.abc import Iterable
from datetime import datetime, timedelta

import bcrypt
from sqlmodel import Session, select

from app import clock, models
from app.services import environments

__all__ = [
    "LOCK_SECONDS",
    "MAX_FAILED_ATTEMPTS",
    "AccountLocked",
    "check_password",
    "check_pin",
    "demo_mode",
    "hash_secret",
    "is_locked",
    "role_label",
    "seed_users",
    "verify_secret",
]

log = logging.getLogger(__name__)

MAX_FAILED_ATTEMPTS = 5
LOCK_SECONDS = 5 * 60
DEMO_PIN = "1234"
STAFF_ROLES = ("medic", "commander", "responder", "psych")
PIN_ROLES = {"member", "medic"}  # tablets compartidas (docs/auth-and-roles.md)


class AccountLocked(Exception):
    """La cuenta está bloqueada hasta ``locked_until``."""

    def __init__(self, locked_until: datetime):
        super().__init__(f"Cuenta bloqueada hasta {locked_until.isoformat()}")
        self.locked_until = locked_until


# ── Hash ─────────────────────────────────────────────────────────────


def _rounds() -> int:
    """Coste de bcrypt. ``RUOK_BCRYPT_ROUNDS`` permite bajarlo en los tests."""
    return int(os.environ.get("RUOK_BCRYPT_ROUNDS", "12"))


def hash_secret(secret: str) -> str:
    """Hash bcrypt (con sal) de una contraseña o un PIN."""
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt(_rounds())).decode()


def verify_secret(secret: str, hashed: str | None) -> bool:
    """True si ``secret`` corresponde al hash. Nunca lanza por un hash vacío o roto."""
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(secret.encode(), hashed.encode())
    except ValueError:  # hash con formato inválido o secreto > 72 bytes
        return False


# ── Bloqueo ──────────────────────────────────────────────────────────


def is_locked(user: models.UserAccount, now: datetime | None = None) -> bool:
    now = now or clock.now()
    return user.locked_until is not None and now < user.locked_until


def _check(
    session: Session,
    user: models.UserAccount,
    secret: str,
    hashed: str | None,
    now: datetime | None,
) -> bool:
    now = now or clock.now()
    if is_locked(user, now):
        raise AccountLocked(user.locked_until)

    ok = user.active and verify_secret(secret, hashed)
    if ok:
        user.failed_attempts = 0
        user.locked_until = None
        user.last_login_at = now
    else:
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(seconds=LOCK_SECONDS)
            user.failed_attempts = 0
    session.add(user)
    session.commit()
    session.refresh(user)
    return ok


def check_password(
    session: Session, user: models.UserAccount, password: str, now: datetime | None = None
) -> bool:
    """Comprueba la contraseña y actualiza el contador de fallos.

    Lanza ``AccountLocked`` si la cuenta está bloqueada (sin mirar la contraseña).
    """
    return _check(session, user, password, user.password_hash, now)


def check_pin(
    session: Session, user: models.UserAccount, pin: str, now: datetime | None = None
) -> bool:
    """Como ``check_password``, con el PIN. Sin PIN configurado, siempre falla."""
    return _check(session, user, pin, user.pin_hash, now)


# ── Usuarios demo ────────────────────────────────────────────────────


def demo_mode() -> bool:
    """``DEMO_MODE`` (por defecto ``true``: el prototipo es una demo)."""
    return os.environ.get("DEMO_MODE", "true").strip().lower() in {"1", "true", "yes", "on"}


def _slug(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def _member_username(name: str) -> str:
    """``Cmdr. Vega`` → ``vega``: la última palabra del nombre."""
    return _slug(name.split()[-1]) or "member"


def _role_label(role: str, vocabulary: dict[str, str]) -> str:
    key = {"responder": "ground", "member": "member"}.get(role, role)
    return vocabulary.get(key, role)


def role_label(user: models.UserAccount) -> str:
    """Nombre visible del rol con el vocabulario del entorno del usuario."""
    if user.role == "admin" or user.env_id is None:
        return "operador" if user.role == "admin" else user.role
    env = environments.get_environment(user.env_id)
    return _role_label(user.role, env.vocabulary if env else {})


def seed_users(
    session: Session, members: Iterable[models.Member], *, demo: bool | None = None
) -> int:
    """Añade a la sesión las cuentas de la demo (sin commit). Devuelve cuántas.

    Por entorno: una cuenta ``member`` por member, y ``medic``, ``commander``,
    ``responder`` y ``psych`` (``<rol>-<env>``). Además, el ``admin`` global.
    Se calcula un hash por secreto distinto (no por usuario) para que el seed
    sea rápido: son contraseñas públicas de la demo.
    """
    demo = demo_mode() if demo is None else demo
    if not demo:
        password = secrets.token_urlsafe(12)
        session.add(
            models.UserAccount(
                username="admin",
                display_name="Operador",
                role="admin",
                password_hash=hash_secret(password),
            )
        )
        log.warning("DEMO_MODE=false: usuario 'admin' creado con contraseña %s", password)
        return 1

    hashes: dict[str, str] = {}

    def cached(secret: str) -> str:
        if secret not in hashes:
            hashes[secret] = hash_secret(secret)
        return hashes[secret]

    taken = {u for u in session.exec(select(models.UserAccount.username)).all()}
    accounts: list[models.UserAccount] = []

    def add(username: str, role: str, env_id: str | None, display: str, **kw) -> None:
        base, n = username, 2
        while username in taken:
            username, n = f"{base}-{n}", n + 1
        taken.add(username)
        secret = f"ruok-{env_id or 'admin'}"
        accounts.append(
            models.UserAccount(
                username=username,
                display_name=display,
                role=role,
                env_id=env_id,
                password_hash=cached(secret),
                pin_hash=cached(DEMO_PIN) if role in PIN_ROLES else None,
                **kw,
            )
        )

    for m in members:
        add(_member_username(m.name), "member", m.env_id, m.name, member_id=m.id)

    for env in environments.list_environments():
        for role in STAFF_ROLES:
            label = _role_label(role, env.vocabulary)
            add(f"{role}-{env.id}", role, env.id, f"{label.capitalize()} ({env.name})")

    add("admin", "admin", None, "Operador")
    session.add_all(accounts)
    return len(accounts)
