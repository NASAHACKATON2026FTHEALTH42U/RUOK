"""Autenticación local y usuarios (docs/auth-and-roles.md)."""

from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel, Role, Slug


class User(ApiModel):
    id: int
    username: str
    display_name: str
    role: Role
    env_id: Slug | None = Field(default=None, description="null solo para admin (global)")
    member_id: int | None = Field(default=None, description="Solo si role=member")
    role_label: str = Field(description="Nombre del rol con el vocabulario del entorno")
    active: bool = Field(default=True, description="false = desactivada: no puede iniciar sesión")


class LoginIn(ApiModel):
    username: str
    password: str


class PinLoginIn(ApiModel):
    username: str
    pin: str = Field(pattern=r"^\d{4,6}$")


class TokenResponse(ApiModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: User


class DemoUser(ApiModel):
    """Usuario sembrado para el selector de la demo (solo con DEMO_MODE=true)."""

    username: str
    display_name: str
    role: Role
    env_id: Slug | None
    role_label: str


class UserCreate(ApiModel):
    """Alta de usuario desde /control (FS-07, solo admin)."""

    username: str = Field(pattern=r"^[a-z0-9][a-z0-9._-]{1,31}$")
    display_name: str = Field(min_length=1, max_length=80)
    role: Role
    env_id: Slug | None = Field(default=None, description="Obligatorio salvo para admin")
    member_id: int | None = Field(default=None, description="Obligatorio solo si role=member")
    password: str = Field(min_length=8, max_length=72)
    pin: str | None = Field(default=None, pattern=r"^\d{4,6}$", description="Solo member/medic")


class UserUpdate(ApiModel):
    """Activar o desactivar una cuenta (FS-07)."""

    active: bool


class PinReset(ApiModel):
    """Nuevo PIN de una cuenta member/medic (FS-07)."""

    pin: str = Field(pattern=r"^\d{4,6}$")
