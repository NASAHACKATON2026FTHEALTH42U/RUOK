"""Mensaje a casa (BE-22): mensajes personales del member por el enlace con la Tierra.

Ver docs/behavioral-health.md ("Conexión con la Tierra").

- El mensaje del member sale como `link_message` (`kind=home_message`, `direction=up`):
  con retardo en Marte y en cola si hay LOS (``comm_link.send``).
- Cuando llega a la Tierra, "casa" responde (simulado): se programa un mensaje `down`
  que sale ``response_delay_s`` después y tarda otro retardo de ida en llegar. El texto
  sale de ``data/home_message_replies.json`` (configuración, no código) y se elige de
  forma determinista a partir del UUID del mensaje.
- El member solo ve las respuestas ya entregadas a bordo.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Iterable
from datetime import timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

from sqlmodel import Session, col, select

from app import models
from app.schemas import HomeMessage
from app.schemas.common import EventType, LinkDirection
from app.services import comm_link, environments, events

__all__ = ["KIND", "IdConflict", "list_thread", "on_link_delivered", "send"]

KIND = "home_message"
REPLIES_FILE = Path(__file__).resolve().parent.parent / "data" / "home_message_replies.json"
_REPLY_NS = uuid.UUID("5d0f6f0e-6f1b-4c57-9a52-0a1c2f6f7b10")


class IdConflict(Exception):
    """El mismo `id` ya se usó con otro texto u otro member (→ 409)."""


@lru_cache(maxsize=1)
def _config() -> dict[str, Any]:
    return json.loads(REPLIES_FILE.read_text(encoding="utf-8"))


def _messages(session: Session, env_id: str) -> list[models.LinkMessage]:
    return list(
        session.exec(
            select(models.LinkMessage)
            .where(models.LinkMessage.env_id == env_id, models.LinkMessage.kind == KIND)
            .order_by(col(models.LinkMessage.sent_at), col(models.LinkMessage.id))
        ).all()
    )


def send(
    session: Session, member: models.Member, message_id: uuid.UUID, text: str
) -> models.LinkMessage:
    """Envía el mensaje a casa. Idempotente por `message_id`."""
    ref = str(message_id)
    existing = session.exec(
        select(models.LinkMessage).where(
            models.LinkMessage.kind == KIND, models.LinkMessage.ref_id == ref
        )
    ).first()
    if existing is not None:
        same = (
            existing.direction == LinkDirection.up
            and existing.payload.get("member_id") == member.id
            and existing.payload.get("text") == text
        )
        if not same:
            raise IdConflict("Ese id ya se usó con otro mensaje")
        return existing
    return comm_link.send(
        session,
        member.env_id,
        LinkDirection.up,
        KIND,
        ref_id=ref,
        payload={"member_id": member.id, "text": text},
    )


def on_link_delivered(session: Session, delivered: Iterable[models.LinkMessage]) -> None:
    """Lo llama comm_link al entregar: los mensajes que llegan a la Tierra reciben respuesta."""
    cfg = _config()
    for message in delivered:
        if message.kind != KIND or message.direction != LinkDirection.up or not message.ref_id:
            continue
        reply_ref = str(uuid.uuid5(_REPLY_NS, message.ref_id))
        if session.exec(
            select(models.LinkMessage).where(
                models.LinkMessage.kind == KIND, models.LinkMessage.ref_id == reply_ref
            )
        ).first():
            continue
        env = environments.get_environment(message.env_id)
        row = comm_link.get_state(session, message.env_id)
        sent_at = message.delivered_at + timedelta(seconds=cfg["response_delay_s"])
        replies = cfg["replies"]
        text = replies[uuid.UUID(message.ref_id).int % len(replies)]
        session.add(
            models.LinkMessage(
                env_id=message.env_id,
                direction=LinkDirection.down,
                kind=KIND,
                ref_id=reply_ref,
                payload={
                    "member_id": message.payload.get("member_id"),
                    "text": text,
                    "sender": cfg["sender"],
                    "in_reply_to": message.ref_id,
                },
                sent_at=sent_at,
                eta=sent_at + timedelta(seconds=comm_link.delay_s(env, row)),
                state="in_transit",
            )
        )
        events.emit(
            session,
            EventType.link_queued,
            env_id=message.env_id,
            member_id=message.payload.get("member_id"),
            ref_id=reply_ref,
            summary="Respuesta de casa en camino",
            payload={"direction": "down", "kind": KIND},
        )


def _to_schema(row: models.LinkMessage) -> HomeMessage:
    p = row.payload
    return HomeMessage(
        id=row.ref_id,
        member_id=p["member_id"],
        direction=row.direction,
        text=p["text"],
        sender=p.get("sender"),
        in_reply_to=p.get("in_reply_to"),
        sent_at=row.sent_at,
        eta=row.eta,
        delivered_at=row.delivered_at,
        state=row.state,
    )


def to_schema(row: models.LinkMessage) -> HomeMessage:
    return _to_schema(row)


def list_thread(session: Session, member: models.Member) -> list[HomeMessage]:
    """Lo enviado por el member y las respuestas ya entregadas, por orden de envío."""
    comm_link.deliver_due(session, member.env_id)
    comm_link.deliver_due(session, member.env_id)  # una respuesta con ETA pasada (fast-forward)
    return [
        _to_schema(r)
        for r in _messages(session, member.env_id)
        if r.payload.get("member_id") == member.id
        and (r.direction == LinkDirection.up or r.state == "delivered")
    ]
