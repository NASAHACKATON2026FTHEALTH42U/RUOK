"""Composición del ``Assessment`` completo de un member (BE-11).

Función pura: junta el motor por indicador (BE-08), la agregación y el
escalado (BE-09) y las tendencias (BE-10). No toca la base de datos ni el
reloj; el router le pasa el member, el entorno, los catálogos, las series de
mediciones y ``now=clock.now()``.

Para evaluar "con otro perfil sin modificar datos" (``?env=``), basta con
pasar otro ``env``: las series y el member no cambian.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Any

from app.schemas.common import Liveness, Status
from app.schemas.members import (
    Assessment,
    BehavioralSummary,
    IndicatorAssessment,
    SystemAssessment,
)
from app.services.assessment import (
    _as_dict,
    build_escalation,
    evaluate_indicator,
    find_protocol,
    merge_ranges,
    overall_status,
    recommendations_for,
    system_status,
)
from app.services.trends import _points, apply_worsening_rule, baseline, trend

__all__ = ["BEHAVIORAL_SYSTEM_ID", "build_assessment", "build_indicator_assessment"]

# Sistema cuyo estado se resume en `Assessment.behavioral` (ver BE-20).
BEHAVIORAL_SYSTEM_ID = "neuro_behavioral"

# Rangos que se devuelven en `IndicatorAssessment.range` (solo los de tipo [min, max]).
_RANGE_KEYS = ("normal", "warning")


def build_indicator_assessment(
    indicator: Any, env: Any, series: Iterable[Any], now: datetime
) -> IndicatorAssessment:
    """Estado, último valor, tendencia y línea base de un indicador."""
    ind = _as_dict(indicator)
    points = _points(series)
    taken_at, last_value = points[-1] if points else (None, None)

    status = evaluate_indicator(last_value, ind, env, taken_at=taken_at, now=now)
    status = apply_worsening_rule(
        status, points, higher_is_worse=ind.get("higher_is_worse", True)
    )
    ranges = merge_ranges(ind, env)
    return IndicatorAssessment(
        indicator_id=ind["id"],
        last_value=last_value,
        unit=ind.get("unit", ""),
        taken_at=taken_at,
        status=status,
        trend=trend(points, now),
        baseline=baseline(points, now),
        range={k: tuple(ranges[k]) for k in _RANGE_KEYS if ranges.get(k) is not None},
    )


def build_assessment(
    *,
    member_id: int,
    env: Any,
    indicators: Iterable[Any],
    systems: Iterable[Any],
    series: Mapping[str, Iterable[Any]],
    now: datetime,
    protocols: Iterable[Any] = (),
    liveness: Liveness | str = Liveness.active,
    last_seen_at: datetime | None = None,
    behavioral_details_visible: bool = False,
) -> Assessment:
    """``Assessment`` completo según docs/api-contract.md.

    - Solo se evalúan los indicadores activos del entorno (``env.indicators``);
      un sistema sin indicadores activos no aparece.
    - ``series`` va por ``indicator_id``; un indicador sin serie sale ``unknown``.
    - ``overall_status`` cubre la salud. Combinarlo con el liveness es BE-12;
      aquí ``liveness`` y ``last_seen_at`` solo se copian.
    - ``behavioral_details_visible`` es ``False`` por defecto (privacidad
      conductual); BE-20 decide cuándo es ``True``.
    """
    env_d = _as_dict(env)
    active = set(env_d.get("indicators") or [])
    by_id = {(d := _as_dict(i))["id"]: d for i in indicators}
    protocols = list(protocols)

    system_results: list[SystemAssessment] = []
    for raw_system in systems:
        sys_d = _as_dict(raw_system)
        ids = [i for i in sys_d.get("indicators", []) if i in by_id and (not active or i in active)]
        if not ids:
            continue
        ind_results = [
            build_indicator_assessment(by_id[i], env_d, series.get(i, ()), now) for i in ids
        ]
        status = system_status(r.status for r in ind_results)
        protocol = find_protocol(sys_d["id"], status, protocols)
        system_results.append(
            SystemAssessment(
                system_id=sys_d["id"],
                status=status,
                indicators=ind_results,
                recommendations=recommendations_for(protocol),
                escalation=build_escalation(status, env_d, protocol),
            )
        )

    behavioral_status = next(
        (s.status for s in system_results if s.system_id == BEHAVIORAL_SYSTEM_ID),
        Status.unknown,
    )
    return Assessment(
        member_id=member_id,
        env_id=env_d["id"],
        generated_at=now,
        overall_status=overall_status(s.status for s in system_results),
        liveness=Liveness(liveness),
        last_seen_at=last_seen_at,
        systems=system_results,
        behavioral=BehavioralSummary(
            status=behavioral_status, details_visible=behavioral_details_visible
        ),
    )
