"""Members (astronauta, paciente, residente), mediciones, evaluación y liveness."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import (
    Activity,
    ApiModel,
    DeviceKind,
    EscalationMode,
    ForecastStatus,
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


# ── Previsión (FS-09) ───────────────────────────────────────


class ForecastPoint(ApiModel):
    at: datetime = Field(description="Instante previsto: el último dato más n pasos de la serie")
    value: float = Field(description="Valor esperado")
    low: float = Field(description="Límite inferior del intervalo de predicción (aprox. 80 %)")
    high: float = Field(description="Límite superior del intervalo de predicción (aprox. 80 %)")
    status: Status = Field(description="Estado del valor esperado con los rangos del entorno")


class ForecastChange(ApiModel):
    """Primer punto previsto cuyo estado difiere del actual (a peor o a mejor)."""

    status: Status = Field(description="Estado al que pasaría el indicador")
    at: datetime
    in_days: int = Field(ge=1, description="Días desde ahora, redondeados hacia arriba")


class Forecast(ApiModel):
    """Previsión estadística de un indicador. Informativa: no es un diagnóstico, no crea
    alertas y no cambia el `Assessment`."""

    member_id: int
    indicator_id: Slug
    unit: str
    generated_at: datetime
    status: ForecastStatus = Field(
        description="`insufficient_data`: menos de 7 mediciones a su cadencia en el tramo "
        "reciente (o más de la mitad serían huecos). `stale`: el último dato ha caducado "
        "(`max_age_s`). Solo `ok` trae `points`."
    )
    method: str = Field(
        description="Modelo usado: suavizado exponencial de Holt con tendencia amortiguada",
        examples=["holt_damped"],
    )
    horizon_days: int = Field(
        ge=1, description="Días previstos desde ahora (como mínimo un paso de la serie)"
    )
    step_days: int | None = Field(
        default=None, description="Cadencia de la serie: 1 = diaria, 7 = semanal"
    )
    history_days: int = Field(
        default=0, ge=0, description="Días con mediciones usados para ajustar el modelo"
    )
    current_status: Status = Field(
        description="Estado del último valor con los rangos del entorno (`unknown` si ha "
        "caducado). Solo mira el valor: no incluye las reglas de tendencia ni las conductuales "
        "del `Assessment`."
    )
    last_value_unusual: bool = Field(
        default=False,
        description="true si la última medición se aparta de lo esperado mucho más que el ruido "
        "habitual de la persona: la previsión la trata con cautela hasta que otra la confirme",
    )
    points: list[ForecastPoint] = Field(default_factory=list)
    change: ForecastChange | None = Field(
        default=None, description="null si el estado no cambia en el horizonte"
    )
    backtest_mae: float | None = Field(
        default=None,
        description="Error absoluto medio de la previsión a un paso en los últimos días "
        "(validación de origen móvil); null si aún no se puede medir",
    )


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
