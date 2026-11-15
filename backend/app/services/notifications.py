"""Notificaciones personalizadas a un member (operador o staff).

No son alertas: no escalan ni tienen estado. Se guardan como evento `notification.sent`
en el `event_log` (y salen por SSE al member, que la ve en su móvil). Idempotentes por el
UUID del cliente: mismo id y contenido → la misma; contenido distinto → conflicto.
"""

from __future__ import annotations

from sqlmodel import Session, col, select

from app import models
from app.schemas import NotificationIn
from app.schemas.common import EventType
from app.services import events


class NotificationConflict(Exception):
    """El id ya se usó con otro contenido o para otro member (409)."""


def send(
    session: Session, member: models.Member, body: NotificationIn, sender: models.UserAccount
) -> models.EventLog:
    content = {"title": body.title, "text": body.text, "level": body.level.value}
    existing = session.exec(
        select(models.EventLog).where(
            models.EventLog.type == EventType.notification_sent.value,
            models.EventLog.ref_id == str(body.id),
        )
    ).first()
    if existing is not None:
        same = {k: (existing.payload or {}).get(k) for k in content} == content
        if not same or existing.member_id != member.id:
            raise NotificationConflict("Ese id ya se usó con otra notificación")
        return existing
    row = events.emit(
        session,
        EventType.notification_sent,
        env_id=member.env_id,
        member_id=member.id,
        user_id=sender.id,
        ref_id=body.id,
        summary=body.title or body.text[:80],
        payload={**content, "from_role": sender.role, "from_name": sender.display_name},
    )
    session.commit()
    session.refresh(row)
    return row


def list_for(session: Session, member: models.Member, limit: int = 50) -> list[models.EventLog]:
    """Notificaciones del member, de la más reciente a la más antigua (las guarda el event_log)."""
    return list(
        session.exec(
            select(models.EventLog)
            .where(
                models.EventLog.type == EventType.notification_sent.value,
                models.EventLog.member_id == member.id,
            )
            .order_by(col(models.EventLog.id).desc())
            .limit(limit)
        ).all()
    )
