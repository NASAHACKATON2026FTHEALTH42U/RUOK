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


def test_history_that_never_decreases_is_not_forecast_to_decrease():
    doses = [100, 100, 103, 103, 103, 110, 110, 112, 112, 112]
    f = forecast("radiation_dose", daily(doses), env="mars")
    assert f.status == ForecastStatus.ok
    assert all(b >= a for a, b in pairwise([112, *values(f)]))


# --- valores sueltos ----------------------------------------------------------

# Un único valor suelto al final no arrastra la previsión: la última medición, sin otra que
# la confirme, mueve el nivel como mucho lo que lo movería una variación normal (con la
# semilla 23 el ajuste elige α = 0,6 y antes se iba más cerca del valor suelto).
@pytest.mark.parametrize("seed", [1, 2, 3, 23])
def test_final_outlier_does_not_drag_the_forecast(seed):
    rng = random.Random(seed)
    usual, outlier = 70, 110
    f = forecast("heart_rate", daily([round(rng.gauss(usual, 2)) for _ in range(20)] + [outlier]))
    final = f.points[-1].value  # h = 7
    assert abs(final - usual) < abs(final - outlier)
    assert all(p.value < outlier for p in f.points)


# Una serie plana con un valor suelto alto al final «nunca ha bajado», pero no es una serie
# acumulada: la regla de las dosis no puede clavar la previsión en el valor suelto.
@pytest.mark.parametrize(
    ("indicator_id", "usual", "outlier"), [("heart_rate", 70, 110), ("stress", 2, 5)]
)
def test_final_outlier_on_a_flat_series(indicator_id, usual, outlier):
    f = forecast(indicator_id, daily([usual] * 20 + [outlier]), env="mars")
    final = f.points[-1].value
    assert abs(final - usual) < abs(final - outlier)


# Con más de la mitad de las diferencias iguales (MAD = 0) el ruido no se estima con una
# desviación típica (el propio valor suelto la inflaría): manda el error de redondeo.
def test_final_outlier_on_a_nearly_flat_series():
    usual = [70, 70, 70, 70, 70, 70, 70, 70, 69, 71, 70, 70, 70, 71, 70, 70, 70, 70, 70, 71]
    f = forecast("heart_rate", daily([*usual, 110]))
    assert all(p.value <= 110 for p in f.points)
    assert abs(f.points[-1].value - 70) < abs(f.points[-1].value - 110)


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


# --- mediciones con fecha futura --------------------------------------------------


def test_measurements_dated_in_the_future_are_ignored():
    series = daily([70 + (i % 3) for i in range(12)])
    now = series[-1][0] + HOUR
    wrong_clock = [*series, (now + 10 * DAY, 180)]  # un dispositivo con el reloj mal
    f = forecast("heart_rate", wrong_clock, now=now)
    assert f == forecast("heart_rate", series, now=now)
    assert all(now < p.at <= now + 7 * DAY for p in f.points)
