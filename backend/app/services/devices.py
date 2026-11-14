"""Registro de dispositivos (BE-29, docs/control-center-and-devices.md §4).

- Cada petición con `X-Device-Id` actualiza el dispositivo: `last_seen_at`, IP, user agent
  y, si trae una sesión válida, el último usuario (`user_id`). Ver `routers/deps.py`.
- Cada heartbeat informa además de `pending_outbox`, `last_sync_at` y `device_kind`.
- La primera vez que se ve un dispositivo se emite `device.registered`.
- Sin `device_kind`, el tipo se deduce del user agent (móvil, tablet o escritorio).
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, col, select

from app import clock, models
from app.schemas.common import DeviceKind, EventType
from app.services import events

_UNSET = object()
_MAX_UA = 512  # el user agent lo manda el cliente: se recorta


def infer_kind(user_agent: str | None) -> DeviceKind:
    """Tipo de dispositivo a partir del user agent (heurística sencilla)."""
    ua = (user_agent or "").lower()
    if "ipad" in ua or "tablet" in ua or ("android" in ua and "mobile" not in ua):
        return DeviceKind.tablet
    if "mobi" in ua or "iphone" in ua or "android" in ua:
        return DeviceKind.mobile
    return DeviceKind.desktop


def touch(
    session: Session,
    device_id: str,
    *,
    user: models.UserAccount | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    kind: DeviceKind | str | None = None,
    pending_outbox: int | None = None,
    last_sync_at: datetime | None | object = _UNSET,
    now: datetime | None = None,
) -> models.Device:
    """Crea o actualiza el dispositivo (sin commit). Solo pisa los campos que llegan:
    una petición sin sesión no borra el último usuario, ni una sin IP la IP."""
    now = now or clock.now()
    device = session.get(models.Device, str(device_id))
    is_new = device is None
    if device is None:
        device = models.Device(id=str(device_id), first_seen_at=now)
    device.last_seen_at = now
    if user is not None:
        device.user_id = user.id
    if ip:
        device.ip = ip
    if user_agent:
        device.user_agent = user_agent[:_MAX_UA]
    if kind is not None:
        device.kind = DeviceKind(kind).value
    elif is_new:
        device.kind = infer_kind(user_agent).value
    if pending_outbox is not None:
        device.pending_outbox = pending_outbox
    if last_sync_at is not _UNSET:
        device.last_sync_at = last_sync_at  # type: ignore[assignment]
    session.add(device)

    if is_new:
        who = user.display_name if user is not None else "sin sesión"
        events.emit(
            session,
            EventType.device_registered,
            env_id=user.env_id if user is not None else None,
            member_id=user.member_id if user is not None else None,
            user_id=user.id if user is not None else None,
            device_id=device.id,
            summary=f"Nuevo dispositivo ({device.kind}) de {who}",
            payload={"kind": device.kind, "ip": device.ip},
        )
    return device


def list_devices(session: Session, env_id: str | None = None) -> list[models.Device]:
    """Dispositivos, el último visto primero. Con `env_id`, solo los cuyo último usuario es
    de ese entorno (un dispositivo sin sesión no pertenece a ninguno)."""
    query = select(models.Device)
    if env_id is not None:
        query = query.join(
            models.UserAccount, col(models.Device.user_id) == models.UserAccount.id
        ).where(models.UserAccount.env_id == env_id)
    return list(session.exec(query.order_by(col(models.Device.last_seen_at).desc())).all())
