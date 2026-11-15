"""Bitácora de eventos y bus en tiempo real (BE-28, docs/control-center-and-devices.md §3).

- ``emit(session, type, ...)`` añade una fila a ``event_log`` **en la transacción del
  cambio** (sin commit). Se publica al hacer commit: si la operación hace rollback, no
  sale ningún evento.
- El bus es en memoria (asyncio): cada stream SSE espera un ``asyncio.Event`` que se
  despierta, de forma segura entre hilos, tras cada commit con eventos nuevos. El stream
  lee siempre de la BD (``id > último``): reconectar con ``Last-Event-ID`` no pierde nada.
- ``visible_to``: filtro por rol (admin todo; medic/commander su entorno; member lo suyo;
  responder/psych solo lo entregado por el enlace). ``auth.*`` solo lo ve admin.
- Purga: los eventos de más de 7 días se borran al arrancar y cada ``PURGE_EVERY`` eventos.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from sqlalchemy import event as sa_event
from sqlalchemy.orm import Session as SASession
from sqlmodel import Session, col, delete, select

from app import clock, models
from app.schemas import Event, EventType

__all__ = [
    "RETENTION",
    "Viewer",
    "emit",
    "emit_alert",
    "fetch_since",
    "last_id",
    "purge_old",
    "subscribe",
    "to_schema",
    "unsubscribe",
    "visible_to",
]

log = logging.getLogger(__name__)

RETENTION = timedelta(days=7)
PURGE_EVERY = 200
_PENDING = "ruok_events_pending"

# Lo que ven responder y psych: solo lo que el enlace ya ha entregado (y su estado).
_DELIVERED_TYPES = {EventType.link_delivered.value, EventType.link_state_changed.value}
_ADMIN_ONLY_PREFIX = "auth."


# ── Emitir ───────────────────────────────────────────────────────────


def emit(
    session: Session,
    type_: EventType | str,
    *,
    env_id: str | None = None,
    member_id: int | None = None,
    user_id: int | None = None,
    device_id: str | uuid.UUID | None = None,
    ref_id: str | uuid.UUID | None = None,
    summary: str = "",
    payload: dict[str, Any] | None = None,
) -> models.EventLog:
    """Guarda el evento en la sesión (sin commit). Se publica tras el commit."""
    row = models.EventLog(
        type=EventType(type_).value,
        at=clock.now(),
        env_id=env_id,
        member_id=member_id,
        user_id=user_id,
        device_id=str(device_id) if device_id else None,
        ref_id=str(ref_id) if ref_id else None,
        summary=summary,
        payload=payload or {},
    )
    session.add(row)
    session.flush()  # id ya asignado (Last-Event-ID)
    session.info[_PENDING] = True
    if row.id and row.id % PURGE_EVERY == 0:
        purge_old(session, commit=False)
    return row


def emit_alert(
    session: Session, alert: models.Alert, type_: EventType | str, summary: str, **payload
) -> models.EventLog:
    """Atajo para los eventos ``alert.*``: entorno, member y ``ref_id`` = id de la alerta.

    Lleva el nombre del member (``member_name``): el aviso en vivo dice quién necesita ayuda.
    """
    member = session.get(models.Member, alert.member_id)
    return emit(
        session,
        type_,
        env_id=alert.env_id,
        member_id=alert.member_id,
        user_id=alert.created_by_user_id,
        ref_id=alert.id,
        summary=summary,
        payload={
            "category": alert.category,
            "severity": alert.severity,
            "level": alert.level,
            "target_role": alert.target_role,
            "member_name": member.name if member else None,
            **payload,
        },
    )


def purge_old(session: Session, *, commit: bool = True) -> None:
    """Borra los eventos de más de 7 días (reloj de la demo)."""
    cutoff = clock.now() - RETENTION
    session.exec(delete(models.EventLog).where(col(models.EventLog.at) < cutoff))
    if commit:
        session.commit()


# ── Bus en memoria ───────────────────────────────────────────────────

_waiters: set[tuple[asyncio.AbstractEventLoop, asyncio.Event]] = set()
_lock = threading.Lock()


def subscribe() -> asyncio.Event:
    """Un ``asyncio.Event`` que se activa cuando hay eventos nuevos (llamar en el loop)."""
    waiter = asyncio.Event()
    with _lock:
        _waiters.add((asyncio.get_running_loop(), waiter))
    return waiter


def unsubscribe(waiter: asyncio.Event) -> None:
    with _lock:
        for item in [w for w in _waiters if w[1] is waiter]:
            _waiters.discard(item)


def _notify() -> None:
    with _lock:
        waiters = list(_waiters)
    for loop, waiter in waiters:
        try:
            loop.call_soon_threadsafe(waiter.set)
        except RuntimeError:  # el loop ya se ha cerrado
            unsubscribe(waiter)


@sa_event.listens_for(SASession, "after_commit")
def _after_commit(session: SASession) -> None:
    if session.info.pop(_PENDING, False):
        _notify()


@sa_event.listens_for(SASession, "after_rollback")
def _after_rollback(session: SASession) -> None:
    session.info.pop(_PENDING, None)


# ── Leer y filtrar ───────────────────────────────────────────────────


@dataclass(frozen=True)
class Viewer:
    """Quién recibe el stream (copiado del token: la sesión de la BD no vive tanto)."""

    user_id: int
    role: str
    env_id: str | None
    member_id: int | None

    @classmethod
    def of(cls, user: models.UserAccount) -> Viewer:
        return cls(user.id, user.role, user.env_id, user.member_id)


def visible_to(row: models.EventLog, viewer: Viewer) -> bool:
    if viewer.role == "admin":
        return True
    if row.type.startswith(_ADMIN_ONLY_PREFIX):
        return False
    if viewer.role in {"medic", "commander"}:
        return row.env_id is not None and row.env_id == viewer.env_id
    if viewer.role == "member":
        return viewer.member_id is not None and row.member_id == viewer.member_id
    if viewer.role in {"responder", "psych"}:
        return row.env_id == viewer.env_id and row.type in _DELIVERED_TYPES
    return False  # family (P2) y roles desconocidos


def last_id(session: Session) -> int:
    row = session.exec(select(models.EventLog.id).order_by(col(models.EventLog.id).desc())).first()
    return row or 0


def fetch_since(
    session: Session,
    since_id: int,
    *,
    viewer: Viewer | None = None,
    env_id: str | None = None,
    types: set[str] | None = None,
    limit: int = 500,
    newest_first: bool = False,
) -> list[models.EventLog]:
    """Eventos con ``id > since_id`` en orden (o los más recientes primero), filtrados por rol
    y por los parámetros."""
    q = select(models.EventLog).where(col(models.EventLog.id) > since_id)
    if env_id:
        q = q.where(models.EventLog.env_id == env_id)
    if types:
        q = q.where(col(models.EventLog.type).in_(types))
    order = col(models.EventLog.id).desc() if newest_first else col(models.EventLog.id)
    rows = session.exec(q.order_by(order).limit(limit)).all()
    return [r for r in rows if viewer is None or visible_to(r, viewer)]


def to_schema(row: models.EventLog) -> Event:
    try:
        device = uuid.UUID(row.device_id) if row.device_id else None
    except ValueError:
        device = None
    return Event(
        id=row.id,
        type=row.type,
        at=row.at,
        env_id=row.env_id,
        member_id=row.member_id,
        user_id=row.user_id,
        device_id=device,
        ref_id=row.ref_id,
        summary=row.summary,
        payload=row.payload or {},
    )
