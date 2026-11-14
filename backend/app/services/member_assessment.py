"""Composición del ``Assessment`` completo de un member (BE-11).

Función pura: junta el motor por indicador (BE-08), la agregación y el
escalado (BE-09) y las tendencias (BE-10). No toca la base de datos ni el
reloj; el router le pasa el member, el entorno, los catálogos, las series de
mediciones y ``now=clock.now()``.

Para evaluar "con otro perfil sin modificar datos" (``?env=``), basta con
pasar otro ``env``: las series y el member no cambian.
"""

from __future__ import annotations

import json
from collections import defaultdict
from collections.abc import Iterable, Mapping
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app import clock, models
from app.schemas.common import Liveness, Status
from app.schemas.members import (
    Assessment,
    BehavioralSummary,
    IndicatorAssessment,
    SystemAssessment,
)
from app.services import behavioral, catalog, environments, measurements
from app.services.assessment import (
    _as_dict,
    build_escalation,
    evaluate_indicator,
    find_protocol,
    merge_ranges,
    overall_status,
    recommendations_for,
    system_status,
    worst_status,
)
from app.services.liveness import combine_overall, member_liveness
from app.services.trends import _points, apply_worsening_rule, baseline, trend

__all__ = [
    "BEHAVIORAL_SYSTEM_ID",
    "UnknownEnvironment",
    "assess_member",
    "build_assessment",
    "build_indicator_assessment",
    "load_protocols",
]

PROTOCOLS_FILE = Path(__file__).resolve().parent.parent / "data" / "protocols.json"

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


def _apply_behavioral_rules(
    ind_results: list[IndicatorAssessment],
    status: Status,
    by_id: Mapping[str, dict],
    ids: list[str],
    series: Mapping[str, Iterable[Any]],
    now: datetime,
) -> Status:
    """Reglas de BE-20: suben a ``warning`` sus indicadores y, con varias, el sistema a critical."""
    # sleep_hours entra en la regla del PVT aunque no sea conductual: está en el mismo sistema.
    fired = behavioral.evaluate_rules(series, {i: by_id[i] for i in ids}, now)
    if not fired:
        return status
    flagged = {f.indicator_id for f in fired}
    for result in ind_results:
        if result.indicator_id in flagged and result.status == Status.normal:
            result.status = Status.warning
    status = system_status(r.status for r in ind_results)
    if len(fired) >= behavioral.load_rules()["critical_when_rules"]:
        status = worst_status([status, Status.critical])
    return status


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
    - En el sistema neuro-conductual se aplican las reglas frente a la línea
      base (``services/behavioral.py``, BE-20).
    - ``behavioral_details_visible`` es ``False`` por defecto (privacidad
      conductual). Ocultar los detalles en la respuesta es ``behavioral.redact``.
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
        if sys_d["id"] == BEHAVIORAL_SYSTEM_ID:
            status = _apply_behavioral_rules(ind_results, status, by_id, ids, series, now)
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


# --------------------------------------------------------------------------
# BE-11 (parte 2): evaluación de un member de la BD
# --------------------------------------------------------------------------


class UnknownEnvironment(LookupError):
    """``env`` no existe en environments.json (el router responde 404)."""


def load_protocols(path: Path = PROTOCOLS_FILE) -> list[dict]:
    """Protocolos de ``data/protocols.json`` (CNT-03). Sin fichero, lista vacía."""
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def assess_member(
    session: Session, member: models.Member, env_id: str | None = None
) -> Assessment:
    """``Assessment`` real de un member con sus mediciones de la BD.

    Con ``env_id`` se evalúa con otro perfil sin modificar nada (``?env=``).
    ``overall_status`` es el peor entre la salud y el liveness real (BE-12).
    """
    env = environments.get_environment(env_id or member.env_id)
    if env is None:
        raise UnknownEnvironment(env_id or member.env_id)

    series: dict[str, list[Any]] = defaultdict(list)
    for row in measurements.list_series(session, member.id):
        series[row.indicator_id].append(row)

    liveness = member_liveness(member)
    emergency_open = session.exec(
        select(models.Alert.id).where(
            models.Alert.member_id == member.id,
            models.Alert.severity == "emergency",
            models.Alert.status != "resolved",
        )
    ).first() is not None
    assessment = build_assessment(
        member_id=member.id,
        env=env,
        indicators=catalog.list_indicators(),
        systems=catalog.list_systems(),
        series=series,
        protocols=load_protocols(),
        now=clock.now(),
        liveness=liveness,
        last_seen_at=member.last_seen_at,
        # Sin saber quién consulta (llega con BE-26/BE-27): privado salvo que el
        # member comparta o haya una emergencia abierta (BE-20).
        behavioral_details_visible=behavioral.details_visible(
            share_behavioral_details=member.share_behavioral_details,
            emergency_open=emergency_open,
        ),
    )
    assessment.overall_status = combine_overall(assessment.overall_status, liveness)
    return assessment
