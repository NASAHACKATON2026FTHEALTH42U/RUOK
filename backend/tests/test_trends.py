"""Tests de BE-10 con series sintéticas."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from app.schemas.common import Status, Trend
from app.services.trends import (
    apply_worsening_rule,
    baseline,
    daily_means,
    trend,
    worsening_streak,
)

T0 = datetime(2026, 11, 1, 8, 0, tzinfo=UTC)


def daily(values, start=T0):
    """Serie sintética: un valor al día, a la misma hora."""
    return [(start + timedelta(days=i), v) for i, v in enumerate(values)]


# --- baseline ---------------------------------------------------------------


def test_baseline_is_mean_of_first_7_days():
    series = daily([110, 120, 115, 125, 118, 112, 119] + [160, 170, 180])
    now = T0 + timedelta(days=10)
    assert baseline(series, now) == pytest.approx(117)  # ignora los días 8-10


def test_baseline_is_none_before_7_days():
    series = daily([110, 120, 115])
    assert baseline(series, T0 + timedelta(days=3)) is None


def test_baseline_empty_series():
    assert baseline([], T0) is None


# --- trend -------------------------------------------------------------------


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        ([120, 128, 136, 144], Trend.rising),
        ([144, 136, 128, 120], Trend.falling),
        ([120, 121, 119, 120], Trend.stable),
        ([120, 130], Trend.insufficient_data),
    ],
)
def test_trend_over_3_day_window(values, expected):
    series = daily(values)
    now = series[-1][0]
    assert trend(series, now) == expected


def test_trend_ignores_points_outside_window():
    # Subida fuerte hace una semana, estable en los últimos 3 días.
    series = daily([90, 100, 110, 120, 130, 140, 140, 141, 140, 140])
    assert trend(series, series[-1][0]) == Trend.stable


def test_trend_with_too_few_recent_points():
    series = daily([120, 130, 140, 150])
    assert trend(series, series[-1][0] + timedelta(days=5)) == Trend.insufficient_data


# --- worsening streak / rule --------------------------------------------------


def test_daily_means_groups_by_day():
    series = [(T0, 100), (T0 + timedelta(hours=4), 110), (T0 + timedelta(days=1), 120)]
    assert [v for _, v in daily_means(series)] == [105, 120]


def test_worsening_streak_higher_is_worse():
    assert worsening_streak(daily([120, 125, 130, 135])) == 3
    assert worsening_streak(daily([120, 125, 122, 130])) == 1


def test_worsening_streak_lower_is_worse():
    # SpO2: bajar es peor.
    assert worsening_streak(daily([99, 98, 97, 96]), higher_is_worse=False) == 3
    assert worsening_streak(daily([99, 98, 97, 96]), higher_is_worse=True) == 0


def test_missing_day_breaks_streak():
    series = daily([120, 125]) + daily([130, 135], start=T0 + timedelta(days=3))
    assert worsening_streak(series) == 1


def test_rule_turns_normal_into_warning_after_3_days():
    assert apply_worsening_rule(Status.normal, daily([110, 112, 115, 118])) == Status.warning
    assert apply_worsening_rule(Status.normal, daily([110, 112, 115])) == Status.normal


def test_rule_never_lowers_or_touches_unknown():
    worsening = daily([110, 112, 115, 118])
    assert apply_worsening_rule(Status.critical, worsening) == Status.critical
    assert apply_worsening_rule(Status.unknown, worsening) == Status.unknown


# --- input formats -------------------------------------------------------------


def test_accepts_dicts_and_objects():
    tuples = daily([120, 128, 136, 144])
    dicts = [{"taken_at": t, "value": v} for t, v in tuples]
    objs = [SimpleNamespace(taken_at=t, value=v) for t, v in tuples]
    now = tuples[-1][0]
    assert trend(dicts, now) == trend(objs, now) == Trend.rising
