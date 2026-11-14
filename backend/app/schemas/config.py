"""Catálogos de configuración (solo lectura): entornos, indicadores, sistemas e intervenciones.

Fuente de los datos reales: `app/data/*.json` (BE-03, BE-04, BE-21).
"""

from datetime import date
from typing import Literal

from pydantic import Field

from app.schemas.common import ApiModel, EnvironmentKind, Range, Slug


class LivenessThresholds(ApiModel):
    stale_after_s: int = Field(examples=[300])
    lost_after_s: int = Field(examples=[900])
    eva_stale_after_s: int = Field(examples=[30])
    ruok_timeout_s: int = Field(examples=[120])


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
    duration_min: int
    steps: list[str]
    offline: bool = True
