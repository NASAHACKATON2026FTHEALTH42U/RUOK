"""Members (astronauta, paciente, residente), mediciones, evaluación y liveness."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import (
    Activity,
    ApiModel,
    DeviceKind,
    EscalationMode,
    Liveness,
    Range,
    Slug,
    Source,
    Status,
    Trend,
)


class Member(ApiModel):
    id: int
    env_id: Slug
    name: str
    position: str = Field(
        description="Puesto en la misión o el centro (commander, engineer, patient, resident…). "
        "No confundir con el rol de acceso `User.role`.",
        examples=["commander"],
    )
    share_behavioral_details: bool = False
    last_seen_at: datetime | None = None
    liveness: Liveness


class MemberSummary(Member):
    """Member con su resumen de estado, para listas, /ground y /control."""

    overall_status: Status
    open_alerts: int = 0
    last_measurement_at: datetime | None = None


class PrivacyIn(ApiModel):
    share_behavioral_details: bool


# ── Mediciones ──────────────────────────────────────────────


class MeasurementIn(ApiModel):
    id: UUID = Field(description="UUID v4 generado en el cliente (idempotencia)")
    indicator_id: Slug
    value: float
    taken_at: datetime = Field(description="Hora del dispositivo")
    source: Source = Source.manual
    note: str | None = None


class Measurement(MeasurementIn):
    member_id: int
    unit: str
    received_at: datetime = Field(description="Hora del servidor (reloj de demo)")


class MeasurementBatchIn(ApiModel):
    measurements: list[MeasurementIn] = Field(min_length=1)


# ── Evaluación ──────────────────────────────────────────────


class IndicatorAssessment(ApiModel):
    indicator_id: Slug
    last_value: float | None = None
    unit: str
    taken_at: datetime | None = None
    status: Status
    trend: Trend
    baseline: float | None = Field(
        default=None, description="Línea base personal (primeros 7 días)"
    )
    range: dict[str, Range] = Field(description="Rangos aplicados (ya con los ajustes del entorno)")


class Recommendation(ApiModel):
    id: Slug
    text: str
    priority: int = Field(ge=1, description="1 = más importante")
    intervention_id: Slug | None = None


class Escalation(ApiModel):
    level: int = Field(ge=0, description="Posición en environment.escalation_ladder (0 = self)")
    target_role: str = Field(examples=["self", "crew", "ground"])
    mode: EscalationMode
    delay_s: int
    message: str
    protocol_id: Slug | None = None


class SystemAssessment(ApiModel):
    system_id: Slug
    status: Status
    indicators: list[IndicatorAssessment]
    recommendations: list[Recommendation] = Field(default_factory=list)
    escalation: Escalation


class BehavioralSummary(ApiModel):
    status: Status
    details_visible: bool = Field(
        description="false si el member no comparte y quien consulta no es psych"
    )


class Assessment(ApiModel):
    member_id: int
    env_id: Slug
    generated_at: datetime
    overall_status: Status = Field(description="El peor entre la salud y el liveness")
    liveness: Liveness
    last_seen_at: datetime | None = None
    systems: list[SystemAssessment]
    behavioral: BehavioralSummary
    provisional: bool = Field(
        default=False, description="Siempre false en el servidor; el front lo usa offline"
    )


class MeasurementBatchResult(ApiModel):
    accepted: int
    duplicates: int
    assessment: Assessment


# ── Liveness ────────────────────────────────────────────────


class HeartbeatIn(ApiModel):
    device_id: UUID
    activity: Activity = Activity.normal
    pending_outbox: int = Field(default=0, ge=0)
    last_sync_at: datetime | None = None
    device_kind: DeviceKind | None = None


class HeartbeatResult(ApiModel):
    liveness: Liveness
    checkin_required: bool = Field(
        description="true → mostrar el modal 'R U OK?' a pantalla completa"
    )


class RuokIn(ApiModel):
    ok: bool
    note: str | None = None


class RuokResult(ApiModel):
    liveness: Liveness
    alert_id: UUID | None = Field(default=None, description="Si ok=false, la alerta creada")
