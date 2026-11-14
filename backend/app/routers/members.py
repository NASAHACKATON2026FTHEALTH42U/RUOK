"""Members, mediciones, evaluación y liveness.

Reales: members (BE-05) y mediciones (BE-06).
STUB(FS-02) → BE-11 (assessment), BE-12 (heartbeat y liveness) y BE-16 (R U OK?).
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app import models, stubs
from app.db import get_session
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
from app.services import environments, measurements, members

SessionDep = Annotated[Session, Depends(get_session)]

router = APIRouter(dependencies=[AuthDep], responses={**ERRORS_AUTH, **ERRORS_404})


def _member(session: Session, member_id: int) -> models.Member:
    m = members.get_member(session, member_id)
    if m is None:
        raise HTTPException(404, f"Member desconocido: {member_id}")
    return m


@router.get(
    "/environments/{env_id}/members",
    response_model=list[MemberSummary],
    tags=["members"],
    summary="Members del entorno con su resumen",
    description="Members de la BD con `last_measurement_at` real. "
    "`liveness`, `overall_status` y `open_alerts`: STUB(FS-02) → BE-12, BE-11 y BE-14.",
)
def list_members(env_id: Slug, session: SessionDep) -> list[MemberSummary]:
    if environments.get_environment(env_id) is None:
        raise HTTPException(404, f"Entorno desconocido: {env_id}")
    return [members.to_summary(session, m) for m in members.list_by_env(session, env_id)]


@router.get(
    "/members/{member_id}",
    response_model=Member,
    tags=["members"],
    summary="Un member",
    description="Member de la BD. `liveness`: STUB(FS-02) → BE-12.",
)
def get_member(member_id: int, session: SessionDep) -> Member:
    return members.to_schema(_member(session, member_id))


@router.patch(
    "/members/{member_id}/privacy",
    response_model=Member,
    tags=["members"],
    summary="Compartir o no los detalles conductuales (solo el propio member)",
    description="Se guarda en la BD. El permiso (solo el propio member) llega con BE-27.",
)
def set_privacy(member_id: int, body: PrivacyIn, session: SessionDep) -> Member:
    m = members.set_privacy(session, _member(session, member_id), body.share_behavioral_details)
    return members.to_schema(m)


@router.post(
    "/members/{member_id}/measurements",
    response_model=MeasurementBatchResult,
    responses=ERRORS_409,
    tags=["measurements"],
    summary="Registrar un lote de mediciones (idempotente por UUID)",
    description="Repetir un id con el mismo contenido cuenta como `duplicates`; "
    "con contenido distinto → 409. El lote es atómico: si una medición es inválida "
    "(indicador desconocido o valor fuera del rango del input → 422) o está en conflicto, "
    "no se guarda ninguna. `assessment`: STUB(FS-02) → BE-11",
)
def post_measurements(
    member_id: int, body: MeasurementBatchIn, session: SessionDep
) -> MeasurementBatchResult:
    m = _member(session, member_id)
    try:
        accepted, duplicates = measurements.save_batch(session, m.id, body.measurements)
    except measurements.InvalidMeasurement as exc:
        raise HTTPException(422, str(exc)) from exc
    except measurements.MeasurementConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    return MeasurementBatchResult(
        accepted=accepted,
        duplicates=duplicates,
        assessment=stubs.assessment(m.id, m.env_id),  # STUB → BE-11
    )


@router.get(
    "/members/{member_id}/measurements",
    response_model=list[Measurement],
    tags=["measurements"],
    summary="Serie temporal de mediciones (orden: taken_at)",
    description="Filtros opcionales por indicador y por intervalo de `taken_at` (inclusivo). "
    "`from` posterior a `to` → 422.",
)
def list_measurements(
    member_id: int,
    session: SessionDep,
    indicator_id: Slug | None = None,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
) -> list[Measurement]:
    _member(session, member_id)
    if from_ and to and measurements.as_utc(from_) > measurements.as_utc(to):
        raise HTTPException(422, "`from` no puede ser posterior a `to`")
    rows = measurements.list_series(session, member_id, indicator_id, from_, to)
    return [measurements.to_schema(r) for r in rows]


@router.get(
    "/members/{member_id}/assessment",
    response_model=Assessment,
    tags=["assessment"],
    summary="Evaluación del member",
    description="Con `env` se evalúa con otro perfil sin modificar datos. STUB(FS-02) → BE-11",
)
def get_assessment(member_id: int, session: SessionDep, env: Slug | None = None) -> Assessment:
    m = _member(session, member_id)
    return stubs.assessment(m.id, env or m.env_id)


@router.post(
    "/members/{member_id}/heartbeat",
    response_model=HeartbeatResult,
    tags=["liveness"],
    summary="Señal de vida del dispositivo del member",
    description="Actualiza también el registro del dispositivo. STUB(FS-02) → BE-12/BE-29",
)
def heartbeat(member_id: int, body: HeartbeatIn, session: SessionDep) -> HeartbeatResult:
    _member(session, member_id)
    return HeartbeatResult(liveness="active", checkin_required=False)


@router.post(
    "/members/{member_id}/ruok",
    response_model=RuokResult,
    tags=["liveness"],
    summary="Respuesta al check-in 'R U OK?'",
    description="STUB(FS-02) → BE-16",
)
def ruok(member_id: int, body: RuokIn, session: SessionDep) -> RuokResult:
    _member(session, member_id)
    return RuokResult(liveness="active", alert_id=None if body.ok else stubs.ALERT_ID)
