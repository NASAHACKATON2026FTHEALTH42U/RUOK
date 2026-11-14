"""Alertas, escalado y consola ground.

Reales: automáticas (BE-14), manuales y acciones (BE-15) y consola ground (BE-17).
Pendiente: BE-27 (SOS de emergencia sin token y rol de quien consulta).
"""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import models
from app.db import get_session
from app.routers.deps import ERRORS_404, ERRORS_AUTH, AuthDep
from app.schemas import (
    AckIn,
    Alert,
    AlertIn,
    AlertMessageIn,
    AlertStatus,
    EscalateIn,
    GroundView,
    ResolveIn,
    Slug,
)
from app.schemas.common import ErrorResponse
from app.services import alerts as alerts_service
from app.services import comm_link, ground

router = APIRouter(tags=["alerts"], dependencies=[AuthDep], responses={**ERRORS_AUTH, **ERRORS_404})


SessionDep = Annotated[Session, Depends(get_session)]
ERRORS_409 = {
    409: {"model": ErrorResponse, "description": "Mismo id con otro contenido, o alerta resuelta"}
}


def _alert(session: Session, alert_id: UUID) -> models.Alert:
    try:
        return alerts_service.get_alert(session, alert_id)
    except alerts_service.AlertNotFound as exc:
        raise HTTPException(404, str(exc)) from exc


def _run(session: Session, fn, *args, **kwargs) -> Alert:
    """Ejecuta una acción del servicio y traduce sus errores a HTTP."""
    try:
        alert = fn(session, *args, **kwargs)
    except alerts_service.AlertConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except alerts_service.InvalidAlert as exc:
        raise HTTPException(422, str(exc)) from exc
    return alerts_service.to_schema(session, alert)


@router.get(
    "/members/{member_id}/alerts",
    response_model=list[Alert],
    summary="Alertas del member",
    description="Alertas del member (las más recientes primero) con su timeline. Las automáticas "
    "son reales (BE-14); las manuales llegan con BE-15.",
)
def list_member_alerts(
    member_id: int,
    session: Annotated[Session, Depends(get_session)],
    status: AlertStatus | None = None,
) -> list[Alert]:
    member = session.get(models.Member, member_id)
    if member is None:
        raise HTTPException(404, f"Member desconocido: {member_id}")
    comm_link.deliver_due(session, member.env_id)  # marca las que ya han llegado a tierra
    rows = alerts_service.list_for_member(session, member_id, status)
    return [alerts_service.to_schema(session, a) for a in rows]


@router.post(
    "/members/{member_id}/alerts",
    response_model=Alert,
    responses=ERRORS_409,
    summary="Pedir ayuda / SOS (idempotente por UUID)",
    description="Idempotente por el UUID del cliente (mismo id y contenido → la misma alerta; "
    "contenido distinto → 409). Destino: `target_role` (se pueden saltar niveles); si no, "
    "emergency/critical suben hasta el primer nivel externo (a bordo al instante, tierra por "
    "el enlace) y warning va a la tripulación. El SOS sin token llega con BE-27.",
)
def create_alert(member_id: int, body: AlertIn, session: SessionDep) -> Alert:
    member = session.get(models.Member, member_id)
    if member is None:
        raise HTTPException(404, f"Member desconocido: {member_id}")
    try:
        alert, _created = alerts_service.create_manual(session, member, body)
    except alerts_service.AlertConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except alerts_service.InvalidAlert as exc:
        raise HTTPException(422, str(exc)) from exc
    return alerts_service.to_schema(session, alert)


@router.post(
    "/alerts/{alert_id}/escalate",
    response_model=Alert,
    responses=ERRORS_409,
    summary="Escalar (por defecto al siguiente nivel; permite saltar niveles)",
    description="Los niveles externos salen por el enlace con su ETA. 422 si el destino no "
    "está en la escalera o ya está en el último nivel; 409 si está resuelta.",
)
def escalate(alert_id: UUID, body: EscalateIn, session: SessionDep) -> Alert:
    alert = _alert(session, alert_id)
    return _run(session, alerts_service.escalate, alert, body.target_role, body.message)


@router.post(
    "/alerts/{alert_id}/ack",
    response_model=Alert,
    responses=ERRORS_409,
    summary="Reconocer la alerta",
)
def ack(alert_id: UUID, body: AckIn, session: SessionDep) -> Alert:
    return _run(session, alerts_service.acknowledge, _alert(session, alert_id), body.actor)


@router.post(
    "/alerts/{alert_id}/resolve",
    response_model=Alert,
    responses=ERRORS_409,
    summary="Resolver la alerta",
)
def resolve(alert_id: UUID, body: ResolveIn, session: SessionDep) -> Alert:
    alert = _alert(session, alert_id)
    return _run(session, alerts_service.resolve, alert, body.actor, body.note)


@router.post(
    "/alerts/{alert_id}/messages",
    response_model=Alert,
    summary="Mensaje en la alerta (viaja por el enlace si va a tierra)",
    description="Si la alerta está en un nivel externo, el mensaje viaja por el enlace "
    "(member → tierra, responder → a bordo) y el evento lleva su ETA.",
)
def add_message(alert_id: UUID, body: AlertMessageIn, session: SessionDep) -> Alert:
    alert = _alert(session, alert_id)
    return _run(session, alerts_service.add_message, alert, body.actor, body.text)


@router.get(
    "/environments/{env_id}/alerts",
    response_model=GroundView,
    summary="Consola /ground: solo lo ENTREGADO por el enlace, con estado as-of",
    description="Alertas que el enlace ya ha entregado a tierra, members con su resumen y "
    "`as_of` = ahora − retardo (en LOS, el último momento conocido y estado `unknown`). "
    "El detalle conductual se oculta salvo que el member lo comparta o sea una emergencia.",
)
def ground_view(
    env_id: Slug,
    session: SessionDep,
    view: Literal["ground"] = "ground",
) -> GroundView:
    try:
        # TODO(BE-27): pasar el rol de quien consulta (psych ve el detalle conductual).
        return ground.ground_view(session, env_id)
    except comm_link.UnknownEnvironment as exc:
        raise HTTPException(404, str(exc)) from exc
