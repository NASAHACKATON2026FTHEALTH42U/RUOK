"""Previsión de valores esperados por indicador (FS-09).

Con las mediciones de **un** indicador de **un** member, estima los valores esperados de
los próximos días, su intervalo de predicción y cuándo el valor esperado cambiaría de
estado (normal / atención / crítico). Es informativa: no crea alertas ni cambia el
``Assessment``.

Modelo: suavizado exponencial de Holt con **tendencia amortiguada** (Gardner y McKenzie,
1985), en su forma de corrección del error, ETS(A,Ad,N) en Hyndman y Athanasopoulos,
*Forecasting: Principles and Practice* (docs/sources.md, S32)::

    previsión a un paso   ŷ(t) = l(t-1) + φ·b(t-1)
    error                 e(t) = y(t) − ŷ(t)
    nivel                 l(t) = ŷ(t) + α·e(t)
    tendencia             b(t) = φ·b(t-1) + β·e(t)

    a h pasos             ŷ(t+h) = l(t) + (φ + φ² + … + φ^h)·b(t)
    varianza a h pasos    σ²·[1 + Σ_{j=1}^{h-1} (α + β·(φ + … + φ^j))²]

- α y β se **ajustan a cada persona e indicador** con sus propias mediciones: se elige
  en una rejilla (0 < α ≤ 1, 0 ≤ β ≤ α) la pareja con menos error a un paso. Los errores
  recientes pesan algo más (``DISCOUNT`` por paso hacia atrás), para seguir a la persona
  tal y como está ahora. φ es fijo.
- **Robusto a valores sueltos** (Gelper, Fried y Croux, 2010): se estima el ruido
  habitual de la serie (σ robusta: MAD de las diferencias entre días) y un error mayor
  que ``OUTLIER_SIGMAS`` σ se recorta al actualizar la tendencia y cuenta de forma lineal,
  no cuadrática, al elegir α y β (pérdida de Huber). Así una medición rara, o un error al
  teclear, no dispara la previsión; un cambio que se mantiene varios días sí la mueve.
- **Racha:** si el valor lleva ``RUN_MOVES`` o más mediciones seguidas moviéndose en la
  misma dirección (por azar eso pasa menos del 2 % de las veces: 2/5!), la tendencia no
  es menor que el ritmo de la racha: la mediana de sus cambios, que ignora un salto
  aislado. Es la misma idea que la regla «empeora ≥ 3 días seguidos» de BE-10.
- La tendencia amortiguada se va frenando, así que la previsión no se dispara.
- El intervalo es el de predicción del 80 %. Su anchura sale del error real del modelo
  con esos datos (σ, sin recortar) y crece con el horizonte.
- ``backtest_mae`` es una validación de origen móvil: se esconde cada uno de los últimos
  pasos, se reajusta el modelo con los anteriores y se mide cuánto falla a un paso.

Preparación de la serie:

- Media por día (UTC), como las tendencias de BE-10.
- La cadencia es la mediana de los días entre mediciones (1 = diaria, 7 = semanal).
- Un hueco de más de ``MAX_GAP_STEPS`` pasos corta la serie: solo cuenta el tramo
  reciente. Los huecos más cortos se rellenan por interpolación lineal para tener una
  serie regular; esos puntos no cuentan al medir el error.
- Sin datos = desconocido: con menos de ``MIN_POINTS`` días con mediciones en el tramo
  reciente, o si más de la mitad de la serie regular serían huecos interpolados
  (``insufficient_data``), o con el último dato caducado según ``max_age_s``
  (``stale``), no se prevé nada.

Salida:

- Los valores previstos se limitan al rango del ``input`` del indicador (un ánimo no
  pasa de 5 ni una saturación del 100 %). Si el historial nunca ha bajado (una dosis
  acumulada), el valor previsto tampoco baja.
- El estado de cada punto sale de los mismos rangos que el motor (``merge_ranges`` y
  ``classify``: catálogo + ``threshold_overrides`` del entorno). Aquí no hay umbrales.

``build_forecast`` es pura: no toca la base de datos ni el reloj (quien llama pasa
``now=clock.now()``). ``forecast_member`` lee las mediciones de la BD.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from itertools import pairwise
from math import ceil, sqrt
from statistics import fmean, median, median_low, pstdev
from typing import Any

from sqlmodel import Session

from app import clock, models
from app.schemas.common import ForecastStatus, Status
from app.schemas.members import Forecast, ForecastChange, ForecastPoint
from app.services import environments, measurements
from app.services.assessment import _as_dict, classify, is_stale, merge_ranges
from app.services.trends import _points, daily_means

__all__ = [
    "DEFAULT_HORIZON_DAYS",
    "DISCOUNT",
    "HISTORY_DAYS",
    "MAX_GAP_STEPS",
    "MAX_HORIZON_DAYS",
    "METHOD",
    "MIN_POINTS",
    "OUTLIER_SIGMAS",
    "PHI",
    "RUN_MOVES",
    "build_forecast",
    "forecast_member",
]

METHOD = "holt_damped"
DEFAULT_HORIZON_DAYS = 7
MAX_HORIZON_DAYS = 14
HISTORY_DAYS = 90  # mediciones que se leen: las de los últimos 90 días
MIN_POINTS = 7  # pasos con datos para ajustar el modelo (una semana, como la línea base de BE-10)
MAX_GAP_STEPS = 3  # un hueco mayor corta la serie
# φ, DISCOUNT, OUTLIER_SIGMAS y RUN_MOVES se eligieron por simulación (series con ruido,
# tendencia, cambio de nivel, rampa y valor suelto, con 10 y 30 puntos): son los de menor
# error medio a 3 y 7 pasos sin que un valor suelto dispare la previsión.
PHI = 0.8  # amortiguación de la tendencia (entre 0,8 y 0,98 en la literatura)
DISCOUNT = 0.95  # peso de un error respecto al del paso siguiente, al ajustar α y β
OUTLIER_SIGMAS = 2.0  # un error mayor que esto (en σ robustas) se trata como valor suelto
RUN_MOVES = 4  # cambios seguidos en la misma dirección que cuentan como racha
Z_80 = 1.2816  # cuantil 0,90 de la normal: intervalo central del 80 %
INIT_POINTS = 5  # puntos con los que se estima la tendencia inicial
BACKTEST_POINTS = 7  # últimos pasos que se validan
ALPHAS = tuple(i / 10 for i in range(1, 11))  # 0,1 … 1,0
BETA_RATIOS = tuple(i / 10 for i in range(11))  # β = razón·α, así 0 ≤ β ≤ α
DECIMALS = 2

_DAY = timedelta(days=1)


@dataclass(frozen=True)
class _Fit:
    """Modelo ajustado: parámetros, estado final y errores a un paso."""

    alpha: float
    beta: float
    level: float
    trend: float
    errors: tuple[float, ...]  # errors[i] es el error al prever y[i + 1]
    loss: float  # error a un paso (Huber), con más peso en lo reciente


# --------------------------------------------------------------------------
# Serie regular
# --------------------------------------------------------------------------


def _recent_segment(days: list[tuple[date, float]], step: int) -> list[tuple[date, float]]:
    """Tramo final de la serie sin huecos de más de ``MAX_GAP_STEPS`` pasos."""
    start = len(days) - 1
    while start > 0 and (days[start][0] - days[start - 1][0]).days <= MAX_GAP_STEPS * step:
        start -= 1
    return days[start:]


def _regular(days: list[tuple[date, float]], step: int) -> tuple[list[float], list[bool]]:
    """Serie regular (un valor cada ``step`` días) que termina en el último día con datos.

    Devuelve los valores y, para cada uno, si es un día con mediciones (``True``) o un
    hueco rellenado por interpolación lineal entre sus vecinos (``False``).
    """
    xs = [d.toordinal() for d, _ in days]
    ys = [v for _, v in days]
    known = dict(zip(xs, ys, strict=True))
    values: list[float] = []
    observed: list[bool] = []
    first = xs[-1] - ((xs[-1] - xs[0]) // step) * step
    i = 0
    for x in range(first, xs[-1] + 1, step):
        if x in known:
            values.append(known[x])
            observed.append(True)
            continue
        while xs[i + 1] < x:
            i += 1
        ratio = (x - xs[i]) / (xs[i + 1] - xs[i])
        values.append(ys[i] + (ys[i + 1] - ys[i]) * ratio)
        observed.append(False)
    return values, observed


# --------------------------------------------------------------------------
# Modelo
# --------------------------------------------------------------------------


def _noise(y: Sequence[float]) -> float:
    """Ruido habitual de la serie, robusto a saltos: MAD de las diferencias entre pasos.

    1,4826·MAD estima la desviación típica de una normal, y la diferencia de dos valores
    con ruido σ tiene desviación √2·σ. Si más de la mitad de las diferencias son iguales
    (MAD = 0, típico en escalas de 1 a 5), se usa su desviación típica.
    """
    diffs = [b - a for a, b in pairwise(y)]
    if not diffs:
        return 0.0
    center = median(diffs)
    mad = median(abs(d - center) for d in diffs)
    spread = 1.4826 * mad if mad > 0 else pstdev(diffs)
    return spread / sqrt(2)


def _smooth(
    y: Sequence[float], alpha: float, beta: float, limit: float | None = None
) -> tuple[float, float, list[float]]:
    """Recorre la serie con (α, β) y devuelve (nivel, tendencia, errores a un paso).

    Con ``limit``, el error que actualiza la tendencia se recorta a ±``limit``: un salto
    aislado mueve el nivel (según α) pero no se convierte en una tendencia desbocada.
    """
    m = min(len(y), INIT_POINTS)
    level = y[0]
    trend = (y[m - 1] - y[0]) / (m - 1) if m > 1 else 0.0
    errors: list[float] = []
    for value in y[1:]:
        predicted = level + PHI * trend
        error = value - predicted
        level = predicted + alpha * error
        trend = PHI * trend + beta * (error if limit is None else _clamp(error, -limit, limit))
        errors.append(error)
    return level, trend, errors


def _huber(error: float, limit: float | None) -> float:
    """Pérdida de Huber: cuadrática hasta ``limit`` y lineal a partir de ahí."""
    size = abs(error)
    if limit is None or size <= limit:
        return size * size
    return limit * (2 * size - limit)


def _fit(y: Sequence[float], noise_floor: float = 0.0) -> _Fit:
    """(α, β) de la rejilla con menos error a un paso (Huber), ponderado por recencia.

    El último error pesa 1 y cada paso hacia atrás, ``DISCOUNT`` veces el siguiente.
    ``noise_floor`` es el error de redondeo de la medida: el ruido estimado no baja de ahí.
    Recorre la rejilla en orden y solo cambia por una mejora real: con empate gana el
    modelo más suave (menos α y menos β), y el resultado es determinista.
    """
    noise = max(_noise(y), noise_floor)
    limit = OUTLIER_SIGMAS * noise if noise > 0 else None
    weights = [DISCOUNT ** (len(y) - 2 - i) for i in range(len(y) - 1)]
    best: _Fit | None = None
    for alpha in ALPHAS:
        for ratio in BETA_RATIOS:
            beta = alpha * ratio
            level, trend, errors = _smooth(y, alpha, beta, limit)
            loss = sum(w * _huber(e, limit) for w, e in zip(weights, errors, strict=True))
            if best is None or loss < best.loss - 1e-9 * max(1.0, best.loss):
                best = _Fit(alpha, beta, level, trend, tuple(errors), loss)
    assert best is not None  # la rejilla nunca está vacía
    return best


def _run_pace(y: Sequence[float], observed: Sequence[bool]) -> float:
    """Ritmo por paso de la racha final, o 0 si no hay racha.

    Racha = los últimos ``RUN_MOVES`` o más cambios entre días **con mediciones** van todos
    en la misma dirección. Su ritmo es la mediana de esos cambios (por paso).
    """
    real = [(i, value) for i, (value, seen) in enumerate(zip(y, observed, strict=True)) if seen]
    moves = [(b[1] - a[1]) / (b[0] - a[0]) for a, b in pairwise(real)]
    if not moves or moves[-1] == 0:
        return 0.0
    rising = moves[-1] > 0
    run: list[float] = []
    for move in reversed(moves):
        if move == 0 or (move > 0) != rising:
            break
        run.append(move)
    return median(run) if len(run) >= RUN_MOVES else 0.0


def _model(y: Sequence[float], observed: Sequence[bool], noise_floor: float = 0.0) -> _Fit:
    """Modelo completo: el ajuste de Holt y, si hay racha, su ritmo como tendencia mínima."""
    fit = _fit(y, noise_floor)
    pace = _run_pace(y, observed)
    if pace > 0:
        return replace(fit, trend=max(fit.trend, pace))
    if pace < 0:
        return replace(fit, trend=min(fit.trend, pace))
    return fit


def _sigma(errors: Sequence[float], observed: Sequence[bool], floor: float) -> float:
    """Desviación típica del error a un paso.

    Solo cuentan los errores de días con mediciones (un hueco interpolado no es un dato),
    salvo que queden menos de 3. Se descuentan los dos parámetros ajustados. ``floor`` es
    el error de redondeo de la medida (``input.step``/√12): la previsión no puede ser más
    precisa que el dato.
    """
    own = [e for e, seen in zip(errors, observed[1:], strict=True) if seen]
    used = own if len(own) >= 3 else list(errors)
    variance = sum(e * e for e in used) / max(1, len(used) - 2)
    return max(sqrt(variance), floor)


def _project(fit: _Fit, sigma: float, steps: int) -> list[tuple[float, float]]:
    """(valor esperado, desviación típica) para 1 … ``steps`` pasos por delante."""
    out: list[tuple[float, float]] = []
    damped = 0.0  # φ + φ² + … + φ^h
    spread = 1.0  # 1 + Σ (α + β·(φ + … + φ^j))², j < h
    for h in range(1, steps + 1):
        if h > 1:
            spread += (fit.alpha + fit.beta * damped) ** 2
        damped += PHI**h
        out.append((fit.level + damped * fit.trend, sigma * sqrt(spread)))
    return out


def _backtest(
    y: Sequence[float], observed: Sequence[bool], noise_floor: float = 0.0
) -> float | None:
    """Error absoluto medio a un paso en los últimos pasos, reajustando en cada uno.

    ``None`` si no hay ningún paso que validar con al menos ``MIN_POINTS`` anteriores.
    """
    errors: list[float] = []
    for i in range(max(MIN_POINTS, len(y) - BACKTEST_POINTS), len(y)):
        if not observed[i]:
            continue
        fit = _model(y[:i], observed[:i], noise_floor)
        errors.append(abs(y[i] - (fit.level + PHI * fit.trend)))
    return round(fmean(errors), DECIMALS) if errors else None


def _clamp(value: float, lo: float | None, hi: float | None) -> float:
    if lo is not None:
        value = max(value, lo)
    if hi is not None:
        value = min(value, hi)
    return value


# --------------------------------------------------------------------------
# Previsión
# --------------------------------------------------------------------------


def build_forecast(
    *,
    member_id: int,
    indicator: Any,
    env: Any,
    series: Iterable[Any],
    now: datetime,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> Forecast:
    """``Forecast`` de un indicador según docs/api-contract.md.

    ``indicator`` y ``env`` son los del catálogo (dicts o schemas); ``series``, las
    mediciones del indicador (como en ``services/trends.py``); ``now``, ``clock.now()``.
    """
    ind = _as_dict(indicator)
    ranges = merge_ranges(ind, env)
    points = _points(series)

    def result(status: ForecastStatus, current: Status = Status.unknown, **fields: Any) -> Forecast:
        return Forecast(
            member_id=member_id,
            indicator_id=ind["id"],
            unit=ind.get("unit", ""),
            generated_at=now,
            status=status,
            method=METHOD,
            horizon_days=fields.pop("horizon", horizon_days),
            current_status=current,
            **fields,
        )

    if not points:
        return result(ForecastStatus.insufficient_data)
    last_at, last_value = points[-1]
    if is_stale(last_at, ind, now):
        return result(ForecastStatus.stale)  # como el motor: un dato caducado es `unknown`
    current = classify(last_value, ranges)

    days = daily_means(points)
    if len(days) < 2:
        return result(ForecastStatus.insufficient_data, current, history_days=len(days))
    step = median_low([(b[0] - a[0]).days for a, b in pairwise(days)])
    days = _recent_segment(days, step)
    y, observed = _regular(days, step)
    # Días reales suficientes y que sean mayoría: una serie casi toda interpolada (p. ej.
    # al pasar de medir cada semana a cada día) no es base para prever.
    if sum(observed) < MIN_POINTS or 2 * sum(observed) < len(y):
        return result(ForecastStatus.insufficient_data, current, history_days=sum(observed))

    input_spec = _as_dict(ind.get("input"))
    rounding = (input_spec.get("step") or 0) / sqrt(12)  # error de redondeo de la medida
    fit = _model(y, observed, rounding)
    sigma = _sigma(fit.errors, observed, rounding)

    # Pasos hasta cubrir el horizonte desde AHORA (el último dato puede ser de ayer).
    horizon = max(horizon_days, step)
    step_td = timedelta(days=step)
    steps = max(1, (now - last_at + timedelta(days=horizon)) // step_td)

    lo, hi = input_spec.get("min"), input_spec.get("max")
    never_decreases = y[-1] > y[0] and all(b >= a for a, b in pairwise(y))
    floor = y[-1]
    forecast_points: list[ForecastPoint] = []
    for h, (value, deviation) in enumerate(_project(fit, sigma, steps), start=1):
        if never_decreases:
            value = floor = max(value, floor)
        value = _clamp(value, lo, hi)
        at = last_at + h * step_td
        if at <= now:
            continue  # ese paso ya ha pasado (sin medición nueva); su incertidumbre sí cuenta
        rounded = round(value, DECIMALS)
        forecast_points.append(
            ForecastPoint(
                at=at,
                value=rounded,
                low=round(_clamp(value - Z_80 * deviation, lo, hi), DECIMALS),
                high=round(_clamp(value + Z_80 * deviation, lo, hi), DECIMALS),
                status=classify(rounded, ranges),
            )
        )

    change = None
    if current != Status.unknown:
        first = next((p for p in forecast_points if p.status != current), None)
        if first is not None:
            change = ForecastChange(
                status=first.status,
                at=first.at,
                in_days=max(1, ceil((first.at - now) / _DAY)),
            )

    return result(
        ForecastStatus.ok,
        current,
        horizon=horizon,
        step_days=step,
        history_days=sum(observed),
        points=forecast_points,
        change=change,
        backtest_mae=_backtest(y, observed, rounding),
    )


def forecast_member(
    session: Session,
    member: models.Member,
    indicator: Any,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> Forecast:
    """``Forecast`` real de un member: sus mediciones de la BD y los rangos de su entorno."""
    now = clock.now()
    rows = measurements.list_series(
        session, member.id, _as_dict(indicator)["id"], from_=now - timedelta(days=HISTORY_DAYS)
    )
    return build_forecast(
        member_id=member.id,
        indicator=indicator,
        env=environments.get_environment(member.env_id),
        series=rows,
        now=now,
        horizon_days=horizon_days,
    )
