"""Catálogos de configuración (solo lectura): entornos, indicadores, sistemas e intervenciones.

Fuente de los datos reales: `app/data/*.json` (BE-03, BE-04, BE-21).
"""

from datetime import date
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import AlertCategory, ApiModel, EnvironmentKind, Range, Slug


class LivenessThresholds(ApiModel):
    """Umbrales de liveness y escalado del entorno (docs/offline-and-liveness.md)."""

    stale_after_s: int = Field(gt=0, examples=[300])
    lost_after_s: int = Field(gt=0, examples=[900])
    eva_stale_after_s: int = Field(gt=0, examples=[30])
    eva_lost_after_s: int = Field(gt=0, description="En EVA, sin señal → lost", examples=[120])
    sleep_factor: float = Field(
        ge=1, description="Durante el sueño programado los umbrales se multiplican", examples=[3]
    )
    ruok_timeout_s: int = Field(gt=0, examples=[120])
    morning_checkin_by: str | None = Field(
        default=None,
        pattern=r"^([01]\d|2[0-3]):[0-5]\d$",
        description="Hora local HH:MM; sin check-in matinal antes de esa hora → stale (geriatría)",
        examples=["10:00"],
    )
    warning_escalate_after_s: int = Field(
        gt=0,
        description="Un warning que persiste este tiempo escala al siguiente nivel",
        examples=[21600],
    )

    @model_validator(mode="after")
    def _lost_after_stale(self) -> "LivenessThresholds":
        if self.lost_after_s <= self.stale_after_s:
            raise ValueError("lost_after_s tiene que ser mayor que stale_after_s")
        if self.eva_lost_after_s <= self.eva_stale_after_s:
            raise ValueError("eva_lost_after_s tiene que ser mayor que eva_stale_after_s")
        return self


class Theme(ApiModel):
    primary: str = Field(examples=["#c1440e"])
    background: str | None = Field(default=None, examples=["mars.jpg"])


class RangeOverride(ApiModel):
    normal: Range | None = None
    warning: Range | None = None
    critical_low: float | None = None
    critical_high: float | None = None


class RoutineItem(ApiModel):
    task_type: Slug = Field(examples=["measure_bp"])
    times_per_day: int = 1
    points: int = 10


DayPart = Literal["morning", "afternoon", "evening", "any"]


class TaskType(ApiModel):
    """Tipo de tarea de la rutina diaria (app/data/task_types.json, BE-18). Uso interno.

    El entorno elige qué tipos usa, cuántas veces al día y cuántos puntos dan (`routine`).
    """

    id: Slug = Field(examples=["measure_bp"])
    title: str
    due: DayPart = "any"
    slots: list[DayPart] = Field(
        default_factory=list,
        description="Momento de cada repetición si times_per_day > 1 (si falta, `due`)",
    )
    indicator_id: Slug | None = Field(
        default=None, description="Se autocompleta al llegar una medición de este indicador"
    )


class BadgeRule(ApiModel):
    """Cuándo se gana una insignia (app/data/badges.json, BE-19)."""

    kind: Literal["tasks_completed", "points", "streak", "perfect_days"]
    threshold: int = Field(ge=1)
    task_type: Slug | None = Field(
        default=None, description="Solo con tasks_completed: cuenta solo ese tipo de tarea"
    )


class BadgeDef(ApiModel):
    """Insignia del catálogo. Uso interno: la API devuelve `Badge` (id, name, earned_at)."""

    id: Slug
    name: str
    description: str
    rule: BadgeRule


class ProtocolRecommendation(ApiModel):
    id: Slug
    text: str
    priority: int = Field(ge=1, description="1 = más importante")


class Protocol(ApiModel):
    """Protocolo de app/data/protocols.json. Uso interno (no sale tal cual por la API).

    - **De sistema** (`system_id` + `statuses`, CNT-02): qué hacer cuando un sistema está
      en `warning` o `critical`. Sus textos salen por `Assessment` (recommendations,
      escalation).
    - **De categoría de alerta** (`alert_category`, CNT-03): pasos para quien atiende una
      alerta que no es de un sistema del cuerpo, como `no_contact`.
    """

    id: Slug = Field(examples=["proto_cardiovascular_critical"])
    system_id: Slug | None = None
    statuses: list[Literal["warning", "critical"]] = Field(default_factory=list)
    alert_category: AlertCategory | None = None
    message: str = Field(min_length=1, description="Mensaje de la alerta y del escalado")
    steps: list[str] = Field(default_factory=list, description="Pasos del protocolo autónomo")
    recommendations: list[ProtocolRecommendation] = Field(default_factory=list)
    sources: list[str] = Field(min_length=1, description="IDs de docs/sources.md")

    @model_validator(mode="after")
    def _system_or_category(self) -> "Protocol":
        if (self.system_id is None) == (self.alert_category is None):
            raise ValueError("un protocolo es de un sistema (system_id) o de una alert_category")
        if self.system_id is not None and not (self.statuses and self.recommendations):
            raise ValueError("un protocolo de sistema necesita statuses y recommendations")
        if self.alert_category is not None and (self.statuses or not self.steps):
            raise ValueError("un protocolo de alert_category lleva steps y no statuses")
        return self


class Mission(ApiModel):
    start: date
    end: date


class Environment(ApiModel):
    id: Slug
    name: str
    kind: EnvironmentKind
    gravity_g: float
    comm_delay_s: int = Field(description="Retardo de comunicaciones de ida, en segundos")
    radiation_level: Literal["none", "low", "medium", "high"]
    escalation_ladder: list[str] = Field(
        description="Roles de escalado en orden. Ej.: self → crew → ground",
        examples=[["self", "crew", "ground"]],
    )
    external_from_level: int = Field(
        ge=1,
        description="Índice del primer nivel externo de escalation_ladder. Los anteriores son "
        "de a bordo (realtime, sin retardo); los externos salen por el enlace con comm_delay_s",
        examples=[2],
    )
    liveness: LivenessThresholds
    vocabulary: dict[str, str] = Field(
        description="Textos visibles: member, crew, ground, roles… "
        "Nunca escribir 'astronauta' fijo en la UI"
    )
    theme: Theme
    threshold_overrides: dict[str, RangeOverride] = Field(default_factory=dict)
    indicators: list[Slug]
    routine: list[RoutineItem] = Field(default_factory=list)
    mission: Mission | None = None

    @model_validator(mode="after")
    def _external_level_in_ladder(self) -> "Environment":
        if self.external_from_level > len(self.escalation_ladder):
            raise ValueError(
                "external_from_level no puede ser mayor que la longitud de escalation_ladder"
            )
        return self


class IndicatorRanges(ApiModel):
    normal: Range
    warning: Range | None = None
    critical_low: float | None = None
    critical_high: float | None = None


class IndicatorInput(ApiModel):
    type: Literal["number", "scale_1_5", "duration"]
    min: float | None = None
    max: float | None = None
    step: float | None = None


class Indicator(ApiModel):
    id: Slug
    name: str
    unit: str
    system_id: Slug
    ranges: IndicatorRanges
    max_age_s: int = Field(description="A partir de esta antigüedad el indicador pasa a `unknown`")
    higher_is_worse: bool = True
    input: IndicatorInput
    measurement_instructions: list[str]
    why_it_matters: str
    hazards: list[Slug] = Field(default_factory=list)


class BodySystem(ApiModel):
    id: Slug
    name: str
    svg_region: str = Field(description="Región del SVG de BodyFigure")
    indicators: list[Slug]
    function: str
    space_effects: str
    hazards: list[Slug] = Field(default_factory=list)


class Intervention(ApiModel):
    id: Slug
    title: str
    category: str = Field(examples=["stress"])
    system_id: Slug | None = None
    duration_min: int = Field(ge=1)
    steps: list[str] = Field(min_length=1)
    offline: bool = True
    indicator_ids: list[Slug] = Field(
        default_factory=list,
        description="Indicadores a los que responde; vacío = genérica del sistema",
    )
    sources: list[str] = Field(default_factory=list, description="IDs de docs/sources.md")
