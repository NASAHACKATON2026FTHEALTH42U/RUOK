"""Tendencias y línea base personal (BE-10).

Funciones puras sobre una serie de mediciones de **un** indicador de **un**
member. No tocan la base de datos ni el reloj: quien llama pasa
``now=clock.now()``.

Cada punto de la serie puede ser una tupla ``(taken_at, value)``, un dict con
``taken_at`` y ``value`` o un objeto con esos atributos (``models.Measurement``).

Reglas (docs/behavioral-health.md e issue BE-10):

- **Línea base:** media de los primeros 7 días desde la primera medición.
  Hasta que no han pasado esos 7 días es ``None`` (aún no hay línea base).
- **Tendencia:** pendiente por mínimos cuadrados en la ventana de los últimos
  3 días. Con menos de 3 puntos, ``insufficient_data``. Si el cambio que
  predice la pendiente en la ventana es menor que el 5 % del valor medio,
  ``stable``. ``rising``/``falling`` describen la dirección del valor, no si
  es mejor o peor.
- **Regla "empeora ≥ 3 días seguidos":** se agrupa por día (UTC) con la media
  diaria y se cuentan los días consecutivos en que la media empeora respecto
  al día anterior (sube si ``higher_is_worse``, baja si no). Un día sin datos
  corta la racha. Con 3 o más, un indicador ``normal`` pasa a ``warning``.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, timedelta
from statistics import fmean
from typing import Any

from app.schemas.common import Status, Trend

__all__ = [
    "BASELINE_DAYS",
    "STABLE_TOLERANCE",
    "TREND_MIN_POINTS",
    "TREND_WINDOW_DAYS",
    "WORSENING_DAYS",
    "apply_worsening_rule",
    "baseline",
    "daily_means",
    "trend",
    "worsening_streak",
]

BASELINE_DAYS = 7
TREND_WINDOW_DAYS = 3
TREND_MIN_POINTS = 3
STABLE_TOLERANCE = 0.05  # 5 % del valor medio en la ventana
WORSENING_DAYS = 3

Point = tuple[datetime, float]


def _points(series: Iterable[Any]) -> list[Point]:
    """Normaliza la serie a ``[(taken_at, value)]`` ordenada por fecha."""
    out: list[Point] = []
    for p in series or []:
        if isinstance(p, tuple | list):
            taken_at, value = p
        elif isinstance(p, dict):
            taken_at, value = p["taken_at"], p["value"]
        else:
            taken_at, value = p.taken_at, p.value
        if value is not None:
            out.append((taken_at, float(value)))
    return sorted(out, key=lambda p: p[0])


def baseline(
    series: Iterable[Any], now: datetime, *, days: int = BASELINE_DAYS
) -> float | None:
    """Media de los primeros ``days`` días. ``None`` si aún no han pasado."""
    points = _points(series)
    if not points:
        return None
    start = points[0][0]
    end = start + timedelta(days=days)
    if now < end:
        return None
    return fmean(v for t, v in points if t < end)


def trend(
    series: Iterable[Any],
    now: datetime,
    *,
    window_days: int = TREND_WINDOW_DAYS,
    min_points: int = TREND_MIN_POINTS,
    tolerance: float = STABLE_TOLERANCE,
) -> Trend:
    """Dirección del valor en los últimos ``window_days`` días."""
    window_start = now - timedelta(days=window_days)
    points = [(t, v) for t, v in _points(series) if window_start <= t <= now]
    if len(points) < min_points:
        return Trend.insufficient_data

    xs = [(t - points[0][0]).total_seconds() for t, _ in points]
    ys = [v for _, v in points]
    mean_x, mean_y = fmean(xs), fmean(ys)
    var_x = sum((x - mean_x) ** 2 for x in xs)
    if var_x == 0:  # todas a la vez: no hay dirección
        return Trend.insufficient_data
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys, strict=True)) / var_x

    change = slope * (xs[-1] - xs[0])
    if abs(change) <= tolerance * abs(mean_y):
        return Trend.stable
    return Trend.rising if change > 0 else Trend.falling


def daily_means(series: Iterable[Any]) -> list[tuple[date, float]]:
    """Media por día (UTC), ordenada por fecha."""
    by_day: dict[date, list[float]] = {}
    for t, v in _points(series):
        by_day.setdefault(t.date(), []).append(v)
    return [(d, fmean(vs)) for d, vs in sorted(by_day.items())]


def worsening_streak(series: Iterable[Any], *, higher_is_worse: bool = True) -> int:
    """Días consecutivos, contando desde el último, en que la media diaria empeora."""
    days = daily_means(series)
    streak = 0
    for (prev_day, prev), (day, cur) in zip(reversed(days[:-1]), reversed(days[1:]), strict=True):
        consecutive = day - prev_day == timedelta(days=1)
        worse = cur > prev if higher_is_worse else cur < prev
        if not (consecutive and worse):
            break
        streak += 1
    return streak


def apply_worsening_rule(
    status: Status | str,
    series: Iterable[Any],
    *,
    higher_is_worse: bool = True,
    days: int = WORSENING_DAYS,
) -> Status:
    """``normal`` pasa a ``warning`` si el indicador empeora ``days`` días seguidos.

    No baja nunca un estado (``warning``/``critical`` se mantienen) y no toca
    ``unknown``: sin datos recientes no se afirma nada.
    """
    status = Status(status)
    if status != Status.normal:
        return status
    if worsening_streak(series, higher_is_worse=higher_is_worse) >= days:
        return Status.warning
    return status
