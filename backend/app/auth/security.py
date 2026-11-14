"""JWT HS256 con clave local (BE-26, docs/auth-and-roles.md#autenticación).

- Clave: ``RUOK_JWT_SECRET`` si está definida. Si no, se genera en el primer
  arranque y se guarda en ``app_state`` (``jwt_secret``), así los tokens
  sobreviven a un reinicio del servidor.
- Payload: ``{sub, role, env_id, member_id, iat, exp}``. ``sub`` es el id de
  ``user_account`` como texto, como pide el estándar.
- Caducidad: 12 h por defecto, configurable con ``RUOK_JWT_TTL_HOURS``.
- La caducidad se comprueba con ``clock.now()`` y **no** con la hora del sistema:
  el fast-forward de la demo también hace caducar las sesiones.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

import jwt
from sqlmodel import Session

from app import clock, models
from app.services import app_state

__all__ = ["ALGORITHM", "InvalidToken", "TokenClaims", "create_token", "decode_token"]

ALGORITHM = "HS256"
SECRET_KEY = "jwt_secret"


class InvalidToken(Exception):
    """Token ausente, mal formado, con firma incorrecta o caducado."""


@dataclass(frozen=True)
class TokenClaims:
    user_id: int
    role: str
    env_id: str | None
    member_id: int | None
    expires_at: datetime


def ttl() -> timedelta:
    return timedelta(hours=float(os.environ.get("RUOK_JWT_TTL_HOURS", "12")))


def _secret(session: Session) -> str:
    env = os.environ.get("RUOK_JWT_SECRET")
    if env:
        return env
    stored = app_state.get_value(session, SECRET_KEY)
    if not stored:
        stored = secrets.token_urlsafe(32)
        app_state.set_value(session, SECRET_KEY, stored)
    return stored


def create_token(session: Session, user: models.UserAccount) -> tuple[str, datetime]:
    """Firma un token para ``user``. Devuelve ``(token, expires_at)``."""
    now = clock.now()
    expires_at = now + ttl()
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "env_id": user.env_id,
        "member_id": user.member_id,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return jwt.encode(payload, _secret(session), algorithm=ALGORITHM), expires_at


def decode_token(session: Session, token: str) -> TokenClaims:
    """Valida firma y caducidad. Lanza ``InvalidToken`` si algo falla."""
    try:
        payload = jwt.decode(
            token,
            _secret(session),
            algorithms=[ALGORITHM],
            # exp se comprueba abajo con el reloj de la demo. iat tampoco se valida con la
            # hora del sistema: tras /demo/fast-forward, iat = clock.now() queda en el
            # "futuro" y PyJWT daría el token por inválido (BE-36).
            options={"verify_exp": False, "verify_iat": False, "require": ["sub", "role", "exp"]},
        )
        user_id = int(payload["sub"])
        exp = int(payload["exp"])
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise InvalidToken("Token inválido") from exc

    if clock.now().timestamp() >= exp:
        raise InvalidToken("Token caducado")
    return TokenClaims(
        user_id=user_id,
        role=payload["role"],
        env_id=payload.get("env_id"),
        member_id=payload.get("member_id"),
        expires_at=datetime.fromtimestamp(exp, tz=clock.now().tzinfo),
    )
