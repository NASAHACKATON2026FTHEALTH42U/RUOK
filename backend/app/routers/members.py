"""Members, mediciones, evaluación y liveness.

Reales: members (BE-05), mediciones (BE-06), assessment (BE-11) y heartbeat (BE-12).
STUB(FS-02) → BE-16 (R U OK?).
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app import models
from app.db import get_session
from app.routers.deps import (
    ERRORS_404,
    ERRORS_409,
    ERRORS_AUTH,
    AuthDep,
    CurrentUser,
    allow_env,
    allow_member,
)
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
from app.services import alerts, environments, liveness, measurements, members
from app.services.member_assessment import UnknownEnvironment, assess_member, for_viewer

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
    "`liveness`, `overall_status` y `open_alerts` reales (BE-12, BE-11, BE-14).",
    dependencies=[Depends(allow_env("members:list"))],
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
    dependencies=[Depends(allow_member("member:read"))],
)
def get_member(member_id: int, session: SessionDep) -> Member:
    return members.to_schema(_member(session, member_id))


@router.patch(
    "/members/{member_id}/privacy",
    response_model=Member,
    tags=["members"],
    summary="Compartir o no los detalles conductuales (solo el propio member)",
    description="Se guarda en la BD. Solo el propio member (403 para cualquier otro rol).",
    dependencies=[Depends(allow_member("privacy:write"))],
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
    "no se guarda ninguna. Devuelve el `assessment` recalculado con el lote ya guardado.",
)
def post_measurements(
    member_id: int,
    body: MeasurementBatchIn,
    session: SessionDep,
    user: Annotated[models.UserAccount, Depends(allow_member("measurements:write"))],
) -> MeasurementBatchResult:
    m = _member(session, member_id)
    try:
        accepted, duplicates = measurements.save_batch(session, m.id, body.measurements)
    except measurements.InvalidMeasurement as exc:
        raise HTTPException(422, str(exc)) from exc
    except measurements.MeasurementConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    assessment = assess_member(session, m)
    alerts.evaluate(session, m, assessment)  # abre, actualiza o escala alertas (BE-14)
    return MeasurementBatchResult(
        accepted=accepted,
        duplicates=duplicates,
        assessment=for_viewer(session, assessment, m, user),
    )


@router.get(
    "/members/{member_id}/measurements",
    response_model=list[Measurement],
    tags=["measurements"],
    summary="Serie temporal de mediciones (orden: taken_at)",
    description="Filtros opcionales por indicador y por intervalo de `taken_at` (inclusivo). "
    "`from` posterior a `to` → 422.",
    dependencies=[Depends(allow_member("history:read"))],
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
    description="Con `env` se evalúa con otro perfil sin modificar datos; "
    "un `env` inexistente → 404. Si `behavioral.details_visible` es false, los "
    "indicadores conductuales no aparecen en `systems[].indicators` (solo el estado agregado).",
)
def get_assessment(
    member_id: int,
    session: SessionDep,
    user: Annotated[models.UserAccount, Depends(allow_member("history:read"))],
    env: Slug | None = None,
) -> Assessment:
    m = _member(session, member_id)
    try:
        # Detalles conductuales según quién consulta (BE-20 + BE-27).
        return for_viewer(session, assess_member(session, m, env), m, user)
    except UnknownEnvironment as exc:
        raise HTTPException(404, f"Entorno desconocido: {exc}") from exc


@router.post(
    "/members/{member_id}/heartbeat",
    response_model=HeartbeatResult,
    tags=["liveness"],
    summary="Señal de vida del dispositivo del member",
    description="Actualiza `last_seen_at` y la actividad del member y el registro del "
    "dispositivo. `checkin_required` es true si el member venía de `stale` o `lost`.",
    dependencies=[Depends(allow_member("heartbeat:write"))],
)
def heartbeat(
    member_id: int, body: HeartbeatIn, session: SessionDep, user: CurrentUser
) -> HeartbeatResult:
    m = _member(session, member_id)
    return liveness.record_heartbeat(session, m, body, user=user)


@router.post(
    "/members/{member_id}/ruok",
    response_model=RuokResult,
    tags=["liveness"],
    summary="Respuesta al check-in 'R U OK?'",
    description="Cierra el check-in pendiente y cuenta como señal de vida. ok=false "
    "('Necesito ayuda') crea una alerta critical y devuelve su id; ok=true resuelve la "
    "alerta no_contact abierta.",
    dependencies=[Depends(allow_member("checkin:write"))],
)
def ruok(member_id: int, body: RuokIn, session: SessionDep) -> RuokResult:
    # Import local: así esta PR no toca la línea de imports que también cambia BE-20 (#152).
    from app.services.liveness_watch import answer_ruok

    m = _member(session, member_id)
    return answer_ruok(session, m, body.ok, body.note)
