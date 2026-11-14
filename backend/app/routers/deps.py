"""Dependencias comunes de los routers.

FS-02 solo las declara para que el OpenAPI refleje el contrato (candado de
Bearer en Swagger, cabecera X-Device-Id). La validación real llega en:
- BE-26: `get_current_user` (401 si falta o caduca el token).
- BE-27: permisos por rol y propiedad del dato (403).
- BE-29: registro del dispositivo a partir de X-Device-Id.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas import ErrorResponse

bearer_scheme = HTTPBearer(auto_error=False, description="JWT local (POST /auth/login)")


def optional_bearer(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> HTTPAuthorizationCredentials | None:
    """STUB(FS-02): acepta cualquier token o ninguno. BE-26 lo sustituye."""
    return credentials


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
