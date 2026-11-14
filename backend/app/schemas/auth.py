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
    """P2 (FS-07): alta de usuario desde /control."""

    username: str
    display_name: str
    role: Role
    env_id: Slug | None = None
    member_id: int | None = None
    password: str
    pin: str | None = Field(default=None, pattern=r"^\d{4,6}$")
