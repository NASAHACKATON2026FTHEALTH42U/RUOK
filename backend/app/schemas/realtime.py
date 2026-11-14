"""Tiempo real, dispositivos, centro de control, sistema y demo
(docs/control-center-and-devices.md)."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.common import ApiModel, DeviceKind, EnvironmentKind, EventType, LinkState, Slug
from app.schemas.link import LinkStatus
from app.schemas.members import MemberSummary


class Event(ApiModel):
    """Evento de event_log. Es también el `data` de cada mensaje SSE."""

    id: int = Field(description="Autoincremental; se usa como Last-Event-ID")
    type: EventType
    at: datetime
    env_id: Slug | None = None
    member_id: int | None = None
    user_id: int | None = None
    device_id: UUID | None = None
    ref_id: str | None = None
    summary: str
    payload: dict[str, Any] = Field(default_factory=dict)


class Device(ApiModel):
    id: UUID
    user_id: int | None = None
    kind: DeviceKind | None = None
    label: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    first_seen_at: datetime
    last_seen_at: datetime
    pending_outbox: int = 0
    last_sync_at: datetime | None = None


class EnvironmentRef(ApiModel):
    id: Slug
    name: str
    kind: EnvironmentKind


class AlertCounts(ApiModel):
    warning: int = 0
    critical: int = 0
    emergency: int = 0


class EnvironmentOverview(ApiModel):
    environment: EnvironmentRef
    link: LinkStatus
    members: list[MemberSummary]
    open_alerts: AlertCounts
    liveness_paused: bool = False


class ControlMetrics(ApiModel):
    measurements_last_hour: int
    open_alerts: int
    active_devices: int
    avg_alert_response_s: float | None = None


class ControlOverview(ApiModel):
    generated_at: datetime
    environments: list[EnvironmentOverview]
    metrics: ControlMetrics


class LivenessPauseIn(ApiModel):
    env_id: Slug
    paused: bool


class NetworkInfo(ApiModel):
    lan_urls: list[str] = Field(examples=[["http://192.168.8.10:8000"]])
    hostname: str


# ── Demo ────────────────────────────────────────────────────


class DemoLinkIn(ApiModel):
    env: Slug
    state: LinkState


class FastForwardIn(ApiModel):
    seconds: float = Field(gt=0)


class DemoClock(ApiModel):
    server_time: datetime
    offset_s: float
