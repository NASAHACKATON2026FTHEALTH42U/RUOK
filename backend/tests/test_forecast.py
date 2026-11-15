"""Tests de FS-09 (previsión por indicador) con series sintéticas.

Los valores esperados salen de la especificación (docstring de ``app/services/forecast.py``
y bloque ``Forecast`` de docs/api-contract.md), no de lo que devuelve la implementación:

- nivel ``l`` y tendencia ``b`` → previsión a h pasos ``l + (φ + φ² + … + φ^h)·b``;
- en una recta sin ruido el mejor ajuste es α = β = 1 (nivel = último valor, tendencia =
  pendiente), así que la previsión es ``último + pendiente·(φ + … + φ^h)`` y el error a un
  paso es ``(1 − φ)·pendiente`` (el modelo amortiguado siempre se queda algo corto).
"""

import random
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from math import sqrt
from types import SimpleNamespace

import pytest

from app.schemas.common import ForecastStatus, Status
from app.schemas.members import Forecast
from app.services import catalog, environments
from app.services.forecast import METHOD, MIN_POINTS, PHI, build_forecast

T0 = datetime(2026, 10, 1, 8, 0, tzinfo=UTC)
DAY = timedelta(days=1)
HOUR = timedelta(hours=1)
ROUNDING = 0.006  # los valores van redondeados a 2 decimales


def daily(values, start=T0, step=1):
    """Serie sintética: un valor cada ``step`` días, a la misma hora."""
    return [(start + timedelta(days=i * step), v) for i, v in enumerate(values)]


def on_days(pairs, start=T0):
    """Serie sintética con huecos: ``[(día, valor)]``."""
    return [(start + timedelta(days=d), v) for d, v in pairs]


def indicator(indicator_id):
    return catalog.get_indicator(indicator_id).model_dump(exclude_none=True)


def environment(env_id):
    return environments.get_environment(env_id).model_dump(exclude_none=True)


def forecast(indicator_id, series, *, env="earth", now=None, **kwargs):
    """Previsión de una serie de tuplas. Por defecto, ``now`` = una hora tras el último dato."""
    if now is None:
        now = max(t for t, _ in series) + HOUR
    return build_forecast(
        member_id=1,
        indicator=indicator(indicator_id),
        env=environment(env),
        series=series,
        now=now,
        **kwargs,
    )


def damped(last, slope, h):
    """Previsión a ``h`` pasos con nivel ``last`` y tendencia ``slope`` (amortiguada con φ)."""
    return last + slope * sum(PHI**k for k in range(1, h + 1))


def values(f):
    return [p.value for p in f.points]


# --- constante, lineal y ruido ------------------------------------------------


def test_constant_series_gives_flat_forecast():
    f = forecast("heart_rate", daily([70] * 10))
    assert f.status == ForecastStatus.ok
    assert f.current_status == Status.normal
    assert values(f) == [70.0] * 7
    assert all(p.low <= p.value <= p.high for p in f.points)
    assert all(p.status == Status.normal for p in f.points)
    assert f.change is None
    # Sin error de ajuste, la banda a un paso es el error de redondeo de la medida por el
    # cuantil 0,90 de la t de Student: 10 puntos dan 9 errores y 7 grados de libertad
    # (tabla: 1,415), así que t·step/√12 = 1,415 · 1/√12 = 0,41 lpm.
    half = 1.415 * 1 / sqrt(12)
    assert f.points[0].low == pytest.approx(70 - half, abs=ROUNDING)
    assert f.points[0].high == pytest.approx(70 + half, abs=ROUNDING)


@pytest.mark.parametrize(("start", "slope", "n"), [(60, 2, 10), (96, -2, 12), (60, 0.5, 10)])
def test_linear_series_continues_with_damped_trend(start, slope, n):
    last = start + slope * (n - 1)
    f = forecast("heart_rate", daily([start + slope * i for i in range(n)]))
    assert f.status == ForecastStatus.ok
    assert values(f) == pytest.approx([damped(last, slope, h) for h in range(1, 8)], abs=ROUNDING)
    # Sigue en la misma dirección pero frenando: cada paso avanza menos que el anterior y
    # el total nunca pasa de pendiente·φ/(1 − φ).
    moves = [b - a for a, b in pairwise([last, *values(f)])]
    assert all(m * slope > 0 for m in moves)
    assert all(abs(later) < abs(earlier) for earlier, later in pairwise(moves))
    assert all(abs(v - last) < abs(slope) * PHI / (1 - PHI) for v in values(f))
    # Validación a un paso: último + φ·pendiente frente a último + pendiente.
    assert f.backtest_mae == pytest.approx((1 - PHI) * abs(slope), abs=ROUNDING)


@pytest.mark.parametrize("seed", [1, 2, 3])
def test_noise_inside_normal_range_keeps_status(seed):
    rng = random.Random(seed)
    f = forecast("heart_rate", daily([round(rng.gauss(75, 3)) for _ in range(30)]))
    assert f.status == ForecastStatus.ok
    assert f.current_status == Status.normal
    assert f.history_days == 30
    assert len(f.points) == 7
    assert all(p.status == Status.normal for p in f.points)
    assert f.change is None
    assert all(66 <= p.value <= 84 for p in f.points)  # media ± 3σ del ruido


# --- cambio de estado previsto ------------------------------------------------


def test_rising_series_change_is_first_point_outside_normal():
    series = daily([50 + 5 * i for i in range(10)])  # … 90, 95 lpm (normal hasta 100)
    last_at = series[-1][0]
    f = forecast("heart_rate", series)
    assert f.current_status == Status.normal
    # 95 + 5·0,8 = 99 (normal); 95 + 5·(0,8 + 0,64) = 102,2 (atención: 101–130).
    assert values(f)[:2] == pytest.approx([99.0, 102.2], abs=ROUNDING)
    assert [p.status for p in f.points[:2]] == [Status.normal, Status.warning]
    assert f.change is not None
    assert f.change.status == Status.warning
    assert f.change.at == last_at + 2 * DAY
    assert f.change.in_days == 2  # ⌈(2 días − 1 h) / 1 día⌉
    first = next(p for p in f.points if p.status != f.current_status)
    assert (f.change.status, f.change.at) == (first.status, first.at)


def test_change_uses_the_environment_ranges():
    series = daily([110 + 4 * i for i in range(8)])  # … 134, 138 mmHg
    mars = forecast("bp_systolic", series, env="mars")
    earth = forecast("bp_systolic", series, env="earth")
    assert mars.current_status == earth.current_status == Status.warning
    # 138 + 4·0,8 = 141,2: crítico en Marte (atención solo hasta 140); en la Tierra la
    # atención llega hasta 180 y la previsión no pasa de 138 + 4·φ/(1 − φ) = 154.
    assert mars.points[0].value == pytest.approx(141.2, abs=ROUNDING)
    assert earth.points[0].value == pytest.approx(141.2, abs=ROUNDING)
    assert mars.change is not None
    assert (mars.change.status, mars.change.in_days) == (Status.critical, 1)
    assert earth.change is None


def test_improving_series_changes_towards_normal():
    series = daily([171 - 5 * i for i in range(8)])  # … 141, 136 mmHg (atención: 130–180)
    f = forecast("bp_systolic", series)
    assert f.current_status == Status.warning
    # 136 − 5·0,8 = 132 (atención); 136 − 5·1,44 = 128,8 (normal: hasta 129).
    assert values(f)[:2] == pytest.approx([132.0, 128.8], abs=ROUNDING)
    assert [p.status for p in f.points[:2]] == [Status.warning, Status.normal]
    assert f.change is not None
    assert (f.change.status, f.change.in_days) == (Status.normal, 2)
    assert f.change.at == f.points[1].at


# --- sin datos = desconocido --------------------------------------------------


def test_fewer_than_7_days_is_insufficient_data():
    assert MIN_POINTS == 7
    f = forecast("heart_rate", daily([70] * 6))
    assert f.status == ForecastStatus.insufficient_data
    assert f.points == []
    assert f.change is None
    assert f.backtest_mae is None
    assert f.step_days is None
    assert f.history_days == 6
    assert f.current_status == Status.normal  # el último dato sí es reciente


def test_exactly_7_days_is_enough():
    f = forecast("heart_rate", daily([70] * 7))
    assert f.status == ForecastStatus.ok
    assert f.history_days == 7
    assert len(f.points) == 7


def test_no_data_at_all():
    f = forecast("heart_rate", [], now=T0)
    assert f.status == ForecastStatus.insufficient_data
    assert f.current_status == Status.unknown
    assert f.points == []
    assert f.change is None
    assert f.history_days == 0
    assert f.last_value_unusual is False


@pytest.mark.parametrize("last_value", [70, 200])  # 200 lpm sería crítico si no hubiera caducado
def test_stale_last_value_gives_no_forecast(last_value):
    series = daily([70] * 9 + [last_value])
    max_age = timedelta(seconds=indicator("heart_rate")["max_age_s"])
    f = forecast("heart_rate", series, now=series[-1][0] + max_age + timedelta(seconds=1))
    assert f.status == ForecastStatus.stale
    assert f.current_status == Status.unknown
    assert f.points == []
    assert f.change is None
    assert f.backtest_mae is None


def test_last_value_at_max_age_is_not_stale_yet():
    series = daily([70] * 10)
    max_age = timedelta(seconds=indicator("heart_rate")["max_age_s"])
    f = forecast("heart_rate", series, now=series[-1][0] + max_age)
    assert f.status == ForecastStatus.ok
    assert f.current_status == Status.normal


# --- cadencia: serie semanal y cambios de cadencia ----------------------------

WEEKLY_WEIGHT = [70.0, 70.2, 69.9, 70.1, 70.0, 70.3, 70.1, 70.2]


def test_weekly_series_forecasts_in_weekly_steps():
    series = daily(WEEKLY_WEIGHT, step=7)
    last_at = series[-1][0]
    f = forecast("weight_kg", series, env="geriatric", horizon_days=14)
    assert f.status == ForecastStatus.ok
    assert (f.step_days, f.history_days, f.horizon_days) == (7, 8, 14)
    assert [p.at for p in f.points] == [last_at + 7 * DAY, last_at + 14 * DAY]
    assert all(p.status == Status.normal for p in f.points)
    assert f.change is None


@pytest.mark.parametrize("horizon_days", [1, 3, 7])
def test_weekly_series_horizon_is_at_least_one_step(horizon_days):
    series = daily(WEEKLY_WEIGHT, step=7)
    f = forecast("weight_kg", series, env="geriatric", horizon_days=horizon_days)
    assert f.horizon_days == 7
    assert [p.at for p in f.points] == [series[-1][0] + 7 * DAY]


def test_cadence_change_is_insufficient_data():
    # 8 semanas midiendo cada semana y después 3 días seguidos: la rejilla semanal que
    # termina en el último día casi no tiene mediciones reales (serían interpoladas).
    days = [0, 7, 14, 21, 28, 35, 42, 49, 50, 51, 52]
    f = forecast("weight_kg", on_days([(d, 70.0) for d in days]), env="geriatric")
    assert f.status == ForecastStatus.insufficient_data
    assert f.points == []
    assert f.change is None


def test_weekly_series_with_a_day_of_jitter_fails_safe():
    # Semanal, pero no siempre el mismo día de la semana (±1 día). La rejilla semanal que
    # termina en el último dato no coincide con casi ninguna medición y hoy la respuesta es
    # `insufficient_data`: un fallo seguro (sin datos = desconocido). Si algún día se
    # prevé, tiene que ser con pasos de una semana: nunca con otra cadencia.
    days = [0, 6, 13, 21, 27, 35, 41, 49, 55, 63]
    f = forecast("weight_kg", on_days([(d, 70.0) for d in days]), env="geriatric")
    assert f.status in (ForecastStatus.ok, ForecastStatus.insufficient_data)
    assert f.step_days == (7 if f.status == ForecastStatus.ok else None)
    assert bool(f.points) == (f.status == ForecastStatus.ok)
    assert all(p.value == 70.0 for p in f.points)
    assert f.change is None


def test_cumulative_weekly_series_never_decreases():
    doses = [100, 104, 107, 111, 115, 118, 122, 125]  # dosis acumulada: solo crece
    f = forecast("radiation_dose", daily(doses, step=7), env="mars", horizon_days=14)
    assert f.status == ForecastStatus.ok
    assert f.step_days == 7
    assert len(f.points) == 2
    assert all(b >= a for a, b in pairwise([125, *values(f)]))
    assert f.points[-1].value > 125  # 7 subidas seguidas: la racha se proyecta


# --- huecos -------------------------------------------------------------------


def test_long_gap_cuts_the_series():
    old = [(d, 150) for d in range(10)]  # antes de un hueco de 11 días: no cuenta
    recent = [(d, 70) for d in range(20, 28)]
    f = forecast("heart_rate", on_days(old + recent))
    assert f.status == ForecastStatus.ok
    assert f.history_days == 8
    assert values(f) == [70.0] * 7
    assert f.backtest_mae == 0


def test_long_gap_can_leave_too_few_recent_days():
    old = [(d, 70) for d in range(20)]
    recent = [(d, 70) for d in range(30, 35)]  # solo 5 días en el tramo reciente
    f = forecast("heart_rate", on_days(old + recent))
    assert f.status == ForecastStatus.insufficient_data
    assert f.points == []


def test_short_gaps_are_tolerated():
    missing = {3, 7, 8}  # huecos de 1 y 2 días
    series = on_days([(d, 60 + 2 * d) for d in range(14) if d not in missing])
    f = forecast("heart_rate", series)
    assert f.status == ForecastStatus.ok
    assert f.step_days == 1
    assert f.history_days == 11  # solo los días con mediciones
    # Interpolar una recta da la misma recta: la previsión es la de la serie completa.
    assert values(f) == pytest.approx([damped(86, 2, h) for h in range(1, 8)], abs=ROUNDING)


# --- límites del input y series que no bajan ----------------------------------


def test_values_are_clamped_to_input_max():
    f = forecast("spo2", daily([91 + i for i in range(9)]))  # … 98, 99 %
    assert f.points[0].value == pytest.approx(99.8, abs=ROUNDING)  # 99 + 0,8
    assert values(f)[1:] == [100.0] * 6  # 99 + 1,44 = 100,44 → 100
    assert all(p.low <= p.value <= p.high <= 100 for p in f.points)


def test_values_are_clamped_to_input_min():
    f = forecast("exercise_min", daily([90 - 10 * i for i in range(9)]), env="mars")  # … 20, 10
    assert f.points[0].value == pytest.approx(2.0, abs=ROUNDING)  # 10 − 10·0,8
    assert values(f)[1:] == [0.0] * 6  # 10 − 10·1,44 = −4,4 → 0
    assert all(0 <= p.low <= p.value <= p.high for p in f.points)


def test_growing_history_is_not_forecast_to_decrease():
    # Dosis acumulada leída a diario: sube un día sí y otro no (justo la mitad de los pasos)
    # y nunca baja. El último día sube mucho más de lo habitual: la medición se trata con
    # cautela, pero una dosis acumulada no vuelve atrás y la previsión no baja de 140.
    doses = [100, 100, 102, 102, 104, 104, 106, 106, 108, 108, 140]
    f = forecast("radiation_dose", daily(doses), env="mars")
    assert f.status == ForecastStatus.ok
    assert all(b >= a for a, b in pairwise([140, *values(f)]))


def test_history_that_barely_grows_is_not_treated_as_cumulative():
    # Nunca ha bajado, pero tampoco ha ido creciendo: solo 4 de sus 20 pasos son subidas
    # (menos de la mitad). El valor alto del final es un valor suelto, no una dosis
    # acumulada, y la previsión vuelve al nivel habitual en vez de quedarse clavada en 110.
    readings = [70] * 3 + [71] * 4 + [72] * 7 + [73] * 6 + [110]
    f = forecast("heart_rate", daily(readings))
    assert f.status == ForecastStatus.ok
    final = f.points[-1].value
    assert abs(final - 73) < abs(final - 110)


def test_history_with_decreases_is_not_treated_as_cumulative():
    # 9 de sus 15 pasos son subidas, pero las 6 últimas mediciones bajan 2 lpm al día: no es
    # una serie acumulada y la previsión sigue la racha de bajadas (al menos 2·φ^h por paso).
    readings = [60 + 2 * i for i in range(10)] + [76 - 2 * i for i in range(6)]  # … 78, 76, … 66
    f = forecast("heart_rate", daily(readings))
    assert f.status == ForecastStatus.ok
    path = [66, *values(f)]
    assert all(b < a for a, b in pairwise(path))
    for h in range(2, 8):
        assert path[h - 1] - path[h] >= 2 * PHI**h - 2 * ROUNDING


# --- valores sueltos ----------------------------------------------------------


def assert_final_outlier_is_not_followed(f, usual, outlier):
    """A 7 pasos el valor esperado sigue más cerca del nivel habitual que del valor suelto,
    y en ningún paso llega hasta él."""
    assert f.status == ForecastStatus.ok
    final = f.points[-1].value  # h = 7
    assert abs(final - usual) < abs(final - outlier)
    if outlier > usual:
        assert all(p.value < outlier for p in f.points)
    else:
        assert all(p.value > outlier for p in f.points)


# Un único valor suelto al final, alto o bajo, no arrastra la previsión: la última medición,
# sin otra que la confirme, mueve el nivel como mucho lo que lo movería una variación normal
# y no toca la tendencia. Casos que antes fallaban:
# - semilla 23: el ajuste elegía α = 0,6 y el nivel se iba hacia el valor suelto;
# - semillas 109 y 190: las 3 mediciones anteriores se movían por azar en la misma dirección
#   (… 69, 70, 72, 73, 110) y el valor suelto «continuaba la racha» y se daba por bueno;
# - semillas 992 y 405: el error del valor suelto decidía el ajuste (α = β ≥ 0,5).
@pytest.mark.parametrize(
    ("seed", "outlier"),
    [
        *[(seed, outlier) for seed in (1, 2, 3, 23) for outlier in (110, 30)],
        (109, 110),
        (190, 30),
        (992, 110),
        (405, 30),
    ],
)
def test_final_outlier_does_not_drag_the_forecast(seed, outlier):
    rng = random.Random(seed)
    usual = 70
    f = forecast("heart_rate", daily([round(rng.gauss(usual, 2)) for _ in range(20)] + [outlier]))
    assert_final_outlier_is_not_followed(f, usual, outlier)


# Con solo 10 mediciones y algo más de ruido pasa más a menudo (≈ 9 % de las series
# simuladas): la primera previsión sube de 94 a 121, más allá del propio valor suelto; la
# segunda baja de 58 a 48.
@pytest.mark.parametrize(
    ("usual", "outlier"),
    [
        ([74, 73, 66, 64, 70, 72, 70, 66, 69, 74], 110),
        ([66, 71, 69, 69, 73, 70, 69, 75, 69, 66], 30),
    ],
)
def test_final_outlier_on_a_short_noisy_history(usual, outlier):
    f = forecast("heart_rate", daily([*usual, outlier]))
    assert_final_outlier_is_not_followed(f, 70, outlier)


# Series planas con un único valor suelto al final: (indicador, nivel habitual, valor suelto).
FLAT_OUTLIERS = [
    ("heart_rate", 70, 110),
    ("heart_rate", 70, 30),
    ("stress", 2, 5),
    ("mood", 2, 5),
    ("mood", 4, 1),
    ("spo2", 98, 85),
]


# Una serie plana con un valor suelto alto al final «nunca ha bajado», pero no es una serie
# acumulada: la regla de las dosis no puede clavar la previsión en el valor suelto.
@pytest.mark.parametrize(("indicator_id", "usual", "outlier"), FLAT_OUTLIERS)
def test_final_outlier_on_a_flat_series(indicator_id, usual, outlier):
    f = forecast(indicator_id, daily([usual] * 20 + [outlier]), env="mars")
    assert_final_outlier_is_not_followed(f, usual, outlier)


NEARLY_FLAT = [70, 70, 70, 70, 70, 70, 70, 70, 69, 71, 70, 70, 70, 71, 70, 70, 70, 70, 70, 71]
NEARLY_FLAT_LOW = [70, 69, 70, 69, 71, 70, 70, 70, 70, 70, 70, 70, 69, 69, 70, 70, 70, 70, 70, 69]


# Con más de la mitad de las diferencias iguales (MAD = 0) el ruido no se estima con una
# desviación típica (el propio valor suelto la inflaría): manda el error de redondeo.
@pytest.mark.parametrize(
    ("usual", "outlier"),
    [(NEARLY_FLAT, 110), (NEARLY_FLAT, 30), (NEARLY_FLAT_LOW, 110), (NEARLY_FLAT_LOW, 30)],
)
def test_final_outlier_on_a_nearly_flat_series(usual, outlier):
    f = forecast("heart_rate", daily([*usual, outlier]))
    assert_final_outlier_is_not_followed(f, 70, outlier)


@pytest.mark.parametrize("seed", [None, 1, 2, 3])
def test_middle_outlier_leaves_forecast_near_usual_level(seed):
    rng = random.Random(seed)
    readings = [70 if seed is None else round(rng.gauss(70, 2)) for _ in range(20)]
    readings[10] = 110
    f = forecast("heart_rate", daily(readings))
    assert all(abs(p.value - 70) < 8 for p in f.points)  # el salto fue de 40
    assert all(p.status == Status.normal for p in f.points)
    assert f.change is None


# --- racha --------------------------------------------------------------------

STABLE_BP = [118, 121, 117, 119, 122, 118, 116, 120, 119, 117]
STABLE_BP += [121, 118, 120, 116, 119, 121, 117, 120, 118, 119]
RUN_BP = [128, 131, 133, 135, 137]  # como el escenario mars_sleep_bp


def test_clean_run_is_projected_forward():
    f = forecast("bp_systolic", daily(STABLE_BP + RUN_BP), env="mars")
    assert f.status == ForecastStatus.ok
    assert f.current_status == Status.warning  # 137: atención en Marte (130–140)
    path = [137, *values(f)]
    assert all(b > a for a, b in pairwise(path))
    # Racha: las últimas subidas son +1, +9, +3, +2, +2, +2 (mediana 2 mmHg/día). La
    # tendencia no es menor, así que el paso h avanza al menos 2·φ^h.
    for h in range(2, 8):
        assert path[h] - path[h - 1] >= 2 * PHI**h - 2 * ROUNDING
    assert f.change is not None
    assert f.change.status == Status.critical  # por encima de 140
    assert 1 <= f.change.in_days <= 7


# --- puntos: fechas, horizonte, banda y redondeo ------------------------------

WOBBLE = [70 + (i % 3) for i in range(12)]  # 70, 71, 72, 70, …


def test_points_are_future_steps_within_horizon():
    series = daily(WOBBLE)
    last_at = series[-1][0]
    now = last_at + HOUR
    f = forecast("heart_rate", series, now=now)
    assert f.generated_at == now
    assert [p.at for p in f.points] == [last_at + k * DAY for k in range(1, 8)]
    assert all(now < p.at <= now + 7 * DAY for p in f.points)


def test_past_step_is_skipped_when_last_measurement_is_from_yesterday():
    series = daily([93 + 5 * i for i in range(7)])  # … 118, 123 mmHg
    last_at = series[-1][0]
    now = last_at + 30 * HOUR  # la tensión caduca a las 48 h
    f = forecast("bp_systolic", series, now=now)
    assert f.status == ForecastStatus.ok
    # El paso 1 (último dato + 1 día) ya ha pasado: se empieza en el paso 2, con su valor.
    assert [p.at for p in f.points] == [last_at + k * DAY for k in range(2, 9)]
    assert all(now < p.at <= now + 7 * DAY for p in f.points)
    assert values(f) == pytest.approx([damped(123, 5, k) for k in range(2, 9)], abs=ROUNDING)
    # 123 + 5·1,44 = 130,2: atención dentro de 18 h → «en 1 día» (redondeo hacia arriba).
    assert f.change is not None
    assert (f.change.status, f.change.at, f.change.in_days) == (
        Status.warning,
        last_at + 2 * DAY,
        1,
    )


def test_point_at_now_is_not_in_the_future():
    series = daily([120] * 10)
    f = forecast("bp_systolic", series, now=series[-1][0] + DAY)
    assert f.points[0].at == series[-1][0] + 2 * DAY


@pytest.mark.parametrize(("requested", "expected"), [(None, 7), (1, 1), (3, 3), (14, 14)])
def test_horizon_days_limits_the_points(requested, expected):
    kwargs = {} if requested is None else {"horizon_days": requested}
    f = forecast("heart_rate", daily(WOBBLE), **kwargs)
    assert f.horizon_days == expected
    assert len(f.points) == expected


def test_band_never_narrows_and_numbers_have_two_decimals():
    rng = random.Random(7)
    series = daily([round(rng.gauss(75, 3)) for _ in range(30)])
    f = forecast("heart_rate", series, horizon_days=14)
    widths = [p.high - p.low for p in f.points]
    assert widths[0] > 0
    assert all(later >= earlier - 0.02 for earlier, later in pairwise(widths))  # redondeo
    assert widths[-1] > widths[0]  # crece con el horizonte
    for p in f.points:
        assert p.low <= p.value <= p.high
        assert all(number == round(number, 2) for number in (p.value, p.low, p.high))
    assert f.backtest_mae == round(f.backtest_mae, 2)


# --- estados ------------------------------------------------------------------


def test_statuses_use_the_environment_overrides():
    series = daily([141] * 10)
    mars = forecast("bp_systolic", series, env="mars")  # Marte: atención solo hasta 140
    earth = forecast("bp_systolic", series, env="earth")
    assert values(mars) == values(earth) == [141.0] * 7
    assert mars.current_status == Status.critical
    assert {p.status for p in mars.points} == {Status.critical}
    assert earth.current_status == Status.warning
    assert {p.status for p in earth.points} == {Status.warning}
    assert mars.change is None
    assert earth.change is None


def test_current_status_is_the_status_of_the_last_raw_value():
    series = daily([120] * 10) + [(T0 + 9 * DAY + 6 * HOUR, 141)]
    f = forecast("bp_systolic", series, env="mars")
    assert f.current_status == Status.critical  # 141, no la media de ese día (130,5)


# --- backtest, días con datos, determinismo y formatos ------------------------


def test_backtest_mae_needs_more_than_7_points():
    assert forecast("heart_rate", daily([70] * 7)).backtest_mae is None
    assert forecast("heart_rate", daily([70] * 8)).backtest_mae == 0
    zigzag = forecast("heart_rate", daily([70, 72] * 6))
    assert zigzag.backtest_mae is not None
    assert zigzag.backtest_mae > 0


def test_several_measurements_on_the_same_day_are_averaged():
    series = []
    for i in range(10):
        series += [(T0 + i * DAY, 60), (T0 + i * DAY + 10 * HOUR, 80)]
    f = forecast("heart_rate", series)
    assert f.history_days == 10  # días con datos, no mediciones
    assert values(f) == [70.0] * 7  # media del día: (60 + 80) / 2
    assert f.points[0].at == series[-1][0] + DAY  # desde la hora del último dato


def test_same_input_gives_identical_output():
    rng = random.Random(11)
    series = daily([round(rng.gauss(118, 4)) for _ in range(30)])
    first = forecast("bp_systolic", series, env="mars")
    second = forecast("bp_systolic", list(series), env="mars")
    assert first == second
    assert first.model_dump(mode="json") == second.model_dump(mode="json")


def test_accepts_tuples_dicts_and_objects():
    tuples = daily([60 + 2 * i for i in range(10)])
    dicts = [{"taken_at": t, "value": v} for t, v in tuples]
    objs = [SimpleNamespace(taken_at=t, value=v) for t, v in tuples]
    now = tuples[-1][0] + HOUR
    expected = forecast("heart_rate", tuples, now=now)
    assert expected.status == ForecastStatus.ok
    assert forecast("heart_rate", dicts, now=now) == expected
    assert forecast("heart_rate", objs, now=now) == expected
    assert forecast("heart_rate", tuples[::-1], now=now) == expected  # el orden no importa
    # El indicador y el entorno también pueden ser los schemas del catálogo.
    from_schemas = build_forecast(
        member_id=1,
        indicator=catalog.get_indicator("heart_rate"),
        env=environments.get_environment("earth"),
        series=tuples,
        now=now,
    )
    assert from_schemas == expected


def test_forecast_fields_follow_the_contract():
    series = daily(STABLE_BP)
    now = series[-1][0] + HOUR
    f = build_forecast(
        member_id=42,
        indicator=indicator("bp_systolic"),
        env=environment("mars"),
        series=series,
        now=now,
    )
    assert isinstance(f, Forecast)
    assert (f.member_id, f.indicator_id, f.unit) == (42, "bp_systolic", "mmHg")
    assert f.generated_at == now
    assert f.method == METHOD == "holt_damped"
    assert (f.status, f.horizon_days, f.step_days) == (ForecastStatus.ok, 7, 1)
    body = f.model_dump(mode="json")
    assert set(body) == {
        "member_id",
        "indicator_id",
        "unit",
        "generated_at",
        "status",
        "method",
        "horizon_days",
        "step_days",
        "history_days",
        "current_status",
        "points",
        "change",
        "backtest_mae",
        "last_value_unusual",
    }
    assert set(body["points"][0]) == {"at", "value", "low", "high", "status"}


# --- última medición sin confirmar ----------------------------------------------


def test_unusual_last_value_is_flagged_and_barely_moves_the_forecast():
    rng = random.Random(7)
    usual = [round(rng.gauss(70, 2)) for _ in range(20)]
    calm = forecast("heart_rate", daily(usual))
    spiked = forecast("heart_rate", daily([*usual, 110]))
    assert calm.last_value_unusual is False
    assert spiked.last_value_unusual is True
    # El valor esperado se mueve como mucho lo que una variación normal (unos pocos lpm),
    # no los 40 lpm del salto.
    assert abs(spiked.points[0].value - calm.points[0].value) < 8


def test_a_second_reading_confirms_a_real_change():
    rng = random.Random(7)
    usual = [round(rng.gauss(70, 2)) for _ in range(20)]
    once = forecast("heart_rate", daily([*usual, 110]))
    twice = forecast("heart_rate", daily([*usual, 110, 110]))
    assert twice.last_value_unusual is False  # la segunda medición coincide con lo esperado
    assert twice.points[0].value > once.points[0].value + 15  # ahora sí sigue el cambio
    assert abs(twice.points[-1].value - 110) < abs(twice.points[-1].value - 70)


def test_last_value_that_continues_a_run_is_trusted():
    # 10 días estables y 5 subidas seguidas: la última continúa la racha, no es un valor suelto.
    stable = [104, 103, 105, 104, 103, 104, 105, 104, 103, 104]
    f = forecast("bp_systolic", daily([*stable, 110, 116, 122, 128, 134]))
    assert f.last_value_unusual is False
    assert f.points[0].value > 134


@pytest.mark.parametrize("status_case", ["insufficient", "stale"])
def test_without_forecast_nothing_is_flagged(status_case):
    series = daily([70, 70, 70, 110]) if status_case == "insufficient" else daily([70] * 9 + [110])
    now = series[-1][0] + (HOUR if status_case == "insufficient" else 3 * DAY)
    f = forecast("heart_rate", series, now=now)
    assert f.status != ForecastStatus.ok
    assert f.last_value_unusual is False


@pytest.mark.parametrize(("indicator_id", "usual", "outlier"), FLAT_OUTLIERS)
def test_final_outlier_on_a_flat_series_is_flagged(indicator_id, usual, outlier):
    f = forecast(indicator_id, daily([usual] * 20 + [outlier]), env="mars")
    assert f.last_value_unusual is True


@pytest.mark.parametrize(
    ("indicator_id", "readings"),
    [
        ("heart_rate", [70] * 10),  # siempre igual
        ("heart_rate", [50 + 5 * i for i in range(10)]),  # sube 5 lpm al día, sin ruido
        ("bp_systolic", [171 - 5 * i for i in range(8)]),  # baja 5 mmHg al día, sin ruido
        ("bp_systolic", STABLE_BP),  # ruido habitual; la última (119) es su media
    ],
)
def test_ordinary_last_value_is_not_flagged(indicator_id, readings):
    f = forecast(indicator_id, daily(readings))
    assert f.status == ForecastStatus.ok
    assert f.last_value_unusual is False


@pytest.mark.parametrize("days_at_the_new_level", [2, 7])
def test_confirmed_change_on_a_flat_history_is_followed(days_at_the_new_level):
    # Un cambio que se mantiene sí mueve la previsión, también cuando el historial era plano.
    f = forecast("heart_rate", daily([70] * 15 + [85] * days_at_the_new_level))
    assert f.last_value_unusual is False
    final = f.points[-1].value
    assert abs(final - 85) < abs(final - 70)


# `last_value_unusual` avisa de una medición que «se aparta de lo esperado mucho más que el
# ruido habitual de la persona» (docs/api-contract.md) y el front pide repetirla. Los tres
# tests siguientes son mediciones que la persona da a menudo y hoy salen marcadas.
# En una escala con muchos valores repetidos el ruido habitual no se queda en el error de
# redondeo: cuenta la variación de siempre, y un valor a un paso de la escala no se marca.
@pytest.mark.parametrize(
    ("indicator_id", "readings"),
    [
        # Saturación casi siempre 98 % y de vez en cuando 97 %.
        ("spo2", [98, 98, 98, 97, 98, 98, 98, 98, 97, 98, 98, 98, 98, 98, 97]),
        # Ánimo casi siempre 3 y algunos días 4.
        ("mood", [3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 4]),
    ],
)
def test_value_the_person_often_gives_is_not_flagged(indicator_id, readings):
    f = forecast(indicator_id, daily(readings))
    assert f.last_value_unusual is False


# Un valor suelto que la medición siguiente no confirma apenas mueve el nivel, así que la
# medición de siempre que viene después no queda «lejos de lo esperado».
@pytest.mark.parametrize("readings_after", [1, 9])
def test_usual_value_after_an_outlier_is_not_flagged(readings_after):
    f = forecast("heart_rate", daily([70] * 19 + [110] + [70] * readings_after))
    assert f.last_value_unusual is False


# Con dos mediciones al día, tras la primera del día siguiente ese día está incompleto: queda
# fuera del ajuste en vez de compararse (solo la de la mañana) con los días completos.
def test_usual_morning_reading_is_not_flagged_before_the_evening_one():
    series = []
    for i in range(10):
        series += [(T0 + i * DAY, 60), (T0 + i * DAY + 10 * HOUR, 80)]
    series.append((T0 + 10 * DAY, 60))  # la mañana siguiente: lo mismo que todas las mañanas
    f = forecast("heart_rate", series)
    assert f.status == ForecastStatus.ok
    assert f.last_value_unusual is False


# --- el día se centra en la hora habitual de medición ---------------------------


@pytest.mark.parametrize("hour", [0, 6, 12, 23])
def test_one_reading_a_day_counts_as_one_day_whatever_the_hour(hour):
    # Una lectura al día con ±40 min de variación. Alrededor de las 00:00 UTC, agrupar por
    # fecha UTC juntaría dos lecturas en un día y dejaría el siguiente vacío.
    rng = random.Random(hour)
    start = datetime(2026, 10, 1, hour, 0, tzinfo=UTC)
    series = [
        (start + timedelta(days=i, minutes=rng.uniform(-40, 40)), 70 + rng.gauss(0, 2))
        for i in range(20)
    ]
    f = forecast("heart_rate", series)
    assert f.status == ForecastStatus.ok
    assert (f.step_days, f.history_days, len(f.points)) == (1, 20, 7)


def test_forecast_does_not_depend_on_the_hour_of_measurement():
    rng = random.Random(3)
    readings = [70 + rng.gauss(0, 2) for _ in range(20)]
    jitter = [rng.uniform(-40, 40) for _ in range(20)]

    def at(hour):
        start = datetime(2026, 10, 1, hour, 0, tzinfo=UTC)
        return [
            (start + timedelta(days=i, minutes=jitter[i]), v) for i, v in enumerate(readings)
        ]

    assert values(forecast("heart_rate", at(0))) == values(forecast("heart_rate", at(12)))


MIDNIGHT = datetime(2026, 10, 1, 0, 0, tzinfo=UTC)
JITTER_MIN = [-50, 35, -20, 55, -5, 10, -45, 40, -30, 25, -15, 50, -35, 5]


@pytest.mark.parametrize("scale", [1, 4])  # hasta ±55 min y hasta ±3 h 40 min
def test_one_reading_a_day_around_midnight_utc_is_a_daily_series(scale):
    # Una lectura al día, unas veces antes y otras después de las 00:00 UTC. Agrupando por
    # fecha UTC, casi todas las fechas tendrían dos lecturas o ninguna.
    series = [
        (MIDNIGHT + timedelta(days=i, minutes=scale * minutes), 60 + 2 * i)
        for i, minutes in enumerate(JITTER_MIN)
    ]
    last_at = series[-1][0]
    f = forecast("heart_rate", series)
    assert f.status == ForecastStatus.ok
    assert (f.step_days, f.history_days) == (1, len(series))  # una lectura = un día
    # La misma previsión que con la recta medida siempre a la misma hora: 86 + 2·(φ + …).
    assert values(f) == pytest.approx([damped(86, 2, h) for h in range(1, 8)], abs=ROUNDING)
    assert [p.at for p in f.points] == [last_at + k * DAY for k in range(1, 8)]
    assert f.backtest_mae == pytest.approx((1 - PHI) * 2, abs=ROUNDING)


MORNING_JITTER_MIN = [-10, 5, -15, 10, -5, 15, -10, 5, -15, 10]
EVENING_JITTER_MIN = [5, -10, 10, -5, 15, -15, 5, -10, 10, -5]
# Con dos horas habituales el corte entre días va en un hueco del reloj que deja cada día con
# sus dos lecturas (también a 12 h justas o a más de 12 h una de otra).
@pytest.mark.parametrize(
    ("morning", "evening"),
    [
        (8, 18),
        (8, 20),
        (7, 21),
    ],
)
def test_morning_and_evening_readings_are_averaged_into_one_day(morning, evening):
    # Dos lecturas al día, 60 por la mañana y 80 por la noche, con ±15 min de variación. La
    # media de cada día es 70 y la última lectura (noche) es la de todas las noches.
    series = []
    for i in range(10):
        day = MIDNIGHT + i * DAY
        series.append((day + timedelta(hours=morning, minutes=MORNING_JITTER_MIN[i]), 60))
        series.append((day + timedelta(hours=evening, minutes=EVENING_JITTER_MIN[i]), 80))
    f = forecast("heart_rate", series)
    assert f.status == ForecastStatus.ok
    assert values(f) == [70.0] * 7
    assert f.last_value_unusual is False


# --- mediciones con fecha futura --------------------------------------------------


def test_measurements_dated_in_the_future_are_ignored():
    series = daily([70 + (i % 3) for i in range(12)])
    now = series[-1][0] + HOUR
    wrong_clock = [*series, (now + 10 * DAY, 180)]  # un dispositivo con el reloj mal
    f = forecast("heart_rate", wrong_clock, now=now)
    assert f == forecast("heart_rate", series, now=now)
    assert all(now < p.at <= now + 7 * DAY for p in f.points)


@pytest.mark.parametrize("ahead", [HOUR, 3 * DAY])
def test_measurement_ahead_of_now_changes_nothing(ahead):
    series = daily([60 + 2 * i for i in range(10)])  # … 76, 78 lpm
    now = series[-1][0] + HOUR
    f = forecast("heart_rate", [*series, (now + ahead, 200)], now=now)
    assert f == forecast("heart_rate", series, now=now)
    assert f.current_status == Status.normal  # el de 78 lpm, no el de los 200 «del futuro»
    assert f.points[0].value == pytest.approx(damped(78, 2, 1), abs=ROUNDING)


def test_only_future_measurements_is_like_no_data():
    f = forecast("heart_rate", daily([70] * 10, start=T0 + DAY), now=T0)
    assert f.status == ForecastStatus.insufficient_data
    assert f.current_status == Status.unknown
    assert (f.history_days, f.points, f.change, f.backtest_mae) == (0, [], None, None)


def test_future_measurement_does_not_hide_a_stale_series():
    series = daily([70] * 10)
    now = series[-1][0] + 3 * DAY  # la frecuencia cardíaca caduca a las 24 h
    f = forecast("heart_rate", [*series, (now + HOUR, 70)], now=now)
    assert f.status == ForecastStatus.stale
    assert f.current_status == Status.unknown
    assert f.points == []


def test_measurement_taken_exactly_now_counts():
    series = daily([70] * 9 + [120])
    now = series[-1][0]
    f = forecast("heart_rate", series, now=now)
    assert f.status == ForecastStatus.ok
    assert f.current_status == Status.warning  # 120 lpm: atención (101–130)
    assert f.history_days == 10
    assert [p.at for p in f.points] == [now + k * DAY for k in range(1, 8)]


def test_slightly_fast_device_clock_is_tolerated():
    # Un móvil con el reloj 2 minutos adelantado: su medición no se descarta (hay un margen
    # de unos minutos) y los puntos siguen siendo posteriores a ahora y dentro del horizonte.
    series = daily([70] * 9 + [120])
    now = series[-1][0] - timedelta(minutes=2)
    f = forecast("heart_rate", series, now=now)
    assert f.status == ForecastStatus.ok
    assert f.current_status == Status.warning
    assert f.history_days == 10
    assert len(f.points) == 7
    assert all(now < p.at <= now + 7 * DAY for p in f.points)
