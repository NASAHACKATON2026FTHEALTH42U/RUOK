"""Autenticación local. STUB(FS-02) → BE-26 (login/PIN/JWT) y FS-07 (usuarios)."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException

from app import clock, stubs
from app.routers.deps import ERRORS_AUTH, AuthDep
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

router = APIRouter(tags=["auth"])

_ERR_LOGIN = {401: {"model": ErrorResponse, "description": "Credenciales incorrectas"}}


def _token_for(username: str) -> TokenResponse:
    user = next((u for u in stubs.USERS if u.username == username), None)
    if user is None:
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    return TokenResponse(
        access_token=f"stub-token-{user.id}",
        expires_at=clock.now() + timedelta(hours=12),
        user=user,
    )


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    responses=_ERR_LOGIN,
    summary="Login con usuario y contraseña",
    description="STUB(FS-02) → BE-26",
)
def login(body: LoginIn) -> TokenResponse:
    return _token_for(body.username)


@router.post(
    "/auth/pin",
    response_model=TokenResponse,
    responses=_ERR_LOGIN,
    summary="Login rápido con PIN",
    description="STUB(FS-02) → BE-26",
)
def login_pin(body: PinLoginIn) -> TokenResponse:
    return _token_for(body.username)


@router.get(
    "/auth/me",
    response_model=User,
    responses=ERRORS_AUTH,
    dependencies=[AuthDep],
    summary="Usuario de la sesión actual",
    description="STUB(FS-02) → BE-26",
)
def me() -> User:
    return stubs.USERS[0]


@router.get(
    "/auth/demo-users",
    response_model=list[DemoUser],
    summary="Usuarios demo para el selector del login (solo DEMO_MODE=true)",
    description="STUB(FS-02) → BE-25/BE-26",
)
def demo_users() -> list[DemoUser]:
    return stubs.DEMO_USERS


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
