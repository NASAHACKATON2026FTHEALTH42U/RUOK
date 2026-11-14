"""Dependencias comunes de los routers.

- `get_current_user` (BE-26): usuario del token. 401 si falta, es inválido o caduca.
- `require_roles(...)` (BE-26): 403 si el rol del usuario no está en la lista.
- `AuthDep` sigue siendo **opcional** (STUB de FS-02) en el resto de routers: BE-27
  lo sustituye por la comprobación de rol y propiedad del dato en cada endpoint.
- BE-29: registro del dispositivo a partir de X-Device-Id.
"""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app import models
from app.auth.security import InvalidToken, decode_token
from app.db import get_session
from app.schemas import ErrorResponse

bearer_scheme = HTTPBearer(auto_error=False, description="JWT local (POST /auth/login)")


def optional_bearer(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> HTTPAuthorizationCredentials | None:
    """STUB(FS-02): acepta cualquier token o ninguno. BE-26 lo sustituye."""
    return credentials


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    session: Annotated[Session, Depends(get_session)],
) -> models.UserAccount:
    """Usuario de la sesión. 401 si no hay token, es inválido, caduca o la cuenta no existe."""
    if credentials is None:
        raise _unauthorized("Falta el token de sesión")
    try:
        claims = decode_token(session, credentials.credentials)
    except InvalidToken as exc:
        raise _unauthorized(str(exc)) from exc
    user = session.get(models.UserAccount, claims.user_id)
    if user is None or not user.active:
        raise _unauthorized("La cuenta no existe o está desactivada")
    return user


CurrentUser = Annotated[models.UserAccount, Depends(get_current_user)]


def require_roles(*roles: str) -> Callable[..., models.UserAccount]:
    """Exige uno de ``roles`` (403 si no). Uso: ``Depends(require_roles("admin"))``."""
    allowed = set(roles)

    def dependency(user: CurrentUser) -> models.UserAccount:
        if user.role not in allowed:
            raise HTTPException(403, "Tu rol no tiene permiso para esta acción")
        return user

    return dependency


def device_id_header(
    x_device_id: Annotated[
        UUID | None,
        Header(description="UUID del dispositivo (docs/control-center-and-devices.md §4)"),
    ] = None,
) -> UUID | None:
    return x_device_id


AuthDep = Depends(optional_bearer)

ERRORS_AUTH = {
    401: {"model": ErrorResponse, "description": "Sin sesión válida"},
    403: {"model": ErrorResponse, "description": "Rol sin permiso o dato ajeno"},
}
ERRORS_404 = {404: {"model": ErrorResponse, "description": "Recurso inexistente"}}
ERRORS_409 = {409: {"model": ErrorResponse, "description": "Mismo id con contenido distinto"}}
