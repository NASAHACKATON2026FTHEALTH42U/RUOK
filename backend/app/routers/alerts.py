"""Alertas, escalado y consola ground.

STUB(FS-02) → BE-14 (automáticas), BE-15 (manuales y acciones), BE-17 (consola ground)
y BE-27 (SOS de emergencia sin token). En la consola ground el `link` ya es real (BE-13).
"""

from datetime import timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import clock, models, stubs
from app.db import get_session
from app.routers.deps import ERRORS_404, ERRORS_AUTH, AuthDep
from app.schemas import (
    AckIn,
    Alert,
    AlertEvent,
    AlertIn,
    AlertMessageIn,
    AlertStatus,
    EscalateIn,
    GroundView,
    ResolveIn,
    Slug,
)
from app.services import alerts as alerts_service
from app.services import comm_link

router = APIRouter(tags=["alerts"], dependencies=[AuthDep], responses={**ERRORS_AUTH, **ERRORS_404})


def _alert(alert_id: UUID) -> Alert:
    if alert_id != stubs.ALERT_ID:
        raise HTTPException(404, f"Alerta desconocida: {alert_id}")
    return stubs.alert()


def _with_event(
    alert: Alert, type_: str, actor: str, status: AlertStatus | None = None, **payload
) -> Alert:
    ev = AlertEvent(type=type_, actor=actor, at=clock.now(), payload=payload)
    update = {"events": [*alert.events, ev], "updated_at": ev.at}
    if status:
        update["status"] = status
    return alert.model_copy(update=update)


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
    summary="Pedir ayuda / SOS (idempotente por UUID)",
    description="Con `category=emergency` se acepta SIN token y la alerta queda con "
    "`authenticated=false`. STUB(FS-02) → BE-15/BE-27",
)
def create_alert(member_id: int, body: AlertIn) -> Alert:
    now = clock.now()
    return stubs.alert(member_id).model_copy(
        update={
            "id": body.id,
            "category": body.category,
            "severity": body.severity,
            "message": body.message or "",
            "system_id": body.system_id,
            "target_role": body.target_role or "crew",
            "created_at": now,
            "updated_at": now,
            "events": [AlertEvent(type="created", actor="member", at=now)],
        }
    )


@router.post(
    "/alerts/{alert_id}/escalate",
    response_model=Alert,
    summary="Escalar (por defecto al siguiente nivel; permite saltar niveles)",
    description="STUB(FS-02) → BE-15",
)
def escalate(alert_id: UUID, body: EscalateIn) -> Alert:
    a = _alert(alert_id)
    a = a.model_copy(
        update={"level": a.level + 1, "target_role": body.target_role or a.target_role}
    )
    return _with_event(a, "escalated", "member", AlertStatus.escalated, message=body.message)


@router.post(
    "/alerts/{alert_id}/ack",
    response_model=Alert,
    summary="Reconocer la alerta",
    description="STUB(FS-02) → BE-15",
)
def ack(alert_id: UUID, body: AckIn) -> Alert:
    return _with_event(_alert(alert_id), "acknowledged", body.actor, AlertStatus.acknowledged)


@router.post(
    "/alerts/{alert_id}/resolve",
    response_model=Alert,
    summary="Resolver la alerta",
    description="STUB(FS-02) → BE-15",
)
def resolve(alert_id: UUID, body: ResolveIn) -> Alert:
    return _with_event(
        _alert(alert_id), "resolved", body.actor, AlertStatus.resolved, note=body.note
    )


@router.post(
    "/alerts/{alert_id}/messages",
    response_model=Alert,
    summary="Mensaje en la alerta (viaja por el enlace si va a tierra)",
    description="STUB(FS-02) → BE-15",
)
def add_message(alert_id: UUID, body: AlertMessageIn) -> Alert:
    return _with_event(_alert(alert_id), "message", body.actor, text=body.text)


@router.get(
    "/environments/{env_id}/alerts",
    response_model=GroundView,
    summary="Consola /ground: solo lo ENTREGADO por el enlace, con estado as-of",
    description="STUB(FS-02) → BE-17",
)
def ground_view(
    env_id: Slug,
    session: Annotated[Session, Depends(get_session)],
    view: Literal["ground"] = "ground",
) -> GroundView:
    env = stubs.ENV_BY_ID.get(env_id)
    if env is None:
        raise HTTPException(404, f"Entorno desconocido: {env_id}")
    return GroundView(
        env_id=env_id,
        as_of=clock.now() - timedelta(seconds=env.comm_delay_s),
        link=comm_link.status(session, env_id),  # real (BE-13)
        members=[stubs.member_summary(m) for m in stubs.MEMBERS if m.env_id == env_id],
        alerts=[],  # la alerta de ejemplo sigue en cola (ETA 14 min): aún no entregada
    )
