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
    "escalation_mode",
    "evaluate_indicator",
    "find_protocol",
    "is_stale",
    "merge_ranges",
    "overall_status",
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
    ranges.update(overrides)
    return ranges


def is_stale(
    taken_at: datetime | None, indicator: Any, now: datetime | None
) -> bool:
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

    Formato propuesto de cada entrada (ver la PR de BE-09)::

        {"id": "proto_bp_high", "system_id": "cardiovascular",
         "statuses": ["warning", "critical"], "message": "...",
         "steps": ["..."],
         "recommendations": [{"id": "rec_bp_repeat", "text": "...", "priority": 1}]}
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


def build_escalation(
    status: Status | str, env: Any, protocol: Mapping[str, Any] | None = None
) -> Escalation:
    """Bloque ``escalation`` de un sistema.

    - ``critical`` sube al siguiente nivel de ``escalation_ladder`` (1);
      el resto se queda en ``self`` (0).
    - ``mode`` sale de ``comm_delay_s`` y del estado.
    - ``delay_s`` es el retardo del entorno (ETA si sale por el enlace).
    - ``protocol_id`` y ``message`` vienen del protocolo, si lo hay.
    """
    env = _as_dict(env)
    status = Status(status)
    ladder = env.get("escalation_ladder") or ["self"]
    level = min(1, len(ladder) - 1) if status == Status.critical else 0
    delay_s = int(env.get("comm_delay_s", 0))
    return Escalation(
        level=level,
        target_role=ladder[level],
        mode=escalation_mode(delay_s, status),
        delay_s=delay_s,
        message=(protocol or {}).get("message", ""),
        protocol_id=(protocol or {}).get("id"),
    )
