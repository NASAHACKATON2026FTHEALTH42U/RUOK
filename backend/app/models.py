"""Modelos SQLModel: tablas de SQLite del servidor de a bordo.

Fuente de verdad: docs/data-model.md §1 (diagrama, diccionario e índices).
Si cambias una tabla, actualiza ese documento en la misma PR.

Convenciones:
- Fechas en UTC con `UTCDateTime` (SQLite no guarda zona horaria) y por defecto `clock.now()`.
- Campos JSON con `sa_type=JSON`.
- Los campos tipo enumeración (`role`, `status`…) se guardan como `str`; la validación
  de valores va en los schemas de la API (app/schemas.py).
- Los catálogos (entornos, indicadores, sistemas, insignias…) NO son tablas: se
  referencian por slug (`env_id`, `indicator_id`, `badge_id`…).
- Índices con los nombres exactos de data-model.md, declarados en `__table_args__`.
"""

import datetime as dt
from typing import Any

from sqlalchemy import JSON, DateTime, Index, text
from sqlalchemy.types import TypeDecorator
from sqlmodel import Field, SQLModel

from app import clock


class UTCDateTime(TypeDecorator):
    """DateTime que siempre se guarda en UTC y se lee con `tzinfo=UTC`."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: dt.datetime | None, dialect) -> dt.datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Fecha sin zona horaria: usa clock.now() o una fecha en UTC")
        return value.astimezone(dt.UTC).replace(tzinfo=None)

    def process_result_value(self, value: dt.datetime | None, dialect) -> dt.datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=dt.UTC)


def _now() -> dt.datetime:
    return clock.now()


# ── Usuarios y members ───────────────────────────────────────────────


class Member(SQLModel, table=True):
    __tablename__ = "member"
    __table_args__ = (Index("ix_member_env", "env_id"),)

    id: int | None = Field(default=None, primary_key=True)
    env_id: str  # slug -> environments.json
    name: str
    position: str  # commander, engineer, patient, resident... (no es UserAccount.role)
    share_behavioral_details: bool = False
    device_id: str | None = None  # último dispositivo
    last_seen_at: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)
    last_activity: str = "normal"  # normal | eva | sleep
    created_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)


class UserAccount(SQLModel, table=True):
    __tablename__ = "user_account"
    __table_args__ = (
        Index("ux_user_username", "username", unique=True),
        Index(
            "ux_user_member",
            "member_id",
            unique=True,
            sqlite_where=text("member_id IS NOT NULL"),
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    username: str
    display_name: str
    role: str  # member | medic | commander | responder | psych | family | admin
    env_id: str | None = None  # null solo para admin
    member_id: int | None = Field(default=None, foreign_key="member.id")
    password_hash: str
    failed_attempts: int = 0
    locked_until: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)
    active: bool = True
    last_login_at: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)
    created_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)


class Device(SQLModel, table=True):
    __tablename__ = "device"
    __table_args__ = (Index("ix_device_user", "user_id", "last_seen_at"),)

    id: str = Field(primary_key=True)  # UUID generado en el dispositivo
    user_id: int | None = Field(default=None, foreign_key="user_account.id")
    kind: str = "desktop"  # mobile | tablet | desktop
    label: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    first_seen_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)
    last_seen_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)
    pending_outbox: int = 0
    last_sync_at: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)


# ── Mediciones ───────────────────────────────────────────────────────


class Measurement(SQLModel, table=True):
    """Solo se añade, nunca se edita. La PK es el UUID del cliente (idempotencia)."""

    __tablename__ = "measurement"
    __table_args__ = (
        Index("ix_measurement_series", "member_id", "indicator_id", "taken_at"),
    )

    id: str = Field(primary_key=True)  # UUID generado en el cliente
    member_id: int = Field(foreign_key="member.id")
    indicator_id: str  # slug -> indicators.json
    value: float
    unit: str
    taken_at: dt.datetime = Field(sa_type=UTCDateTime)  # hora del dispositivo
    received_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)
    source: str = "manual"  # manual | device | camera | checkin | pvt
    note: str | None = None


# ── Rutina y gamificación ────────────────────────────────────────────


class Task(SQLModel, table=True):
    __tablename__ = "task"
    __table_args__ = (Index("ix_task_member_date", "member_id", "date"),)

    id: str = Field(primary_key=True)  # determinista: t_{date}_{member}_{task_type}
    member_id: int = Field(foreign_key="member.id")
    date: dt.date
    task_type: str  # measure_bp, resistive_exercise, checkin...
    title: str
    points: int = 0
    due: str = "any"  # morning | afternoon | evening | any
    indicator_id: str | None = None  # si se autocompleta al medir


class TaskCompletion(SQLModel, table=True):
    __tablename__ = "task_completion"
    __table_args__ = (Index("ux_task_completion", "task_id", unique=True),)

    id: str = Field(primary_key=True)  # UUID del cliente
    task_id: str = Field(foreign_key="task.id")
    member_id: int = Field(foreign_key="member.id")
    completed_at: dt.datetime = Field(sa_type=UTCDateTime)
    received_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)


class BadgeAward(SQLModel, table=True):
    __tablename__ = "badge_award"
    __table_args__ = (Index("ux_badge_award", "member_id", "badge_id", unique=True),)

    id: int | None = Field(default=None, primary_key=True)
    member_id: int = Field(foreign_key="member.id")
    badge_id: str  # slug -> badges.json
    earned_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)


class Kudos(SQLModel, table=True):
    """Reconocimiento entre members (BE-23): suma a los `crew_points`."""

    __tablename__ = "kudos"

    id: str = Field(primary_key=True)  # UUID
    env_id: str
    from_member_id: int = Field(foreign_key="member.id")
    to_member_id: int = Field(foreign_key="member.id")
    message: str
    created_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)


class MissionParticipation(SQLModel, table=True):
    """Un member se apunta a una misión de tripulación de un día (BE-23)."""

    __tablename__ = "mission_participation"
    __table_args__ = (
        Index("ux_mission_part", "date", "mission_id", "member_id", unique=True),
        Index("ix_mission_part_env", "env_id", "date"),
    )

    id: str = Field(primary_key=True)  # UUID del cliente
    env_id: str
    date: dt.date
    mission_id: str  # slug -> crew_game.json
    member_id: int = Field(foreign_key="member.id")
    created_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)


# ── Alertas y check-in ───────────────────────────────────────────────


class Alert(SQLModel, table=True):
    __tablename__ = "alert"
    __table_args__ = (
        Index("ix_alert_member_status", "member_id", "status"),
        Index("ix_alert_env_delivered", "env_id", "delivered_at"),
        Index(
            "ux_alert_open_dedupe",
            "dedupe_key",
            unique=True,
            sqlite_where=text("status <> 'resolved'"),
        ),
    )

    id: str = Field(primary_key=True)  # UUID (cliente si manual, servidor si auto)
    member_id: int = Field(foreign_key="member.id")
    env_id: str
    origin: str  # auto | manual
    authenticated: bool = True  # false = SOS de emergencia sin sesión
    created_by_user_id: int | None = Field(default=None, foreign_key="user_account.id")
    category: str  # symptom | physical | psychological | emergency | no_contact | indicator
    severity: str  # warning | critical | emergency
    system_id: str | None = None
    indicator_ids: list[str] = Field(default_factory=list, sa_type=JSON)
    message: str = ""
    level: int = 0  # posición en escalation_ladder
    # Obligatorios, como en el schema `Alert` del contrato (BE-35).
    target_role: str  # self | crew | ground | nurse | doctor...
    delivery_mode: str  # realtime | delayed | autonomous
    delay_s: int = 0
    eta: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)
    delivered_at: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)
    status: str = "open"  # open | escalated | acknowledged | resolved
    dedupe_key: str | None = None  # member+system o member+category
    created_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)
    updated_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)


class AlertEvent(SQLModel, table=True):
    """Timeline append-only de una alerta."""

    __tablename__ = "alert_event"
    __table_args__ = (Index("ix_alert_event_alert", "alert_id", "at"),)

    id: int | None = Field(default=None, primary_key=True)
    alert_id: str = Field(foreign_key="alert.id")
    # created | updated | escalated | queued | delivered | acknowledged | message | resolved
    type: str
    actor: str = "system"  # system | member | responder
    payload: dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)


class RuokCheck(SQLModel, table=True):
    __tablename__ = "ruok_check"
    __table_args__ = (
        Index(
            "ix_ruok_member_pending",
            "member_id",
            sqlite_where=text("responded_at IS NULL"),
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    member_id: int = Field(foreign_key="member.id")
    requested_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)
    responded_at: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)
    ok: bool | None = None
    note: str | None = None
    alert_id: str | None = Field(default=None, foreign_key="alert.id")  # no_contact


# ── Enlace simulado con la Tierra ────────────────────────────────────


class LinkMessage(SQLModel, table=True):
    """Outbox/inbox persistente del enlace simulado (BE-13)."""

    __tablename__ = "link_message"
    __table_args__ = (Index("ix_link_due", "env_id", "state", "eta"),)

    id: int | None = Field(default=None, primary_key=True)
    env_id: str
    direction: str  # up (a tierra) | down (a bordo)
    kind: str  # alert | alert_event | home_message
    ref_id: str | None = None  # alert.id / alert_event.id
    payload: dict[str, Any] = Field(default_factory=dict, sa_type=JSON)
    sent_at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)
    eta: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)
    delivered_at: dt.datetime | None = Field(default=None, sa_type=UTCDateTime)
    state: str = "queued"  # queued | in_transit | delivered


class LinkState(SQLModel, table=True):
    __tablename__ = "link_state"

    env_id: str = Field(primary_key=True)
    state: str = "online"  # online | delayed | los
    since: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)
    delay_override_s: int | None = None


# ── Tiempo real y estado técnico ─────────────────────────────────────


class EventLog(SQLModel, table=True):
    """Bitácora append-only: alimenta el SSE y el centro de control (BE-28)."""

    __tablename__ = "event_log"
    __table_args__ = (
        Index("ix_event_env_id", "env_id", "id"),
        Index("ix_event_type_at", "type", "at"),
    )

    id: int | None = Field(default=None, primary_key=True)  # sirve como Last-Event-ID
    type: str  # measurement.created | alert.created | ...
    at: dt.datetime = Field(default_factory=_now, sa_type=UTCDateTime)
    env_id: str | None = None
    member_id: int | None = None
    user_id: int | None = None
    device_id: str | None = None
    ref_id: str | None = None
    summary: str = ""
    payload: dict[str, Any] = Field(default_factory=dict, sa_type=JSON)


class AppState(SQLModel, table=True):
    """Clave-valor técnico: offset del reloj de demo, versión del seed, escenario activo."""

    __tablename__ = "app_state"

    key: str = Field(primary_key=True)
    value: Any = Field(default=None, sa_type=JSON)
