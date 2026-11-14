"""Liveness: ¿sigue vivo el dispositivo del member? (BE-12).

Funciones puras. Quien llama pasa ``now=clock.now()`` (nunca
``datetime.now()``) para que el fast-forward de la demo funcione.

Reglas de docs/offline-and-liveness.md ("Heartbeat y liveness"):

| Liveness | Normal                | EVA                      | Sueño programado |
|----------|-----------------------|--------------------------|------------------|
| active   | < ``stale_after_s``   | < ``eva_stale_after_s``  | umbrales ×3      |
| stale    | ≥ ``stale_after_s``   | ≥ ``eva_stale_after_s``  | ≥ 3 × stale      |
| lost     | ≥ ``lost_after_s``    | ≥ ``eva_lost_after_s``   | ≥ 3 × lost       |

``LivenessThresholds`` no tiene ``eva_lost_after_s``. Mientras no se añada al
contrato, se usa ``EVA_LOST_FACTOR × eva_stale_after_s`` (30 s × 4 = 2 min,
como en la tabla del doc). Si el entorno lo define, manda el del entorno.

Estado global (``overall = peor(salud, liveness)``):

- ``active`` → no cambia el estado de salud.
- ``stale``  → como mínimo ``unknown`` (gris): nunca ``normal``.
- ``lost``   → ``critical`` (y BE-16 crea la alerta ``no_contact``).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlmodel import Session

from app import clock, models
from app.schemas.common import Activity, DeviceKind, Liveness, Status
from app.schemas.members import HeartbeatIn, HeartbeatResult
from app.services import environments
from app.services.assessment import _as_dict, worst_status

__all__ = [
    "EVA_LOST_FACTOR",
    "SLEEP_FACTOR",
    "combine_overall",
    "compute_liveness",
    "member_liveness",
    "record_heartbeat",
    "thresholds_for",
]

SLEEP_FACTOR = 3
EVA_LOST_FACTOR = 4


def thresholds_for(
    liveness_cfg: Any, activity: Activity | str = Activity.normal
) -> tuple[int, int]:
    """``(stale_after_s, lost_after_s)`` para esa actividad."""
    cfg = _as_dict(liveness_cfg)
    activity = Activity(activity)
    stale, lost = cfg["stale_after_s"], cfg["lost_after_s"]
    if activity == Activity.eva:
        eva_stale = cfg["eva_stale_after_s"]
        return eva_stale, cfg.get("eva_lost_after_s") or eva_stale * EVA_LOST_FACTOR
    if activity == Activity.sleep:
        return stale * SLEEP_FACTOR, lost * SLEEP_FACTOR
    return stale, lost


def compute_liveness(
    last_seen_at: datetime | None,
    now: datetime,
    liveness_cfg: Any,
    activity: Activity | str = Activity.normal,
) -> Liveness:
    """``active`` / ``stale`` / ``lost`` según la antigüedad del último heartbeat.

    Sin ningún heartbeat (``last_seen_at=None``) es ``stale``: no sabemos si
    está bien, así que nunca se pinta en verde, pero tampoco se dispara una
    alerta ``no_contact`` por un member que aún no ha conectado su dispositivo.
    """
    if last_seen_at is None:
        return Liveness.stale
    stale_after, lost_after = thresholds_for(liveness_cfg, activity)
    age = (now - last_seen_at).total_seconds()
    if age >= lost_after:
        return Liveness.lost
    if age >= stale_after:
        return Liveness.stale
    return Liveness.active


def combine_overall(health: Status | str, liveness: Liveness | str) -> Status:
    """El peor entre el estado de salud y el de liveness."""
    liveness = Liveness(liveness)
    if liveness == Liveness.lost:
        return Status.critical
    if liveness == Liveness.stale:
        return worst_status([health, Status.unknown])
    return Status(health)


# --------------------------------------------------------------------------
# BE-12 (parte 2): liveness de un member de la BD y heartbeat
# --------------------------------------------------------------------------


def member_liveness(member: models.Member, now: datetime | None = None) -> Liveness:
    """Liveness real del member: su último heartbeat, su actividad y su entorno."""
    env = environments.get_environment(member.env_id)
    if env is None:  # no debería pasar: env_id se valida al crear el member
        return Liveness.stale
    return compute_liveness(
        member.last_seen_at, now or clock.now(), env.liveness, member.last_activity
    )


def record_heartbeat(
    session: Session, member: models.Member, body: HeartbeatIn, now: datetime | None = None
) -> HeartbeatResult:
    """Guarda el heartbeat y devuelve el liveness.

    - ``checkin_required`` es ``True`` si el member venía de ``stale`` o ``lost``:
      el dispositivo ha vuelto y debe mostrar el "R U OK?" (FE-15).
    - Actualiza ``member.last_seen_at``, ``last_activity`` y ``device_id``.
    - Registro mínimo del dispositivo (``kind``, ``pending_outbox``,
      ``last_sync_at``); el resto del registro es BE-29.
    """
    now = now or clock.now()
    previous = member_liveness(member, now)

    member.last_seen_at = now
    member.last_activity = Activity(body.activity).value
    member.device_id = str(body.device_id)
    session.add(member)

    device = session.get(models.Device, str(body.device_id))
    if device is None:
        device = models.Device(id=str(body.device_id), first_seen_at=now)
    device.last_seen_at = now
    device.pending_outbox = body.pending_outbox
    device.last_sync_at = body.last_sync_at
    if body.device_kind is not None:
        device.kind = DeviceKind(body.device_kind).value
    session.add(device)
    session.commit()
    session.refresh(member)
    # TODO(BE-28): events.emit("liveness.changed") si previous != active.

    return HeartbeatResult(
        liveness=member_liveness(member, now),
        checkin_required=previous in (Liveness.stale, Liveness.lost),
    )
