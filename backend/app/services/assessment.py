"""Motor de evaluación por indicador (BE-08).

Funciones puras: no tocan la base de datos ni el reloj. Quien las llama
(el router o BE-09) pasa ``now=clock.now()`` y los objetos del catálogo
(``indicators.json``) y del entorno (``environments.json``) como dicts.

Reglas de ``ranges`` (ver docs/api-contract.md, esquema ``Indicator``):

- ``critical_low`` / ``critical_high``: límites duros e inclusivos -> ``critical``.
- ``normal: [lo, hi]`` (inclusivo) -> ``normal``.
- ``warning: [lo, hi]`` (inclusivo) -> ``warning``.
- Un valor que sobrepasa la banda ``warning`` por el lado opuesto a ``normal``
  -> ``critical``. Así, si un entorno estrecha la banda (p. ej. Marte con
  ``warning: [130, 140]``), 150 mmHg es ``critical`` en Marte y ``warning`` en Tierra.
- Cualquier otro valor fuera de ``normal`` -> ``warning``.

Sin datos = desconocido: un valor ausente o más antiguo que ``max_age_s``
da ``unknown``, nunca ``normal``.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime, timedelta
from typing import Any

from app.schemas.common import EscalationMode, Status
from app.schemas.members import Escalation, Recommendation

__all__ = [
    "Status",
    "build_escalation",
    "classify",
    "escalation_for_level",
    "escalation_mode",
    "evaluate_indicator",
    "find_protocol",
    "is_stale",
    "merge_ranges",
    "overall_status",
    "intervention_recommendations",
    "recommendations_for",
    "system_status",
    "worst_status",
]


def _as_dict(obj: Any) -> dict[str, Any]:
    """Acepta dicts (JSON del catálogo) o modelos Pydantic (``app.schemas.config``)."""
    if obj is None:
        return {}
    if hasattr(obj, "model_dump"):
        return obj.model_dump(exclude_none=True)
    return dict(obj)


def merge_ranges(indicator: Any, env: Any = None) -> dict[str, Any]:
    """Rangos del catálogo con los ``threshold_overrides`` del entorno encima.

    La fusión es por clave: el override de ``warning`` sustituye solo a
    ``warning`` y deja intactos ``normal``, ``critical_low``, etc.
    """
    indicator, env = _as_dict(indicator), _as_dict(env)
    ranges = _as_dict(indicator.get("ranges"))
    overrides = _as_dict((env.get("threshold_overrides") or {}).get(indicator["id"]))
    # Un override solo cambia las claves que define: `RangeOverride.model_dump()`
    # trae el resto a None y no debe borrar los rangos del catálogo.
    ranges.update({k: v for k, v in overrides.items() if v is not None})
    return ranges


def is_stale(taken_at: datetime | None, indicator: Any, now: datetime | None) -> bool:
    """True si el dato es más antiguo que ``max_age_s`` del indicador."""
    max_age_s = _as_dict(indicator).get("max_age_s")
    if taken_at is None or now is None or max_age_s is None:
        return False
    return now - taken_at > timedelta(seconds=max_age_s)


def _in(value: float, band: Any) -> bool:
    return band is not None and band[0] <= value <= band[1]


def classify(value: float, ranges: Mapping[str, Any]) -> Status:
    """Clasifica un valor contra unos rangos ya fusionados (sin mirar la edad)."""
    crit_lo = ranges.get("critical_low")
    crit_hi = ranges.get("critical_high")
    if (crit_lo is not None and value <= crit_lo) or (crit_hi is not None and value >= crit_hi):
        return Status.critical

    normal = ranges.get("normal")
    warning = ranges.get("warning")
    if _in(value, normal):
        return Status.normal
    if _in(value, warning):
        return Status.warning

    if normal is not None and warning is not None:
        high_side_band = warning[0] > normal[1]
        low_side_band = warning[1] < normal[0]
        if (high_side_band and value > warning[1]) or (low_side_band and value < warning[0]):
            return Status.critical

    if normal is None and warning is None:
        # Indicador sin rangos configurados: no podemos afirmar nada.
        return Status.unknown
    return Status.warning


def evaluate_indicator(
    value: float | None,
    indicator: Any,
    env: Any = None,
    *,
    taken_at: datetime | None = None,
    now: datetime | None = None,
) -> Status:
    """Estado de un indicador para un valor dado en un entorno.

    ``now`` debe venir de ``app.clock.now()`` (nunca ``datetime.now()``),
    porque la demo acelera el tiempo.
    """
    if value is None or is_stale(taken_at, indicator, now):
        return Status.unknown
    return classify(value, merge_ranges(indicator, env))


# --------------------------------------------------------------------------
# BE-09: agregación por sistema y global, recomendaciones y escalado
# --------------------------------------------------------------------------

# Gravedad para elegir "el peor". `unknown` está por encima de `normal`:
# un sistema sin datos nunca se resume como normal (sin datos = desconocido).
_SEVERITY = {Status.normal: 0, Status.unknown: 1, Status.warning: 2, Status.critical: 3}

# Umbrales de docs/alerts-and-escalation.md ("Modo de escalado según el retardo").
REALTIME_MAX_DELAY_S = 5
AUTONOMOUS_MIN_DELAY_S = 60


def worst_status(statuses: Iterable[Status | str]) -> Status:
    """El peor estado de la lista. Lista vacía -> ``unknown``."""
    ordered = [Status(s) for s in statuses]
    if not ordered:
        return Status.unknown
    return max(ordered, key=_SEVERITY.__getitem__)


def system_status(indicator_statuses: Iterable[Status | str]) -> Status:
    """Estado de un sistema: el peor de sus indicadores."""
    return worst_status(indicator_statuses)


def overall_status(system_statuses: Iterable[Status | str]) -> Status:
    """Estado global de salud: el peor de los sistemas.

    Solo la parte de salud: la combinación con el liveness la hace BE-12.
    """
    return worst_status(system_statuses)


def escalation_mode(comm_delay_s: int, status: Status | str) -> EscalationMode:
    """``realtime`` (< 5 s), ``delayed`` (>= 5 s) o ``autonomous`` (>= 60 s y critical)."""
    if comm_delay_s < REALTIME_MAX_DELAY_S:
        return EscalationMode.realtime
    if comm_delay_s >= AUTONOMOUS_MIN_DELAY_S and Status(status) == Status.critical:
        return EscalationMode.autonomous
    return EscalationMode.delayed


def find_protocol(system_id: str, status: Status | str, protocols: Iterable[Any]) -> dict | None:
    """Primer protocolo de ``protocols.json`` para ese sistema y estado.

    Formato de cada entrada (schema ``Protocol``, CNT-02; lo valida ``services/catalog``)::

        {"id": "proto_cardiovascular_critical", "system_id": "cardiovascular",
         "statuses": ["critical"], "message": "...", "sources": ["S20"],
         "recommendations": [{"id": "rec_...", "text": "...", "priority": 1}]}
    """
    status = Status(status)
    for raw in protocols or []:
        proto = _as_dict(raw)
        if proto.get("system_id") == system_id and status in proto.get("statuses", []):
            return proto
    return None


def recommendations_for(protocol: Mapping[str, Any] | None) -> list[Recommendation]:
    """Recomendaciones del protocolo, ordenadas por prioridad (1 = más importante)."""
    if not protocol:
        return []
    recs = [Recommendation.model_validate(r) for r in protocol.get("recommendations", [])]
    return sorted(recs, key=lambda r: r.priority)


MAX_INTERVENTIONS_PER_SYSTEM = 3
_NEEDS_ACTION = (Status.warning, Status.critical)


def intervention_recommendations(
    system_id: str,
    status: Status | str,
    indicator_statuses: Mapping[str, Status | str],
    interventions: Iterable[Any],
    first_priority: int = 1,
) -> list[Recommendation]:
    """Intervenciones sugeridas para un sistema en ``warning`` o ``critical`` (BE-21).

    - Primero las de sus indicadores alterados (``warning``/``critical``), en el orden
      del JSON; después siempre las **genéricas** del sistema (``indicator_ids`` vacío),
      para que un sistema alterado sugiera al menos una aunque el indicador no tenga
      ninguna propia. Como mucho ``MAX_INTERVENTIONS_PER_SYSTEM``.
    - ``unknown`` o ``normal``: ninguna (sin datos no se recomienda nada).
    """
    if Status(status) not in _NEEDS_ACTION:
        return []
    flagged = {i for i, st in indicator_statuses.items() if Status(st) in _NEEDS_ACTION}
    own = [_as_dict(i) for i in interventions]
    own = [i for i in own if i.get("system_id") == system_id]
    specific = [i for i in own if flagged & set(i.get("indicator_ids") or [])]
    generic = [i for i in own if not i.get("indicator_ids")]
    chosen = (specific[: MAX_INTERVENTIONS_PER_SYSTEM - 1] + generic)[:MAX_INTERVENTIONS_PER_SYSTEM]
    if not generic:
        chosen = specific[:MAX_INTERVENTIONS_PER_SYSTEM]
    return [
        Recommendation(
            id=f"rec_{item['id']}",
            text=f"{item['title']} ({item['duration_min']} min)",
            priority=first_priority + n,
            intervention_id=item["id"],
        )
        for n, item in enumerate(chosen)
    ]


def escalation_for_level(
    level: int, status: Status | str, env: Any, protocol: Mapping[str, Any] | None = None
) -> Escalation:
    """Bloque ``escalation`` para un nivel concreto de ``escalation_ladder`` (BE-31).

    - Niveles **de a bordo** (``level < external_from_level``: self, crew…): se
      resuelven sin enlace → ``realtime`` y ``delay_s = 0``, sea cual sea el retardo.
    - Niveles **externos** (ground, doctor…): salen por el enlace con
      ``comm_delay_s`` → ``realtime`` (< 5 s), ``delayed`` o ``autonomous``
      (>= 60 s y ``critical``).

    BE-14/BE-15 la usan al escalar una alerta a un nivel concreto.
    """
    env = _as_dict(env)
    ladder = env.get("escalation_ladder") or ["self"]
    level = max(0, min(level, len(ladder) - 1))
    onboard = level < env["external_from_level"]
    delay_s = 0 if onboard else int(env.get("comm_delay_s", 0))
    return Escalation(
        level=level,
        target_role=ladder[level],
        mode=EscalationMode.realtime if onboard else escalation_mode(delay_s, status),
        delay_s=delay_s,
        message=(protocol or {}).get("message", ""),
        protocol_id=(protocol or {}).get("id"),
    )


def build_escalation(
    status: Status | str, env: Any, protocol: Mapping[str, Any] | None = None
) -> Escalation:
    """Bloque ``escalation`` de un sistema en el assessment.

    - ``critical`` sube al siguiente nivel de ``escalation_ladder`` (1, la
      tripulación: de a bordo, así que ``realtime`` y sin retardo); el resto se
      queda en ``self`` (0).
    - El modo y el retardo de cada nivel los decide ``escalation_for_level``.
    - ``protocol_id`` y ``message`` vienen del protocolo, si lo hay.
    """
    status = Status(status)
    ladder = _as_dict(env).get("escalation_ladder") or ["self"]
    level = min(1, len(ladder) - 1) if status == Status.critical else 0
    return escalation_for_level(level, status, env, protocol)
