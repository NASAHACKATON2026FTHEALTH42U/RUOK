"""Dependencias comunes de los routers.

Autenticación (BE-26) y autorización (BE-27, matriz en `app/auth/permissions.py`):

- `get_current_user` / `AuthDep`: usuario del token. 401 si falta, es inválido o caduca.
- `optional_user`: el usuario si hay un token válido; si no, `None` (SOS sin sesión).
- `allow(permiso)`: comprueba el rol (403).
- `allow_member(permiso)`, `allow_env(permiso)`, `allow_alert(permiso)`: rol + ámbito del
  dato (el `member_id`, `env_id` o `alert_id` de la ruta). Si el recurso no existe, no se
  corta aquí: el endpoint responde su 404 como siempre.
- `device_id_header`: X-Device-Id. Uno mal formado NO da 422 (rompería el SOS): se
  registra en el log y se ignora. Uno válido actualiza el registro de dispositivos (BE-29):
  IP, user agent, última vez visto y, si hay sesión válida, el último usuario.
"""

import logging
from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app import models
from app.auth import permissions
from app.auth.security import InvalidToken, decode_token
from app.db import get_session
from app.schemas import ErrorResponse
from app.services import devices

log = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False, description="JWT local (POST /auth/login)")

SessionDep = Annotated[Session, Depends(get_session)]
Credentials = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})


def _user_from_token(session: Session, token: str | None) -> models.UserAccount:
    if not token:
        raise _unauthorized("Falta el token de sesión")
    try:
        claims = decode_token(session, token)
    except InvalidToken as exc:
        raise _unauthorized(str(exc)) from exc
    user = session.get(models.UserAccount, claims.user_id)
    if user is None or not user.active:
        raise _unauthorized("La cuenta no existe o está desactivada")
    return user


def get_current_user(credentials: Credentials, session: SessionDep) -> models.UserAccount:
    """Usuario de la sesión. 401 si no hay token, es inválido, caduca o la cuenta no existe."""
    return _user_from_token(session, credentials.credentials if credentials else None)


def optional_user(credentials: Credentials, session: SessionDep) -> models.UserAccount | None:
    """Como `get_current_user`, pero sin 401: `None` si no hay sesión válida."""
    try:
        return get_current_user(credentials, session)
    except HTTPException:
        return None


def stream_user(
    credentials: Credentials,
    session: SessionDep,
    token: Annotated[str | None, Query(description="JWT (EventSource no admite cabeceras)")] = None,
) -> models.UserAccount:
    """Para SSE: el token va en `?token=` (o en la cabecera, si el cliente puede)."""
    return _user_from_token(session, token or (credentials.credentials if credentials else None))


CurrentUser = Annotated[models.UserAccount, Depends(get_current_user)]
OptionalUser = Annotated[models.UserAccount | None, Depends(optional_user)]


def _forbidden(exc: permissions.Forbidden) -> HTTPException:
    return HTTPException(403, str(exc))


def check(user: models.UserAccount, permission: str) -> None:
    """Comprobación de rol dentro de un endpoint (403)."""
    try:
        permissions.check_role(user, permission)
    except permissions.Forbidden as exc:
        raise _forbidden(exc) from exc


def check_member(user: models.UserAccount, member: models.Member) -> None:
    """Comprobación de ámbito dentro de un endpoint (403)."""
    try:
        permissions.check_member(user, member)
    except permissions.Forbidden as exc:
        raise _forbidden(exc) from exc


def check_env(user: models.UserAccount, env_id: str) -> None:
    try:
        permissions.check_env(user, env_id)
    except permissions.Forbidden as exc:
        raise _forbidden(exc) from exc


def allow(permission: str) -> Callable[..., models.UserAccount]:
    """Dependencia: el rol del usuario tiene `permission` (403 si no)."""
    permissions.PERMISSIONS[permission]  # KeyError al importar si el permiso no existe

    def dependency(user: CurrentUser) -> models.UserAccount:
        check(user, permission)
        return user

    return dependency


def allow_member(permission: str) -> Callable[..., models.UserAccount]:
    """Dependencia: rol + el `member_id` de la ruta es suyo o de su entorno."""
    permissions.PERMISSIONS[permission]

    def dependency(member_id: int, user: CurrentUser, session: SessionDep) -> models.UserAccount:
        check(user, permission)
        member = session.get(models.Member, member_id)
        if member is not None:
            check_member(user, member)
        return user

    return dependency


def allow_env(permission: str) -> Callable[..., models.UserAccount]:
    """Dependencia: rol + el `env_id` de la ruta es el suyo (o es admin)."""
    permissions.PERMISSIONS[permission]

    def dependency(env_id: str, user: CurrentUser) -> models.UserAccount:
        check(user, permission)
        check_env(user, env_id)
        return user

    return dependency


def allow_alert(permission: str) -> Callable[..., models.UserAccount]:
    """Dependencia: rol + la alerta `alert_id` es de un member al que tiene acceso."""
    permissions.PERMISSIONS[permission]

    def dependency(alert_id: UUID, user: CurrentUser, session: SessionDep) -> models.UserAccount:
        check(user, permission)
        alert = session.get(models.Alert, str(alert_id))
        if alert is not None:
            member = session.get(models.Member, alert.member_id)
            if member is not None:
                check_member(user, member)
        return user

    return dependency


def require_roles(*roles: str) -> Callable[..., models.UserAccount]:
    """Exige uno de ``roles`` (403 si no). Uso: ``Depends(require_roles("admin"))``."""
    allowed = set(roles)

    def dependency(user: CurrentUser) -> models.UserAccount:
        if user.role not in allowed:
            raise HTTPException(403, "Tu rol no tiene permiso para esta acción")
        return user

    return dependency


_LOOPBACK = {"127.0.0.1", "::1", "localhost", "testclient"}


def _client_ip(request: Request) -> str | None:
    """IP del dispositivo. Detrás de un proxy local (Vite en desarrollo) se usa
    `X-Forwarded-For`; solo se le hace caso si la conexión viene del propio servidor."""
    peer = request.client.host if request.client else None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and (peer is None or peer in _LOOPBACK):
        return forwarded.split(",")[0].strip() or peer
    return peer


def _request_user(request: Request, session: Session) -> models.UserAccount | None:
    """Usuario de la sesión si el token es válido; si no, `None` (nunca 401 aquí).
    Se lee la cabecera a mano para no añadir un esquema de seguridad a las rutas públicas."""
    auth = request.headers.get("authorization", "")
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not token:
        token = request.query_params.get("token", "")  # SSE: ?token=
    if not token:
        return None
    try:
        return _user_from_token(session, token.strip())
    except HTTPException:
        return None


def device_id_header(
    request: Request,
    session: SessionDep,
    x_device_id: Annotated[
        str | None,
        Header(description="UUID del dispositivo (docs/control-center-and-devices.md §4)"),
    ] = None,
) -> UUID | None:
    if x_device_id is None:
        return None
    try:
        device_id = UUID(x_device_id)
    except ValueError:
        log.warning("X-Device-Id mal formado, se ignora: %r", x_device_id[:64])
        return None
    try:
        devices.touch(
            session,
            str(device_id),
            user=_request_user(request, session),
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        session.commit()
    except Exception:  # el registro nunca debe tumbar la petición (ni el SOS)
        session.rollback()
        log.exception("No se pudo registrar el dispositivo %s", device_id)
    return device_id


AuthDep = Depends(get_current_user)
AdminDep = Depends(allow("admin"))

ERRORS_AUTH = {
    401: {"model": ErrorResponse, "description": "Sin sesión válida"},
    403: {"model": ErrorResponse, "description": "Rol sin permiso o dato ajeno"},
}
ERRORS_404 = {404: {"model": ErrorResponse, "description": "Recurso inexistente"}}
ERRORS_409 = {409: {"model": ErrorResponse, "description": "Mismo id con contenido distinto"}}
