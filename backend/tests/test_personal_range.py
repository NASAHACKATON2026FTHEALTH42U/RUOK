"""Rango habitual personal (informativo): media ± max(k·DE, ratio·|media|)."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.common import Status
from app.services import personal_range as pr
from app.services.member_assessment import build_indicator_assessment

NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)
CFG = pr.PersonalRangeConfig(
    window_days=30, min_points=7, k_sd=2.0, min_band_ratio=0.05, skip_indicators=["radiation_dose"]
)
HR = {
    "id": "heart_rate",
    "unit": "bpm",
    "ranges": {"normal": [50, 100], "warning": [101, 129], "critical_high": 130},
    "max_age_s": 172800,
}


def daily(values, *, last_hours_ago=1):
    """Una medición por día; la última hace ``last_hours_ago`` horas."""
    n = len(values)
    end = NOW - timedelta(hours=last_hours_ago)
    return [(end - timedelta(days=n - 1 - i), v) for i, v in enumerate(values)]


def test_config_file_is_valid():
    cfg = pr.load_config()
    assert cfg.window_days > 0 and cfg.min_points >= 2 and cfg.k_sd > 0


def test_invalid_config_is_rejected():
    with pytest.raises(ValidationError):
        pr.PersonalRangeConfig(window_days=0, min_points=7, k_sd=2.0, min_band_ratio=0.05)
    with pytest.raises(ValidationError):
        pr.PersonalRangeConfig(
            window_days=30, min_points=7, k_sd=2.0, min_band_ratio=0.05, extra_key=1
        )


def test_not_enough_points_gives_none():
    series = daily([70] * 7)  # 6 de historial + el último
    assert pr.personal_range("heart_rate", series, NOW, CFG) is None


def test_band_uses_sd_when_wider_than_min_band():
    history = [70, 80, 70, 80, 70, 80, 70, 80]  # media 75, DE poblacional 5
    rng = pr.personal_range("heart_rate", daily([*history, 999]), NOW, CFG)
    assert rng == (65.0, 85.0)  # el último valor (999) no entra en el cálculo


def test_band_uses_min_ratio_when_series_is_flat():
    rng = pr.personal_range("heart_rate", daily([80] * 8 + [80]), NOW, CFG)
    assert rng == (76.0, 84.0)  # 5 % de 80


def test_old_points_outside_window_are_ignored():
    old = [(NOW - timedelta(days=60 + i), 200.0) for i in range(10)]
    recent = daily([80] * 8 + [80])
    assert pr.personal_range("heart_rate", old + recent, NOW, CFG) == (76.0, 84.0)
    assert pr.personal_range("heart_rate", old, NOW, CFG) is None


def test_skipped_indicator_gives_none():
    assert pr.personal_range("radiation_dose", daily([1.0] * 20), NOW, CFG) is None


@pytest.mark.parametrize(
    ("value", "flag"),
    [(None, None), (80, "within"), (76, "within"), (84, "within"), (90, "above"), (70, "below")],
)
def test_flag(value, flag):
    assert pr.personal_flag(value, (76.0, 84.0)) == flag


def test_flag_without_range_is_none():
    assert pr.personal_flag(80, None) is None


def test_indicator_assessment_includes_personal_range_without_changing_status():
    # 92 lpm está dentro del rango poblacional (normal) pero por encima del habitual.
    result = build_indicator_assessment(HR, {}, daily([60] * 10 + [92]), NOW)
    assert result.status == Status.normal
    assert result.personal_range == (57.0, 63.0)
    assert result.personal_flag == "above"


def test_indicator_assessment_without_history():
    result = build_indicator_assessment(HR, {}, daily([60, 61]), NOW)
    assert result.personal_range is None
    assert result.personal_flag is None


def test_stale_last_value_is_not_flagged():
    result = build_indicator_assessment(HR, {}, daily([60] * 10 + [92], last_hours_ago=72), NOW)
    assert result.status == Status.unknown
    assert result.personal_flag is None
