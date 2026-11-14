"""Enumeraciones y tipos comunes del contrato (docs/api-contract.md#enumeraciones).

Se usan `StrEnum` para que el OpenAPI genere esquemas con nombre y el front
reciba uniones de literales en `types.gen.ts` (p. ej. `components["schemas"]["Status"]`).
"""

from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

# Rango numérico [min, max]
Range = tuple[float, float]

# Slug de configuración: mars, heart_rate, cardiovascular…
Slug = Annotated[str, Field(pattern=r"^[a-z0-9_]+$", examples=["mars"])]


class ApiModel(BaseModel):
    """Base de todos los schemas.

    - `extra="forbid"`: rechaza campos desconocidos en la entrada (422).
    - `json_schema_serialization_defaults_required`: en las RESPUESTAS, los campos con valor
      por defecto se declaran obligatorios (siempre vienen), y en las PETICIONES siguen siendo
      opcionales. Así los tipos TS no obligan al front a enviar los valores por defecto.
    """

    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)


class Status(StrEnum):
    """Estado de salud. `unknown` = sin datos o caducados: NUNCA se pinta en verde."""

    normal = "normal"
    warning = "warning"
    critical = "critical"
    unknown = "unknown"


class Liveness(StrEnum):
    active = "active"
    stale = "stale"
    lost = "lost"


class Trend(StrEnum):
    rising = "rising"
    falling = "falling"
    stable = "stable"
    insufficient_data = "insufficient_data"


class EscalationMode(StrEnum):
    realtime = "realtime"
    delayed = "delayed"
    autonomous = "autonomous"


class LinkState(StrEnum):
    online = "online"
    delayed = "delayed"
    los = "los"


class AlertOrigin(StrEnum):
    auto = "auto"
    manual = "manual"


class AlertSeverity(StrEnum):
    warning = "warning"
    critical = "critical"
    emergency = "emergency"


class AlertStatus(StrEnum):
    open = "open"
    escalated = "escalated"
    acknowledged = "acknowledged"
    resolved = "resolved"


class AlertCategory(StrEnum):
    symptom = "symptom"
    physical = "physical"
    psychological = "psychological"
    emergency = "emergency"
    no_contact = "no_contact"
    indicator = "indicator"


class AlertEventType(StrEnum):
    created = "created"
    updated = "updated"
    escalated = "escalated"
    queued = "queued"
    delivered = "delivered"
    acknowledged = "acknowledged"
    message = "message"
    resolved = "resolved"


class Actor(StrEnum):
    system = "system"
    member = "member"
    responder = "responder"


class Source(StrEnum):
    manual = "manual"
    device = "device"
    camera = "camera"
    checkin = "checkin"
    pvt = "pvt"


class Activity(StrEnum):
    normal = "normal"
    eva = "eva"
    sleep = "sleep"


class DeviceKind(StrEnum):
    mobile = "mobile"
    tablet = "tablet"
    desktop = "desktop"


class Role(StrEnum):
    """Roles de acceso (docs/auth-and-roles.md)."""

    member = "member"
    medic = "medic"
    commander = "commander"
    responder = "responder"
    psych = "psych"
    family = "family"
    admin = "admin"


class EnvironmentKind(StrEnum):
    space = "space"
    earth = "earth"


class EventType(StrEnum):
    measurement_created = "measurement.created"
    heartbeat = "heartbeat"
    liveness_changed = "liveness.changed"
    alert_created = "alert.created"
    alert_escalated = "alert.escalated"
    alert_acknowledged = "alert.acknowledged"
    alert_resolved = "alert.resolved"
    link_queued = "link.queued"
    link_delivered = "link.delivered"
    link_state_changed = "link.state_changed"
    sync_batch = "sync.batch"
    auth_login = "auth.login"
    auth_failed = "auth.failed"
    task_completed = "task.completed"
    device_registered = "device.registered"


class LinkDirection(StrEnum):
    up = "up"  # a tierra
    down = "down"  # a bordo


class ErrorResponse(BaseModel):
    """Formato estándar de error de FastAPI."""

    detail: str


class OkResponse(ApiModel):
    ok: bool = True
    detail: str | None = None
