"""Alertas, escalado y consola ground.

Reales: automáticas (BE-14), manuales y acciones (BE-15) y consola ground (BE-17).

Permisos (BE-27): la autenticación va por endpoint y no en el router, porque el SOS de
emergencia se acepta SIN token (docs/auth-and-roles.md: "el SOS nunca depende del login").
"""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import i18n, models
from app.db import get_session
from app.routers.deps import (
    ERRORS_404,
    ERRORS_AUTH,
    CurrentUser,
    OptionalUser,
    allow_alert,
    allow_env,
    allow_member,
    check,
    check_member,
)
from app.schemas import (
    AckIn,
    Alert,
    AlertIn,
    AlertMessageIn,
    AlertStatus,
    EscalateIn,
    Event,
    GroundView,
    NotificationIn,
    ResolveIn,
    Slug,
)
from app.schemas.common import ErrorResponse
from app.services import alerts as alerts_service
from app.services import comm_link, events, ground, notifications

router = APIRouter(tags=["alerts"], responses={**ERRORS_AUTH, **ERRORS_404})


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
    dependencies=[Depends(allow_member("alerts:read"))],
)
def list_member_alerts(
    member_id: int,
    session: Annotated[Session, Depends(get_session)],
    status: AlertStatus | None = None,
) -> list[Alert]:
    member = session.get(models.Member, member_id)
    if member is None:
        raise HTTPException(404, i18n.tr("Member desconocido: {id}", id=member_id))
    comm_link.deliver_due(session, member.env_id)  # marca las que ya han llegado a tierra
    rows = alerts_service.list_for_member(session, member_id, status)
    return [alerts_service.to_schema(session, a) for a in rows]


def _may_create(user: models.UserAccount | None, member: models.Member, *, emergency: bool) -> bool:
    """True si la petición va autenticada y con permiso; False si es un SOS sin sesión.

    Fuera de una emergencia, sin sesión → 401 y sin permiso → 403.
    """
    if user is None:
        if emergency:
            return False
        raise HTTPException(
            401, i18n.tr("Falta el token de sesión"), headers={"WWW-Authenticate": "Bearer"}
        )
    try:
        check(user, "alerts:create")
        check_member(user, member)
    except HTTPException:
        if emergency:
            return False  # el SOS nunca se rechaza por permisos
        raise
    return True


@router.post(
    "/members/{member_id}/alerts",
    response_model=Alert,
    responses=ERRORS_409,
    summary="Pedir ayuda / SOS (idempotente por UUID)",
    description="Idempotente por el UUID del cliente (mismo id y contenido → la misma alerta; "
    "contenido distinto → 409). Destino: `target_role` (se pueden saltar niveles); si no, "
    "emergency/critical suben hasta el primer nivel externo (a bordo al instante, tierra por "
    "el enlace) y warning va a la tripulación. Con `category=emergency` se acepta SIN token "
    "(o con un token sin permiso sobre ese member) y la alerta queda `authenticated=false`.",
)
def create_alert(member_id: int, body: AlertIn, session: SessionDep, user: OptionalUser) -> Alert:
    member = session.get(models.Member, member_id)
    if member is None:
        raise HTTPException(404, i18n.tr("Member desconocido: {id}", id=member_id))
    authenticated = _may_create(user, member, emergency=body.category == "emergency")
    try:
        alert, _created = alerts_service.create_manual(
            session,
            member,
            body,
            authenticated=authenticated,
            created_by_user_id=user.id if authenticated else None,
        )
    except alerts_service.AlertConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    except alerts_service.InvalidAlert as exc:
        raise HTTPException(422, str(exc)) from exc
    return alerts_service.to_schema(session, alert)


@router.post(
    "/members/{member_id}/notifications",
    response_model=Event,
    responses=ERRORS_409,
    summary="Notificación personalizada a un member (idempotente por UUID)",
    description="Del operador o del staff (medic, commander) a un member de su entorno. No es "
    "una alerta: no escala ni tiene estado. Se guarda como evento `notification.sent` y le "
    "llega por SSE. Mismo `id` y contenido → la misma; contenido distinto → 409.",
)
def send_notification(
    member_id: int, body: NotificationIn, session: SessionDep, user: CurrentUser
) -> Event:
    member = session.get(models.Member, member_id)
    if member is None:
        raise HTTPException(404, i18n.tr("Member desconocido: {id}", id=member_id))
    check(user, "notifications:send")
    check_member(user, member)
    try:
        row = notifications.send(session, member, body, user)
    except notifications.NotificationConflict as exc:
        raise HTTPException(409, str(exc)) from exc
    return events.to_schema(row)


@router.get(
    "/members/{member_id}/notifications",
    response_model=list[Event],
    summary="Notificaciones recibidas por un member (las más recientes primero)",
    description="Las notificaciones personalizadas que ha recibido (eventos `notification.sent` "
    "del `event_log`, que se guardan 7 días). Las ve el propio member y el staff de su entorno.",
    dependencies=[Depends(allow_member("alerts:read"))],
)
def list_notifications(member_id: int, session: SessionDep) -> list[Event]:
    member = session.get(models.Member, member_id)
    if member is None:
        raise HTTPException(404, i18n.tr("Member desconocido: {id}", id=member_id))
    return [events.to_schema(r) for r in notifications.list_for(session, member)]


@router.post(
    "/alerts/{alert_id}/escalate",
    response_model=Alert,
    responses=ERRORS_409,
    summary="Escalar (por defecto al siguiente nivel; permite saltar niveles)",
    description="Los niveles externos salen por el enlace con su ETA. 422 si el destino no "
    "está en la escalera o ya está en el último nivel; 409 si está resuelta.",
    dependencies=[Depends(allow_alert("alerts:escalate"))],
)
def escalate(alert_id: UUID, body: EscalateIn, session: SessionDep) -> Alert:
    alert = _alert(session, alert_id)
    return _run(session, alerts_service.escalate, alert, body.target_role, body.message)


@router.post(
    "/alerts/{alert_id}/ack",
    response_model=Alert,
    responses=ERRORS_409,
    summary="Reconocer la alerta",
    dependencies=[Depends(allow_alert("alerts:ack"))],
)
def ack(alert_id: UUID, body: AckIn, session: SessionDep) -> Alert:
    return _run(session, alerts_service.acknowledge, _alert(session, alert_id), body.actor)


@router.post(
    "/alerts/{alert_id}/resolve",
    response_model=Alert,
    responses=ERRORS_409,
    summary="Resolver la alerta",
    dependencies=[Depends(allow_alert("alerts:ack"))],
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
    dependencies=[Depends(allow_alert("alerts:message"))],
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
    "El detalle conductual se oculta salvo que el member lo comparta, sea una emergencia "
    "o quien consulta sea `psych`.",
)
def ground_view(
    env_id: Slug,
    session: SessionDep,
    user: Annotated[models.UserAccount, Depends(allow_env("ground:read"))],
    view: Literal["ground"] = "ground",
) -> GroundView:
    try:
        return ground.ground_view(session, env_id, viewer_role=user.role)
    except comm_link.UnknownEnvironment as exc:
        raise HTTPException(404, str(exc)) from exc
