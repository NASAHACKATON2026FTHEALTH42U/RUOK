"""Centro de control (BE-30, docs/control-center-and-devices.md §2).

Vista global **sin retardo** para el admin: todos los entornos con sus members
(estado global y liveness), alertas abiertas por severidad, enlace y métricas.

La pausa del liveness (presentación) se guarda en `app_state`: mientras un entorno
está en pausa no se lanzan "R U OK?" ni alertas `no_contact` (`liveness_watch`). El
liveness se sigue calculando y mostrando igual (sin datos = desconocido).
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlmodel import Session, col, func, select

from app import clock, models
from app.schemas import ControlOverview
from app.schemas.realtime import AlertCounts, ControlMetrics, EnvironmentOverview, EnvironmentRef
from app.services import app_state, comm_link, environments
from app.services.alerts import OPEN
from app.services.members import to_summary

PAUSED_KEY = "liveness_paused_envs"
# Un dispositivo cuenta como activo si ha hecho alguna petición en este margen.
ACTIVE_DEVICE_WINDOW = timedelta(minutes=5)
_OPEN = [s.value for s in OPEN]


# ── Pausa del liveness ─────────────────────────────────────────────────


def paused_envs(session: Session) -> set[str]:
    return set(app_state.get_value(session, PAUSED_KEY, []) or [])


def is_liveness_paused(session: Session, env_id: str) -> bool:
    return env_id in paused_envs(session)


def set_liveness_paused(session: Session, env_id: str, paused: bool) -> None:
    envs = paused_envs(session)
    envs = envs | {env_id} if paused else envs - {env_id}
    app_state.set_value(session, PAUSED_KEY, sorted(envs))  # hace commit


# ── Vista global ───────────────────────────────────────────────────────


def _open_alert_counts(session: Session) -> dict[str, AlertCounts]:
    rows = session.exec(
        select(models.Alert.env_id, models.Alert.severity, func.count())
        .where(col(models.Alert.status).in_(_OPEN))
        .group_by(models.Alert.env_id, models.Alert.severity)
    ).all()
    counts: dict[str, AlertCounts] = {}
    for env_id, severity, n in rows:
        c = counts.setdefault(env_id, AlertCounts())
        if severity in AlertCounts.model_fields:
            setattr(c, severity, getattr(c, severity) + n)
    return counts


def avg_alert_response_s(session: Session) -> float | None:
    """Media de segundos entre que se crea una alerta y su primer reconocimiento.
    `None` si todavía no se ha reconocido ninguna (sin datos ≠ 0)."""
    rows = session.exec(
        select(models.Alert.created_at, func.min(models.AlertEvent.at))
        .join(models.AlertEvent, col(models.AlertEvent.alert_id) == models.Alert.id)
        .where(models.AlertEvent.type == "acknowledged")
        .group_by(models.Alert.id)
    ).all()
    if not rows:
        return None
    total = sum((_utc(ack) - _utc(created)).total_seconds() for created, ack in rows)
    return round(total / len(rows), 1)


def _utc(value: datetime) -> datetime:
    # func.min pierde el tipo UTCDateTime en SQLite: puede volver como naive o como texto.
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    return value if value.tzinfo else value.replace(tzinfo=clock.now().tzinfo)


def metrics(session: Session, now: datetime | None = None) -> ControlMetrics:
    now = now or clock.now()
    measurements = session.exec(
        select(func.count())
        .select_from(models.Measurement)
        .where(col(models.Measurement.received_at) >= now - timedelta(hours=1))
    ).one()
    open_alerts = session.exec(
        select(func.count()).select_from(models.Alert).where(col(models.Alert.status).in_(_OPEN))
    ).one()
    devices = session.exec(
        select(func.count())
        .select_from(models.Device)
        .where(col(models.Device.last_seen_at) >= now - ACTIVE_DEVICE_WINDOW)
    ).one()
    return ControlMetrics(
        measurements_last_hour=measurements,
        open_alerts=open_alerts,
        active_devices=devices,
        avg_alert_response_s=avg_alert_response_s(session),
    )


def overview(session: Session) -> ControlOverview:
    now = clock.now()
    counts = _open_alert_counts(session)
    paused = paused_envs(session)
    envs = []
    for env in environments.list_environments():
        members = session.exec(
            select(models.Member).where(models.Member.env_id == env.id).order_by(models.Member.id)
        ).all()
        envs.append(
            EnvironmentOverview(
                environment=EnvironmentRef(id=env.id, name=env.name, kind=env.kind),
                link=comm_link.status(session, env.id),
                members=[to_summary(session, m) for m in members],
                open_alerts=counts.get(env.id, AlertCounts()),
                liveness_paused=env.id in paused,
            )
        )
    return ControlOverview(generated_at=now, environments=envs, metrics=metrics(session, now))
