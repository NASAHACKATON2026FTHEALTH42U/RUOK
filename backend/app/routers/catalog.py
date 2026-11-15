"""Catálogos de solo lectura, leídos de app/data/*.json.

Entornos (BE-03), indicadores y sistemas (BE-04): reales. STUB(FS-02) → BE-21 (intervenciones).

Idioma (FE-38): cada objeto sale localizado según `Accept-Language` (`localized*` de los
servicios); los servicios devuelven siempre el original, que es el que usa la lógica interna.

Públicos (BE-27): son configuración sin datos personales, y el modal de SOS y el protocolo
autónomo los necesitan también sin sesión (docs/auth-and-roles.md, principio 3).
"""

from fastapi import APIRouter, HTTPException

from app import i18n
from app.routers.deps import ERRORS_404
from app.schemas import BodySystem, Environment, Indicator, Intervention, Slug
from app.services import catalog, environments

router = APIRouter()


@router.get(
    "/environments",
    response_model=list[Environment],
    tags=["environments"],
    summary="Perfiles de entorno",
    description="Los 6 perfiles de app/data/environments.json (docs/environments.md).",
)
def list_environments() -> list[Environment]:
    return [environments.localized(e) for e in environments.list_environments()]


@router.get(
    "/environments/{env_id}",
    response_model=Environment,
    responses=ERRORS_404,
    tags=["environments"],
    summary="Un perfil de entorno",
    description="Un perfil de app/data/environments.json. 404 si el id no existe.",
)
def get_environment(env_id: Slug) -> Environment:
    env = environments.get_environment(env_id)
    if env is None:
        raise HTTPException(404, i18n.tr("Entorno desconocido: {id}", id=env_id))
    return environments.localized(env)


@router.get(
    "/indicators",
    response_model=list[Indicator],
    tags=["catalog"],
    summary="Catálogo de indicadores",
    description="Los indicadores de app/data/indicators.json. "
    "Rangos provisionales hasta CNT-01 (docs/sources.md).",
)
def list_indicators() -> list[Indicator]:
    return [catalog.localized_indicator(i) for i in catalog.list_indicators()]


@router.get(
    "/indicators/{indicator_id}",
    response_model=Indicator,
    responses=ERRORS_404,
    tags=["catalog"],
    summary="Un indicador",
    description="Un indicador de app/data/indicators.json. 404 si el id no existe.",
)
def get_indicator(indicator_id: Slug) -> Indicator:
    ind = catalog.get_indicator(indicator_id)
    if ind is None:
        raise HTTPException(404, i18n.tr("Indicador desconocido: {id}", id=indicator_id))
    return catalog.localized_indicator(ind)


@router.get(
    "/systems",
    response_model=list[BodySystem],
    tags=["catalog"],
    summary="Sistemas del cuerpo",
    description="Los sistemas de app/data/systems.json, con su región del SVG de BodyFigure.",
)
def list_systems() -> list[BodySystem]:
    return [catalog.localized_system(s) for s in catalog.list_systems()]


@router.get(
    "/interventions",
    response_model=list[Intervention],
    tags=["catalog"],
    summary="Intervenciones (contramedidas offline)",
    description="Las de app/data/interventions.json, filtradas por `system_id` y `category`. "
    "`indicator_ids` vacío = genérica del sistema. Público (las usa el protocolo autónomo).",
)
def list_interventions(
    system_id: Slug | None = None, category: str | None = None
) -> list[Intervention]:
    return [
        catalog.localized_intervention(i) for i in catalog.list_interventions(system_id, category)
    ]
