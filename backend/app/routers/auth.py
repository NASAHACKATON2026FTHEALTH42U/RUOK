"""Autenticación local (BE-26) y gestión de usuarios (FS-07, solo admin).

Ver docs/auth-and-roles.md:
- `POST /auth/login` y `POST /auth/pin` devuelven un JWT local (12 h).
- Credenciales incorrectas o cuenta inexistente → 401. Cuenta bloqueada → 429 con
  `Retry-After` (el front lo muestra como "demasiados intentos"). Los 5 fallos
  seguidos y el bloqueo de 5 min están en `services/accounts.py` (BE-25).
- `GET /auth/demo-users` solo existe con `DEMO_MODE=true` (si no, 404).
"""

import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app import clock, models
from app.auth.security import create_token
from app.db import get_session
from app.routers.deps import ERRORS_404, ERRORS_AUTH, AdminDep, CurrentUser
from app.schemas import (
    DemoUser,
    ErrorResponse,
    EventType,
    LoginIn,
    PinLoginIn,
    PinReset,
    Slug,
    TokenResponse,
    User,
    UserCreate,
    UserUpdate,
)
from app.services import accounts, events

router = APIRouter(tags=["auth"])

SessionDep = Annotated[Session, Depends(get_session)]

_ERR_LOGIN = {
    401: {"model": ErrorResponse, "description": "Credenciales incorrectas"},
    429: {"model": ErrorResponse, "description": "Cuenta bloqueada tras 5 fallos (Retry-After)"},
}
_BAD_CREDENTIALS = "Usuario o contraseña incorrectos"
_ROLE_ORDER = ["member", "medic", "commander", "responder", "psych", "family", "admin"]


def to_user(account: models.UserAccount) -> User:
    return User(
        id=account.id,
        username=account.username,
        display_name=account.display_name,
        role=account.role,
        env_id=account.env_id,
        member_id=account.member_id,
        role_label=accounts.role_label(account),
        active=account.active,
    )


def _auth_event(
    session: Session,
    type_: EventType,
    account: models.UserAccount | None,
    username: str,
    method: str,
    reason: str | None = None,
) -> None:
    """`auth.login` / `auth.failed` en la bitácora (solo los ve admin en el SSE)."""
    ok = type_ == EventType.auth_login
    events.emit(
        session,
        type_,
        env_id=account.env_id if account else None,
        member_id=account.member_id if account else None,
        user_id=account.id if account else None,
        summary=f"Login de {username}" if ok else f"Login fallido de {username} ({reason})",
        payload={"username": username, "method": method, **({"reason": reason} if reason else {})},
    )
    session.commit()


def _authenticate(session: Session, username: str, secret: str, *, pin: bool) -> TokenResponse:
    account = session.exec(
        select(models.UserAccount).where(models.UserAccount.username == username)
    ).first()
    method = "pin" if pin else "password"
    if account is None:
        _auth_event(session, EventType.auth_failed, None, username, method, "unknown_user")
        raise HTTPException(401, _BAD_CREDENTIALS)
    check = accounts.check_pin if pin else accounts.check_password
    try:
        ok = check(session, account, secret)
    except accounts.AccountLocked as exc:
        _auth_event(session, EventType.auth_failed, account, username, method, "locked")
        until = exc.locked_until.isoformat(timespec="seconds")
        retry = max(1, math.ceil((exc.locked_until - clock.now()).total_seconds()))
        raise HTTPException(
            429,
            f"Cuenta bloqueada por demasiados intentos hasta {until}",
            headers={"Retry-After": str(retry)},
        ) from exc
    if not ok:
        _auth_event(session, EventType.auth_failed, account, username, method, "bad_credentials")
        raise HTTPException(401, "PIN incorrecto" if pin else _BAD_CREDENTIALS)

    token, expires_at = create_token(session, account)
    _auth_event(session, EventType.auth_login, account, username, method)
    return TokenResponse(access_token=token, expires_at=expires_at, user=to_user(account))


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    responses=_ERR_LOGIN,
    summary="Login con usuario y contraseña",
)
def login(body: LoginIn, session: SessionDep) -> TokenResponse:
    return _authenticate(session, body.username, body.password, pin=False)


@router.post(
    "/auth/pin",
    response_model=TokenResponse,
    responses=_ERR_LOGIN,
    summary="Login rápido con PIN",
    description="Solo para `member` y `medic` (tablets compartidas).",
)
def login_pin(body: PinLoginIn, session: SessionDep) -> TokenResponse:
    return _authenticate(session, body.username, body.pin, pin=True)


@router.get(
    "/auth/me",
    response_model=User,
    responses=ERRORS_AUTH,
    summary="Usuario de la sesión actual",
)
def me(user: CurrentUser) -> User:
    return to_user(user)


@router.get(
    "/auth/demo-users",
    response_model=list[DemoUser],
    responses={404: {"model": ErrorResponse, "description": "DEMO_MODE=false"}},
    summary="Usuarios demo para el selector del login (solo DEMO_MODE=true)",
)
def demo_users(session: SessionDep) -> list[DemoUser]:
    if not accounts.demo_mode():
        raise HTTPException(404, "Solo disponible con DEMO_MODE=true")
    rows = session.exec(
        select(models.UserAccount).where(models.UserAccount.active == True)  # noqa: E712
    ).all()
    rows = sorted(
        rows,
        key=lambda u: (u.env_id is None, u.env_id or "", _ROLE_ORDER.index(u.role), u.id),
    )
    return [
        DemoUser(
            **to_user(u).model_dump(
                include={"username", "display_name", "role", "env_id", "role_label"}
            )
        )
        for u in rows
    ]


_ERR_USER = {
    **ERRORS_AUTH,
    409: {"model": ErrorResponse, "description": "Choca con el estado actual"},
}


def _get_account(session: Session, user_id: int) -> models.UserAccount:
    account = session.get(models.UserAccount, user_id)
    if account is None:
        raise HTTPException(404, "Usuario inexistente")
    return account


@router.get(
    "/users",
    response_model=list[User],
    responses=ERRORS_AUTH,
    dependencies=[AdminDep],
    summary="Listar usuarios (admin)",
)
def list_users(session: SessionDep, env_id: Slug | None = None) -> list[User]:
    query = select(models.UserAccount).order_by(models.UserAccount.id)
    if env_id is not None:
        query = query.where(models.UserAccount.env_id == env_id)
    return [to_user(u) for u in session.exec(query).all()]


@router.post(
    "/users",
    response_model=User,
    status_code=201,
    responses=_ERR_USER,
    dependencies=[AdminDep],
    summary="Crear usuario (admin)",
)
def create_user(body: UserCreate, session: SessionDep) -> User:
    try:
        account = accounts.create_user(session, **body.model_dump(mode="json"))
    except accounts.UserInvalid as exc:
        raise HTTPException(422, str(exc)) from exc
    except accounts.UserConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    return to_user(account)


@router.patch(
    "/users/{user_id}",
    response_model=User,
    responses={**_ERR_USER, **ERRORS_404},
    dependencies=[AdminDep],
    summary="Activar o desactivar un usuario (admin)",
)
def update_user(user_id: int, body: UserUpdate, session: SessionDep, admin: CurrentUser) -> User:
    account = _get_account(session, user_id)
    try:
        account = accounts.set_active(session, account, body.active, acting=admin)
    except accounts.UserConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    return to_user(account)


@router.put(
    "/users/{user_id}/pin",
    response_model=User,
    responses={**ERRORS_AUTH, **ERRORS_404},
    dependencies=[AdminDep],
    summary="Restablecer el PIN de un usuario (admin)",
)
def reset_user_pin(user_id: int, body: PinReset, session: SessionDep) -> User:
    account = _get_account(session, user_id)
    try:
        account = accounts.reset_pin(session, account, body.pin)
    except accounts.UserInvalid as exc:
        raise HTTPException(422, str(exc)) from exc
    return to_user(account)
