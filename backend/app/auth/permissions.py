"""Matriz de permisos del backend (BE-27).

Es el ÚNICO sitio del backend con permisos. Es espejo de docs/auth-and-roles.md
("Matriz de acceso a vistas") y de frontend/src/auth/permissions.ts: si cambia
una, se cambian las tres.

Cada permiso tiene dos comprobaciones:

1. **Rol**: ``PERMISSIONS[permiso]`` dice qué roles pueden.
2. **Ámbito** (propiedad del dato):
   - ``admin`` es global;
   - un ``member`` solo accede a su propio member (``member_id`` del token);
   - el resto de roles, a los members y datos de **su** ``env_id``.

``responder`` y ``psych`` leen el historial y las alertas de su entorno.
TODO(BE-17): limitarlo a lo ENTREGADO por el enlace (estado as-of). La previsión
(FS-09) usa ``history:read`` y tiene hoy el mismo límite.
"""

from __future__ import annotations

from app import models

__all__ = [
    "ALL_ROLES",
    "PERMISSIONS",
    "Forbidden",
    "can",
    "check_env",
    "check_member",
    "check_role",
]

ALL_ROLES = frozenset({"member", "medic", "commander", "responder", "psych", "family", "admin"})
ADMIN = frozenset({"admin"})

PERMISSIONS: dict[str, frozenset[str]] = {
    # Configuración (solo lectura): cualquier usuario con sesión.
    "catalog:read": ALL_ROLES,
    "link:read": ALL_ROLES,
    "events:stream": ALL_ROLES,  # el filtrado por rol de cada evento es BE-28
    # Members
    "members:list": frozenset({"medic", "commander", "admin"}),
    "member:read": frozenset({"member", "medic", "commander", "responder", "psych", "admin"}),
    "privacy:write": frozenset({"member"}),
    # Mediciones, historial y evaluación
    "measurements:write": frozenset({"member", "medic", "admin"}),
    "history:read": frozenset({"member", "medic", "commander", "responder", "psych", "admin"}),
    # Liveness: solo lo envía el dispositivo del member (docs/auth-and-roles.md)
    "heartbeat:write": frozenset({"member"}),
    "checkin:write": frozenset({"member", "admin"}),
    # Alertas
    "alerts:read": frozenset({"member", "medic", "commander", "responder", "psych", "admin"}),
    "alerts:create": frozenset({"member", "medic", "commander", "admin"}),
    "alerts:escalate": frozenset({"member", "medic", "commander", "admin"}),
    "alerts:ack": frozenset({"medic", "commander", "responder", "psych", "admin"}),
    "alerts:message": frozenset({"member", "medic", "commander", "responder", "psych", "admin"}),
    "ground:read": frozenset({"responder", "psych", "admin"}),
    # Rutina y gamificación
    "game:read": frozenset({"member", "medic", "commander", "admin"}),
    "game:write": frozenset({"member", "admin"}),
    # Mensaje a casa: privado del member
    "home:read": frozenset({"member", "admin"}),
    "home:write": frozenset({"member", "admin"}),
    # Solo admin: centro de control, eventos, dispositivos, demo y usuarios
    "admin": ADMIN,
}


class Forbidden(Exception):
    """El rol no tiene permiso o el dato no es suyo (→ 403)."""


def can(role: str, permission: str) -> bool:
    return role in PERMISSIONS[permission]


def check_role(user: models.UserAccount, permission: str) -> None:
    if not can(user.role, permission):
        raise Forbidden("Tu rol no tiene permiso para esta acción")


def check_env(user: models.UserAccount, env_id: str | None) -> None:
    """El dato es del entorno ``env_id``: solo admin o alguien de ese entorno."""
    if user.role == "admin":
        return
    if env_id is None or user.env_id != env_id:
        raise Forbidden("Ese entorno no es el tuyo")


def check_member(user: models.UserAccount, member: models.Member) -> None:
    """El dato es de ``member``: el propio member, alguien de su entorno o admin."""
    if user.role == "admin":
        return
    if user.role == "member":
        if user.member_id != member.id:
            raise Forbidden("Solo puedes acceder a tus propios datos")
        return
    check_env(user, member.env_id)
