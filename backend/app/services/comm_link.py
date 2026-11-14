"""Enlace simulado con la Tierra (BE-13): store-and-forward al estilo DTN.

Ver docs/alerts-and-escalation.md ("Enlace simulado con el control externo").

Estados del enlace (tabla `link_state`, uno por entorno):
- `online`: retardo prácticamente nulo (el natural si es < 5 s, como la Luna; si no, 0).
- `delayed`: retardo del entorno (`comm_delay_s`, o `delay_override_s` si se fija).
- `los` (pérdida de señal): todo lo que se envía se encola y sale al volver el enlace.
Por defecto: `delayed` si `comm_delay_s >= 5`, si no `online`.

Estados de un mensaje (tabla `link_message`, persistente: sobrevive a reinicios):
`queued` (esperando enlace, en LOS) → `in_transit` (enviado, con ETA) → `delivered`.

No hay planificador en segundo plano: la entrega se calcula con el reloj de la
demo (`clock.now()`) cada vez que se consulta el enlace o se avanza el reloj
(`deliver_due`). Así funciona con el fast-forward y es determinista.
"""

from collections.abc import Sequence
from datetime import timedelta
from typing import Any

from sqlmodel import Session, col, select

from app import clock, models
from app.schemas import Environment, LinkStatus
from app.schemas import LinkMessage as LinkMessageOut
from app.schemas.common import EventType, LinkDirection, LinkState
from app.services import environments, events

REALTIME_MAX_DELAY_S = 5  # docs/alerts-and-escalation.md: < 5 s → realtime


class UnknownEnvironment(Exception):
    """El entorno no existe en environments.json (→ 404)."""


def _env(env_id: str) -> Environment:
    env = environments.get_environment(env_id)
    if env is None:
        raise UnknownEnvironment(f"Entorno desconocido: {env_id}")
    return env


def get_state(session: Session, env_id: str) -> models.LinkState:
    """Estado del enlace del entorno; si no hay fila, se crea con el estado por defecto."""
    env = _env(env_id)
    row = session.get(models.LinkState, env_id)
    if row is None:
        default = (
            LinkState.delayed if env.comm_delay_s >= REALTIME_MAX_DELAY_S else LinkState.online
        )
        row = models.LinkState(env_id=env_id, state=default, since=clock.now())
        session.add(row)
        session.commit()
        session.refresh(row)
    return row


def delay_s(env: Environment, row: models.LinkState) -> int:
    """Retardo de ida actual.

    - `delayed` y `los`: el del entorno (o `delay_override_s`).
    - `online`: prácticamente nulo. Se conserva el retardo natural si ya es menor
      que 5 s (Luna: 1 s); si se fuerza `online` en un entorno lejano (Marte), 0.
    """
    natural = row.delay_override_s if row.delay_override_s is not None else env.comm_delay_s
    if row.state == LinkState.online:
        return natural if natural < REALTIME_MAX_DELAY_S else 0
    return natural


def send(
    session: Session,
    env_id: str,
    direction: LinkDirection | str,
    kind: str,
    ref_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> models.LinkMessage:
    """Envía un mensaje por el enlace. En LOS queda en cola hasta que vuelva."""
    env = _env(env_id)
    row = get_state(session, env_id)
    now = clock.now()
    message = models.LinkMessage(
        env_id=env_id,
        direction=LinkDirection(direction),
        kind=kind,
        ref_id=ref_id,
        payload=payload or {},
        sent_at=now,
        # En LOS la ETA es provisional: se recalcula al volver el enlace.
        eta=now + timedelta(seconds=delay_s(env, row)),
        state="queued" if row.state == LinkState.los else "in_transit",
    )
    session.add(message)
    session.flush()
    up = LinkDirection(direction) == LinkDirection.up
    events.emit(
        session, EventType.link_queued, env_id=env_id, ref_id=message.ref_id,
        summary=f"Mensaje en cola hacia {'tierra' if up else 'a bordo'}",
        payload={
            "message_id": message.id, "direction": "up" if up else "down", "kind": kind,
            "eta": message.eta.isoformat() if message.eta else None,
        },
    )
    session.commit()
    session.refresh(message)
    deliver_due(session, env_id)  # con retardo 0 se entrega al instante
    return message


def _member_of(session: Session, message: models.LinkMessage) -> int | None:
    """Member de la alerta a la que se refiere el mensaje (para el filtro del SSE)."""
    alert_id = message.ref_id
    if message.kind == "alert_event" and message.ref_id:
        ev = None
        if message.ref_id.isdigit():
            ev = session.get(models.AlertEvent, int(message.ref_id))
        alert_id = ev.alert_id if ev else None
    alert = session.get(models.Alert, alert_id) if alert_id else None
    return alert.member_id if alert else None


def deliver_due(session: Session, env_id: str | None = None) -> list[models.LinkMessage]:
    """Entrega los mensajes en tránsito cuya ETA ya ha pasado (no en LOS).

    `delivered_at` es la ETA: el instante real de llegada, aunque se compruebe
    más tarde (por ejemplo, después de un fast-forward).
    """
    env_ids = [env_id] if env_id is not None else [e.id for e in environments.list_environments()]
    now = clock.now()
    delivered: list[models.LinkMessage] = []
    for eid in env_ids:
        if get_state(session, eid).state == LinkState.los:
            continue
        due = session.exec(
            select(models.LinkMessage).where(
                models.LinkMessage.env_id == eid,
                models.LinkMessage.state == "in_transit",
                col(models.LinkMessage.eta) <= now,
            )
        ).all()
        for message in due:
            message.state = "delivered"
            message.delivered_at = message.eta
            session.add(message)
            delivered.append(message)
    if delivered:
        # Las alertas que llegan a tierra quedan marcadas como entregadas (BE-14).
        from app.services.alerts import on_link_delivered  # evita el ciclo de imports

        on_link_delivered(session, delivered)
        for message in delivered:
            events.emit(
                session, EventType.link_delivered, env_id=message.env_id,
                member_id=_member_of(session, message), ref_id=message.ref_id,
                summary=f"Entregado {'en tierra' if message.direction == 'up' else 'a bordo'}",
                payload={"message_id": message.id, "direction": message.direction,
                         "kind": message.kind},
            )
        session.commit()
    return delivered


def set_state(
    session: Session, env_id: str, state: LinkState | str
) -> models.LinkState:
    """Fuerza el estado del enlace (demo). Al salir de LOS, la cola se envía."""
    env = _env(env_id)
    row = get_state(session, env_id)
    previous, state = row.state, LinkState(state)
    now = clock.now()
    row.state = state
    row.since = now
    session.add(row)
    if previous == LinkState.los and state != LinkState.los:
        queued = session.exec(
            select(models.LinkMessage).where(
                models.LinkMessage.env_id == env_id, models.LinkMessage.state == "queued"
            )
        ).all()
        eta = now + timedelta(seconds=delay_s(env, row))
        for message in queued:
            message.state = "in_transit"
            message.eta = eta
            session.add(message)
    events.emit(
        session, EventType.link_state_changed, env_id=env_id,
        summary=f"Enlace {env_id}: {row.state}", payload={"state": row.state},
    )
    session.commit()
    session.refresh(row)
    deliver_due(session, env_id)
    return row


def status(session: Session, env_id: str) -> LinkStatus:
    """Estado del enlace para la API (entrega antes lo que ya ha llegado)."""
    env = _env(env_id)
    deliver_due(session, env_id)
    row = get_state(session, env_id)
    pending = session.exec(
        select(models.LinkMessage).where(
            models.LinkMessage.env_id == env_id, models.LinkMessage.state != "delivered"
        )
    ).all()
    return LinkStatus(
        env_id=env_id,
        state=row.state,
        delay_s=delay_s(env, row),
        queued=len(pending),
        since=row.since,
    )


def list_messages(
    session: Session, env_id: str, direction: LinkDirection | str | None = None
) -> Sequence[models.LinkMessage]:
    """Mensajes del enlace del entorno (pendientes y entregados), por orden de envío."""
    _env(env_id)
    deliver_due(session, env_id)
    query = select(models.LinkMessage).where(models.LinkMessage.env_id == env_id)
    if direction is not None:
        query = query.where(models.LinkMessage.direction == LinkDirection(direction))
    query = query.order_by(col(models.LinkMessage.sent_at), col(models.LinkMessage.id))
    return session.exec(query).all()


def to_schema(row: models.LinkMessage) -> LinkMessageOut:
    return LinkMessageOut(
        id=row.id,
        env_id=row.env_id,
        direction=row.direction,
        kind=row.kind,
        ref_id=row.ref_id,
        payload=row.payload,
        sent_at=row.sent_at,
        eta=row.eta,
        delivered_at=row.delivered_at,
        state=row.state,
    )
