"""Members, mediciones, evaluación y liveness.

STUB(FS-02) → BE-05 (members), BE-06 (mediciones), BE-11 (assessment),
BE-12 (heartbeat) y BE-16 (R U OK?).
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app import stubs
from app.routers.deps import ERRORS_404, ERRORS_409, ERRORS_AUTH, AuthDep
from app.schemas import (
    Assessment,
    HeartbeatIn,
    HeartbeatResult,
    Measurement,
    MeasurementBatchIn,
    MeasurementBatchResult,
    Member,
    MemberSummary,
    PrivacyIn,
    RuokIn,
    RuokResult,
    Slug,
)

router = APIRouter(dependencies=[AuthDep], responses={**ERRORS_AUTH, **ERRORS_404})


def _member(member_id: int) -> Member:
    m = next((m for m in stubs.MEMBERS if m.id == member_id), None)
    if m is None:
        raise HTTPException(404, f"Member desconocido: {member_id}")
    return m


@router.get(
    "/environments/{env_id}/members",
    response_model=list[MemberSummary],
    tags=["members"],
    summary="Members del entorno con su resumen",
    description="STUB(FS-02) → BE-05",
)
def list_members(env_id: Slug) -> list[MemberSummary]:
    if env_id not in stubs.ENV_BY_ID:
        raise HTTPException(404, f"Entorno desconocido: {env_id}")
    return [stubs.member_summary(m) for m in stubs.MEMBERS if m.env_id == env_id]


@router.get(
    "/members/{member_id}",
    response_model=Member,
    tags=["members"],
    summary="Un member",
    description="STUB(FS-02) → BE-05",
)
def get_member(member_id: int) -> Member:
    return _member(member_id)


@router.patch(
    "/members/{member_id}/privacy",
    response_model=Member,
    tags=["members"],
    summary="Compartir o no los detalles conductuales (solo el propio member)",
    description="STUB(FS-02) → BE-05/BE-20",
)
def set_privacy(member_id: int, body: PrivacyIn) -> Member:
    return _member(member_id).model_copy(update=body.model_dump())


@router.post(
    "/members/{member_id}/measurements",
    response_model=MeasurementBatchResult,
    responses=ERRORS_409,
    tags=["measurements"],
    summary="Registrar un lote de mediciones (idempotente por UUID)",
    description="Repetir un id con el mismo contenido cuenta como `duplicates`; "
    "con contenido distinto → 409. STUB(FS-02) → BE-06",
)
def post_measurements(member_id: int, body: MeasurementBatchIn) -> MeasurementBatchResult:
    m = _member(member_id)
    return MeasurementBatchResult(
        accepted=len(body.measurements), duplicates=0, assessment=stubs.assessment(m.id, m.env_id)
    )


@router.get(
    "/members/{member_id}/measurements",
    response_model=list[Measurement],
    tags=["measurements"],
    summary="Serie temporal de mediciones (orden: taken_at)",
    description="STUB(FS-02) → BE-06",
)
def list_measurements(
    member_id: int,
    indicator_id: Slug | None = None,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
) -> list[Measurement]:
    _member(member_id)
    return [stubs.measurement(member_id)]


@router.get(
    "/members/{member_id}/assessment",
    response_model=Assessment,
    tags=["assessment"],
    summary="Evaluación del member",
    description="Con `env` se evalúa con otro perfil sin modificar datos. STUB(FS-02) → BE-11",
)
def get_assessment(member_id: int, env: Slug | None = None) -> Assessment:
    m = _member(member_id)
    return stubs.assessment(m.id, env or m.env_id)


@router.post(
    "/members/{member_id}/heartbeat",
    response_model=HeartbeatResult,
    tags=["liveness"],
    summary="Señal de vida del dispositivo del member",
    description="Actualiza también el registro del dispositivo. STUB(FS-02) → BE-12/BE-29",
)
def heartbeat(member_id: int, body: HeartbeatIn) -> HeartbeatResult:
    _member(member_id)
    return HeartbeatResult(liveness="active", checkin_required=False)


@router.post(
    "/members/{member_id}/ruok",
    response_model=RuokResult,
    tags=["liveness"],
    summary="Respuesta al check-in 'R U OK?'",
    description="STUB(FS-02) → BE-16",
)
def ruok(member_id: int, body: RuokIn) -> RuokResult:
    _member(member_id)
    return RuokResult(liveness="active", alert_id=None if body.ok else stubs.ALERT_ID)
