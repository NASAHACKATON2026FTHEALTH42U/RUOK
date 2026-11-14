"""Salud conductual: reglas frente a la línea base y privacidad (BE-20).

Funciones puras (sin BD ni reloj: quien llama pasa ``now=clock.now()``).
Reglas de docs/behavioral-health.md ("Analizar"); los umbrales están en
``app/data/behavioral_rules.json``:

- **Ánimo bajo:** la media diaria de ``mood`` está por debajo de la línea
  base personal menos ``below_baseline_by`` durante ``min_days`` días
  seguidos (contando hacia atrás desde el último día con datos).
- **Soledad en aumento:** la media diaria de ``loneliness`` sube
  ``min_days`` días seguidos (misma racha que la regla de BE-10).
- **PVT con mal sueño:** el último ``pvt_mean_rt_ms`` es más de un
  ``worse_than_baseline_pct`` % peor que su línea base **y** el último
  ``sleep_hours`` está por debajo de ``sleep_below``.
- Cada regla que se cumple pone su indicador en ``warning`` (nunca baja un
  estado). Con ``critical_when_rules`` reglas a la vez, el sistema
  neuro-conductual pasa a ``critical``.

Sin datos = desconocido: una regla no se cumple con datos caducados
(``max_age_s`` del indicador) ni sin línea base.

Privacidad (docs/auth-and-roles.md): los indicadores de ``private_indicators``
se ocultan de ``systems[]`` salvo que quien consulta pueda ver los detalles.
El estado agregado del sistema y ``Assessment.behavioral`` siguen visibles.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cache
from pathlib import Path
from typing import Any

from app.schemas.members import Assessment
from app.services import catalog
from app.services.trends import _points, baseline, daily_means, worsening_streak

__all__ = [
    "RULES_FILE",
    "FiredRule",
    "details_visible",
    "evaluate_rules",
    "load_rules",
    "redact",
]

RULES_FILE = Path(__file__).resolve().parent.parent / "data" / "behavioral_rules.json"


@dataclass(frozen=True)
class FiredRule:
    """Regla que se cumple y el indicador que pasa a ``warning``."""

    rule_id: str
    indicator_id: str


@cache
def load_rules(path: Path = RULES_FILE) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _fresh(
    points: list[tuple[datetime, float]], indicator: Mapping[str, Any], now: datetime
) -> bool:
    """Hay un último dato y no ha caducado."""
    if not points:
        return False
    max_age_s = indicator.get("max_age_s")
    return max_age_s is None or now - points[-1][0] <= timedelta(seconds=max_age_s)


def _low_mood_days(points: list, limit: float) -> int:
    """Días seguidos (desde el último) con la media diaria por debajo de ``limit``."""
    days = daily_means(points)
    streak, prev_day = 0, None
    for day, mean in reversed(days):
        if mean >= limit or (prev_day is not None and prev_day - day != timedelta(days=1)):
            break
        streak, prev_day = streak + 1, day
    return streak


def evaluate_rules(
    series: Mapping[str, Iterable[Any]],
    indicators: Mapping[str, Mapping[str, Any]],
    now: datetime,
    rules: Mapping[str, Any] | None = None,
) -> list[FiredRule]:
    """Reglas conductuales que se cumplen.

    ``series`` e ``indicators`` van por ``indicator_id``. Solo se evalúan las
    reglas cuyo indicador está en ``indicators`` (los activos del entorno).
    """
    rules = rules if rules is not None else load_rules()
    fired: list[FiredRule] = []

    def pts(ind_id: str) -> list:
        return _points(series.get(ind_id, ()))

    r = rules.get("low_mood")
    if r and (ind := indicators.get(r["indicator_id"])):
        p = pts(r["indicator_id"])
        base = baseline(p, now)
        if base is not None and _fresh(p, ind, now):
            if _low_mood_days(p, base - r["below_baseline_by"]) >= r["min_days"]:
                fired.append(FiredRule("low_mood", r["indicator_id"]))

    r = rules.get("rising_loneliness")
    if r and (ind := indicators.get(r["indicator_id"])):
        p = pts(r["indicator_id"])
        if _fresh(p, ind, now) and worsening_streak(p, higher_is_worse=True) >= r["min_days"]:
            fired.append(FiredRule("rising_loneliness", r["indicator_id"]))

    r = rules.get("pvt_with_poor_sleep")
    if r and (ind := indicators.get(r["indicator_id"])) and (
        sleep_ind := indicators.get(r["sleep_indicator_id"])
    ):
        p, s = pts(r["indicator_id"]), pts(r["sleep_indicator_id"])
        base = baseline(p, now)
        if base is not None and _fresh(p, ind, now) and _fresh(s, sleep_ind, now):
            pvt_worse = p[-1][1] > base * (1 + r["worse_than_baseline_pct"] / 100)
            if pvt_worse and s[-1][1] < r["sleep_below"]:
                fired.append(FiredRule("pvt_with_poor_sleep", r["indicator_id"]))

    return fired


# Matriz de docs/auth-and-roles.md, fila "Detalles conductuales".
_ALWAYS = {"psych", "admin"}
_IF_SHARED_OR_EMERGENCY = {"medic", "responder"}


def details_visible(
    *,
    share_behavioral_details: bool,
    emergency_open: bool,
    viewer_role: str | None = None,
    viewer_is_owner: bool = False,
) -> bool:
    """¿Puede quien consulta ver los detalles conductuales del member?

    - El propio member, ``psych`` y ``admin``: siempre.
    - ``medic`` y ``responder``: si el member comparte o hay una emergencia abierta.
    - ``commander`` y ``family``: nunca (solo el agregado).
    - Sin saber quién consulta (``viewer_role=None``, antes de BE-26/BE-27):
      solo si el member comparte o hay emergencia (privado por defecto).
    """
    if viewer_is_owner or viewer_role in _ALWAYS:
        return True
    if viewer_role is None or viewer_role in _IF_SHARED_OR_EMERGENCY:
        return share_behavioral_details or emergency_open
    return False


def redact(assessment: Assessment, private: Iterable[str] | None = None) -> Assessment:
    """Copia del assessment sin los indicadores privados si ``details_visible`` es False.

    Se quitan de ``systems[].indicators`` (valor, tendencia, línea base y estado
    individual) y las recomendaciones de intervenciones ligadas a esos indicadores.
    El estado del sistema, su escalado y ``behavioral`` se mantienen: quien no puede
    ver los detalles sigue viendo el semáforo agregado.
    """
    if assessment.behavioral.details_visible:
        return assessment
    hidden = set(private if private is not None else load_rules()["private_indicators"])
    out = assessment.model_copy(deep=True)
    for system in out.systems:
        system.indicators = [i for i in system.indicators if i.indicator_id not in hidden]
        # Una intervención ligada a un indicador privado delata cuál ha saltado (BE-21):
        # solo quedan las genéricas del sistema.
        system.recommendations = [
            r for r in system.recommendations if not _reveals(r.intervention_id, hidden)
        ]
    return out


def _reveals(intervention_id: str | None, hidden: set[str]) -> bool:
    if intervention_id is None:
        return False
    item = catalog.get_intervention(intervention_id)
    return item is not None and bool(hidden & set(item.indicator_ids))
