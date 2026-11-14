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

from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

from app.schemas.common import Status

__all__ = ["Status", "classify", "evaluate_indicator", "is_stale", "merge_ranges"]


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
