"""Cuentas de usuario: hash de contraseña, bloqueo y usuarios demo (BE-25).

Ver docs/auth-and-roles.md:

- Contraseña con **bcrypt** (el login con PIN se retiró: solo usuario y contraseña).
- **5 fallos seguidos → bloqueo de 5 min** (``failed_attempts``, ``locked_until``).
- Usuarios demo (contraseña ``ruok-<env>``) **solo con
  ``DEMO_MODE=true``**. Con ``DEMO_MODE=false`` solo se crea el ``admin`` con
  una contraseña aleatoria, que se escribe una vez en el log del servidor.

Los endpoints ``/auth/*`` (login, me y JWT) son BE-26.
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
from app.schemas.common import EventType
from app.services import environments, events

__all__ = [
    "LOCK_SECONDS",
    "MAX_FAILED_ATTEMPTS",
    "AccountLocked",
    "UserConflict",
    "UserInvalid",
    "check_password",
    "create_user",
    "demo_mode",
    "hash_secret",
    "is_locked",
    "role_label",
    "seed_users",
    "set_active",
    "verify_secret",
]

log = logging.getLogger(__name__)

MAX_FAILED_ATTEMPTS = 5
LOCK_SECONDS = 5 * 60
STAFF_ROLES = ("medic", "commander", "responder", "psych")


class AccountLocked(Exception):
    """La cuenta está bloqueada hasta ``locked_until``."""

    def __init__(self, locked_until: datetime):
        super().__init__(f"Cuenta bloqueada hasta {locked_until.isoformat()}")
        self.locked_until = locked_until


class UserInvalid(ValueError):
    """Los datos de la cuenta son incoherentes (→ 422)."""


class UserConflict(ValueError):
    """La operación choca con el estado actual (→ 409)."""


# ── Hash ─────────────────────────────────────────────────────────────


def _rounds() -> int:
    """Coste de bcrypt. ``RUOK_BCRYPT_ROUNDS`` permite bajarlo en los tests."""
    return int(os.environ.get("RUOK_BCRYPT_ROUNDS", "12"))


def hash_secret(secret: str) -> str:
    """Hash bcrypt (con sal) de una contraseña."""
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


# Si el vocabulario del entorno no nombra un rol, un nombre genérico en español: nunca el
# identificador en inglés ("commander", "psych") en la interfaz.
DEFAULT_ROLE_LABELS = {
    "member": "persona monitorizada",
    "medic": "sanitario",
    "commander": "responsable",
    "responder": "médico",
    "psych": "psicólogo",
    "family": "familia",
}


def _role_label(role: str, vocabulary: dict[str, str]) -> str:
    key = {"responder": "ground", "member": "member"}.get(role, role)
    return vocabulary.get(key) or DEFAULT_ROLE_LABELS.get(role, role)


def _capitalize(text: str) -> str:
    """Primera letra en mayúscula sin tocar el resto (``str.capitalize`` haría "Psicólogo bhp")."""
    return text[:1].upper() + text[1:]


def role_label(user: models.UserAccount) -> str:
    """Nombre visible del rol con el vocabulario del entorno del usuario."""
    if user.role == "admin" or user.env_id is None:
        return "operador" if user.role == "admin" else DEFAULT_ROLE_LABELS.get(user.role, user.role)
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
                **kw,
            )
        )

    for m in members:
        add(_member_username(m.name), "member", m.env_id, m.name, member_id=m.id)

    for env in environments.list_environments():
        for role in STAFF_ROLES:
            label = _role_label(role, env.vocabulary)
            add(f"{role}-{env.id}", role, env.id, f"{_capitalize(label)} ({env.name})")

    add("admin", "admin", None, "Operador")
    session.add_all(accounts)
    return len(accounts)


# ── Gestión de usuarios (FS-07) ──────────────────────────────────────


def create_user(
    session: Session,
    *,
    username: str,
    display_name: str,
    role: str,
    env_id: str | None,
    member_id: int | None,
    password: str,
) -> models.UserAccount:
    """Crea una cuenta y hace commit. ``UserInvalid`` (422) o ``UserConflict`` (409)."""
    if role == "admin":
        if env_id is not None or member_id is not None:
            raise UserInvalid("El admin es global: sin entorno ni member")
    else:
        if env_id is None:
            raise UserInvalid("Falta el entorno (solo el admin es global)")
        if environments.get_environment(env_id) is None:
            raise UserInvalid(f"Entorno desconocido: {env_id}")
    if role == "member":
        member = session.get(models.Member, member_id) if member_id is not None else None
        if member is None or member.env_id != env_id:
            raise UserInvalid("Un member necesita un member_id existente de su entorno")
    elif member_id is not None:
        raise UserInvalid("Solo el rol member lleva member_id")

    if session.exec(
        select(models.UserAccount).where(models.UserAccount.username == username)
    ).first():
        raise UserConflict(f"El usuario «{username}» ya existe")
    if (
        member_id is not None
        and session.exec(
            select(models.UserAccount).where(models.UserAccount.member_id == member_id)
        ).first()
    ):
        raise UserConflict("Ese member ya tiene una cuenta")

    account = models.UserAccount(
        username=username,
        display_name=display_name,
        role=role,
        env_id=env_id,
        member_id=member_id,
        password_hash=hash_secret(password),
    )
    session.add(account)
    session.flush()  # id para el evento
    events.emit(
        session,
        EventType.user_created,
        env_id=env_id,
        member_id=member_id,
        user_id=account.id,
        summary=f"Usuario creado: {display_name} ({role})",
        payload={"username": username, "display_name": display_name, "role": role},
    )
    session.commit()
    session.refresh(account)
    return account


def set_active(
    session: Session, account: models.UserAccount, active: bool, *, acting: models.UserAccount
) -> models.UserAccount:
    """Activa o desactiva una cuenta. No puedes desactivarte ni dejar el sistema sin admin."""
    if not active and account.active:
        if account.id == acting.id:
            raise UserConflict("No puedes desactivar tu propia cuenta")
        if account.role == "admin":
            others = session.exec(
                select(models.UserAccount).where(
                    models.UserAccount.role == "admin",
                    models.UserAccount.active == True,  # noqa: E712
                    models.UserAccount.id != account.id,
                )
            ).first()
            if others is None:
                raise UserConflict("Tiene que quedar al menos un admin activo")
    account.active = active
    session.add(account)
    session.commit()
    session.refresh(account)
    return account

