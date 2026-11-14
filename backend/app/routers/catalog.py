"""Catálogos de solo lectura. STUB(FS-02) → BE-03 (entornos), BE-04 (indicadores y sistemas)
y BE-21 (intervenciones), que leen app/data/*.json."""

from fastapi import APIRouter, HTTPException

from app import stubs
from app.routers.deps import ERRORS_404, ERRORS_AUTH, AuthDep
from app.schemas import BodySystem, Environment, Indicator, Intervention, Slug

router = APIRouter(dependencies=[AuthDep], responses=ERRORS_AUTH)


@router.get(
    "/environments",
    response_model=list[Environment],
    tags=["environments"],
    summary="Perfiles de entorno",
    description="STUB(FS-02) → BE-03",
)
def list_environments() -> list[Environment]:
    return stubs.ENVIRONMENTS


@router.get(
    "/environments/{env_id}",
    response_model=Environment,
    responses=ERRORS_404,
    tags=["environments"],
    summary="Un perfil de entorno",
    description="STUB(FS-02) → BE-03",
)
def get_environment(env_id: Slug) -> Environment:
    env = stubs.ENV_BY_ID.get(env_id)
    if env is None:
        raise HTTPException(404, f"Entorno desconocido: {env_id}")
    return env


@router.get(
    "/indicators",
    response_model=list[Indicator],
    tags=["catalog"],
    summary="Catálogo de indicadores",
    description="STUB(FS-02) → BE-04",
)
def list_indicators() -> list[Indicator]:
    return stubs.INDICATORS


@router.get(
    "/indicators/{indicator_id}",
    response_model=Indicator,
    responses=ERRORS_404,
    tags=["catalog"],
    summary="Un indicador",
    description="STUB(FS-02) → BE-04",
)
def get_indicator(indicator_id: Slug) -> Indicator:
    ind = next((i for i in stubs.INDICATORS if i.id == indicator_id), None)
    if ind is None:
        raise HTTPException(404, f"Indicador desconocido: {indicator_id}")
    return ind


@router.get(
    "/systems",
    response_model=list[BodySystem],
    tags=["catalog"],
    summary="Sistemas del cuerpo",
    description="STUB(FS-02) → BE-04",
)
def list_systems() -> list[BodySystem]:
    return stubs.SYSTEMS


@router.get(
    "/interventions",
    response_model=list[Intervention],
    tags=["catalog"],
    summary="Intervenciones (contramedidas offline)",
    description="STUB(FS-02) → BE-21",
)
def list_interventions(
    system_id: Slug | None = None, category: str | None = None
) -> list[Intervention]:
    return [
        i
        for i in stubs.INTERVENTIONS
        if (system_id is None or i.system_id == system_id)
        and (category is None or i.category == category)
    ]
