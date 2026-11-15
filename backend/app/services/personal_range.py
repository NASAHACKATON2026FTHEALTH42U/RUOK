"""Rango habitual personal de un indicador (informativo, no clínico).

Función pura sobre la serie de **un** indicador de **un** member. No toca la
base de datos ni el reloj: quien llama pasa ``now=clock.now()``.

Regla estadística (``app/data/personal_ranges.json``, ver docs/sources.md):

- Se toman las mediciones de los últimos ``window_days`` días **sin contar la
  última** (la que se compara). Con menos de ``min_points``, no hay rango.
- Centro = media de esas mediciones; semiancho =
  ``max(k_sd × desviación típica, min_band_ratio × |media|)``.
- ``personal_flag`` compara el último valor con ese rango (límites inclusivos).

No cambia el ``status``, ni las alertas, ni el escalado: solo informa.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from datetime import datetime, timedelta
from functools import cache
from pathlib import Path
from statistics import fmean, pstdev
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Range
from app.services.trends import _points

__all__ = [
    "CONFIG_FILE",
    "PersonalRangeConfig",
    "load_config",
    "personal_flag",
    "personal_range",
]

CONFIG_FILE = Path(__file__).resolve().parent.parent / "data" / "personal_ranges.json"

PersonalFlag = Literal["within", "above", "below"]


class PersonalRangeConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    window_days: int = Field(gt=0)
    min_points: int = Field(ge=2)
    k_sd: float = Field(gt=0)
    min_band_ratio: float = Field(ge=0)
    skip_indicators: list[str] = Field(default_factory=list)


@cache
def load_config(path: Path = CONFIG_FILE) -> PersonalRangeConfig:
    """Lee y valida la configuración (falla al arrancar si está mal)."""
    return PersonalRangeConfig.model_validate(json.loads(path.read_text(encoding="utf-8")))


def personal_range(
    indicator_id: str,
    series: Iterable[Any],
    now: datetime,
    config: PersonalRangeConfig | None = None,
) -> Range | None:
    """``(low, high)`` habitual del member, o ``None`` si no hay datos suficientes."""
    cfg = config or load_config()
    if indicator_id in cfg.skip_indicators:
        return None
    start = now - timedelta(days=cfg.window_days)
    history = [v for t, v in _points(series)[:-1] if start <= t <= now]
    if len(history) < cfg.min_points:
        return None
    center = fmean(history)
    half = max(cfg.k_sd * pstdev(history), cfg.min_band_ratio * abs(center))
    return (round(center - half, 2), round(center + half, 2))


def personal_flag(value: float | None, rng: Range | None) -> PersonalFlag | None:
    """Último valor frente al rango habitual. ``None`` sin valor o sin rango."""
    if value is None or rng is None:
        return None
    low, high = rng
    if value > high:
        return "above"
    if value < low:
        return "below"
    return "within"
