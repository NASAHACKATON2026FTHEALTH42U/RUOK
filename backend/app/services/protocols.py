"""Protocolos de respuesta completados (alertas): puntos, registro y notificación.

Cuando el member hace todos los pasos de un protocolo (una intervención del catálogo):

- **Puntos:** se crea una tarea del día (`task_type = "protocol"`) ya completada, con los puntos
  de `protocol` en `app/data/task_types.json`. Así suma igual que el resto de la rutina (puntos,
  racha, insignias y tripulación) y sale en «Tareas de hoy». Cuenta **una vez por alerta y
  protocolo**; sin alerta, una vez al día.
- **Registro:** `task.completed` en el `event_log` (centro de control) y, si responde a una
  alerta, un mensaje del member en su línea de tiempo (viaja por el enlace si la alerta ya está
  en un nivel externo).
- **Notificación:** `notification.sent` del sistema al member, que queda en su historial.

Idempotente por el UUID del completado: reenviarlo no suma ni avisa dos veces.
"""

from __future__ import annotations

from datetime import UTC
from uuid import NAMESPACE_URL, uuid5

from sqlmodel import Session

from app import models
from app.schemas import ProtocolCompleteIn
from app.schemas.common import EventType
from app.services import alerts, catalog, events, routine

PROTOCOL_TYPE = "protocol"


class ProtocolNotFound(Exception):
    """El protocolo (intervención) o la alerta no existen para ese member (→ 404)."""


def _task_id(member: models.Member, intervention_id: str, body: ProtocolCompleteIn) -> str:
    day = body.completed_at.date().isoformat()
    scope = f"a{body.alert_id}" if body.alert_id else f"d{day}"
    return f"p_{scope}_{member.id}_{intervention_id}"


def complete(
    session: Session, member: models.Member, intervention_id: str, body: ProtocolCompleteIn
) -> bool:
    """Registra el protocolo hecho. True si es nuevo (suma puntos y avisa)."""
    intervention = catalog.get_intervention(intervention_id)
    if intervention is None:
        raise ProtocolNotFound(f"Protocolo desconocido: {intervention_id}")
    alert = None
    if body.alert_id:
        alert = session.get(models.Alert, body.alert_id)
        if alert is None or alert.member_id != member.id:
            raise ProtocolNotFound(f"Alerta desconocida: {body.alert_id}")

    cid = str(body.id)
    previous = session.get(models.TaskCompletion, cid)
    if previous is not None:
        if previous.task_id != _task_id(member, intervention_id, body):
            raise routine.CompletionConflict(f"El completado {cid} ya se usó para otra cosa")
        return False
    tid = _task_id(member, intervention_id, body)
    if session.get(models.Task, tid) is not None:
        return False  # ese protocolo ya contó para esta alerta (o este día)

    completed_at = body.completed_at
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=UTC)
    kind = routine.task_type(PROTOCOL_TYPE)
    points = kind.points if kind else 0
    task = models.Task(
        id=tid,
        member_id=member.id,
        date=completed_at.date(),
        task_type=PROTOCOL_TYPE,
        title=f"Protocolo: {intervention.title}",
        points=points,
    )
    session.add(task)
    session.flush()
    routine.add_completion(session, member, task, cid, completed_at)

    title = "Protocolo completado"
    text = f"«{intervention.title}»: +{points} puntos para la tripulación."
    events.emit(
        session,
        EventType.notification_sent,
        env_id=member.env_id,
        member_id=member.id,
        ref_id=str(uuid5(NAMESPACE_URL, f"ruok:protocol:{cid}")),
        summary=f"{member.name}: {title.lower()} «{intervention.title}» (+{points})",
        payload={
            "title": title,
            "text": text,
            "level": "info",
            "from_role": "system",
            "from_name": "R U OK?",
            "points": points,
            "intervention_id": intervention.id,
            "alert_id": body.alert_id,
        },
    )
    if alert is not None:
        # add_message hace commit de todo (tarea, completado y eventos).
        alerts.add_message(
            session, alert, "member", f"He completado el protocolo «{intervention.title}»."
        )
    else:
        session.commit()
    return True
