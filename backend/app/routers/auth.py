"""Autenticación local (BE-26). `/users` sigue siendo STUB(FS-02) → FS-07.

Ver docs/auth-and-roles.md:
- `POST /auth/login` y `POST /auth/pin` devuelven un JWT local (12 h).
- Credenciales incorrectas, cuenta inexistente o bloqueada → 401. Los 5 fallos
  seguidos y el bloqueo de 5 min están en `services/accounts.py` (BE-25).
- `GET /auth/demo-users` solo existe con `DEMO_MODE=true` (si no, 404).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app import models, stubs
from app.auth.security import create_token
from app.db import get_session
from app.routers.deps import ERRORS_AUTH, AuthDep, CurrentUser
from app.schemas import (
    DemoUser,
    ErrorResponse,
    LoginIn,
    PinLoginIn,
    Slug,
    TokenResponse,
    User,
    UserCreate,
)
from app.services import accounts

router = APIRouter(tags=["auth"])

SessionDep = Annotated[Session, Depends(get_session)]

_ERR_LOGIN = {401: {"model": ErrorResponse, "description": "Credenciales incorrectas"}}
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
    )


def _authenticate(session: Session, username: str, secret: str, *, pin: bool) -> TokenResponse:
    account = session.exec(
        select(models.UserAccount).where(models.UserAccount.username == username)
    ).first()
    if account is None:
        # TODO(BE-28): events.emit("auth.failed", reason="unknown_user")
        raise HTTPException(401, _BAD_CREDENTIALS)
    check = accounts.check_pin if pin else accounts.check_password
    try:
        ok = check(session, account, secret)
    except accounts.AccountLocked as exc:
        # TODO(BE-28): events.emit("auth.failed", reason="locked")
        until = exc.locked_until.isoformat(timespec="seconds")
        raise HTTPException(401, f"Cuenta bloqueada por demasiados intentos hasta {until}") from exc
    if not ok:
        # TODO(BE-28): events.emit("auth.failed", reason="bad_credentials")
        raise HTTPException(401, "PIN incorrecto" if pin else _BAD_CREDENTIALS)

    token, expires_at = create_token(session, account)
    # TODO(BE-28): events.emit("auth.login", user_id=account.id, method="pin"|"password")
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


@router.get(
    "/users",
    response_model=list[User],
    responses=ERRORS_AUTH,
    dependencies=[AuthDep],
    summary="Listar usuarios (admin)",
    description="STUB(FS-02) → FS-07",
)
def list_users(env_id: Slug | None = None) -> list[User]:
    return [u for u in stubs.USERS if env_id is None or u.env_id == env_id]


@router.post(
    "/users",
    response_model=User,
    status_code=201,
    responses=ERRORS_AUTH,
    dependencies=[AuthDep],
    summary="Crear usuario (admin)",
    description="STUB(FS-02) → FS-07",
)
def create_user(body: UserCreate) -> User:
    return User(
        id=100,
        username=body.username,
        display_name=body.display_name,
        role=body.role,
        env_id=body.env_id,
        member_id=body.member_id,
        role_label=body.role.value,
    )
