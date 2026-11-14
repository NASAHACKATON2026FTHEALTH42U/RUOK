from datetime import UTC, datetime, timedelta

import pytest

from app.services.assessment import Status, evaluate_indicator, merge_ranges

# Fixtures con la forma de docs/api-contract.md (Indicator / Environment).
BP_SYSTOLIC = {
    "id": "bp_systolic",
    "ranges": {
        "normal": [90, 129],
        "warning": [130, 159],
        "critical_low": 80,
        "critical_high": 160,
    },
    "max_age_s": 172800,
    "higher_is_worse": True,
}
SPO2 = {
    "id": "spo2",
    "ranges": {"normal": [95, 100], "warning": [90, 94], "critical_low": 89},
    "max_age_s": 86400,
}
MARS = {"id": "mars", "threshold_overrides": {"bp_systolic": {"warning": [130, 140]}}}
EARTH = {"id": "earth", "threshold_overrides": {}}

NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (118, Status.normal),
        (129, Status.normal),
        (130, Status.warning),
        (159, Status.warning),
        (160, Status.critical),
        (85, Status.warning),  # por debajo de normal, sin llegar a critical_low
        (80, Status.critical),
    ],
)
def test_bp_bands_on_earth(value, expected):
    assert evaluate_indicator(value, BP_SYSTOLIC, EARTH) == expected


def test_high_bp_on_mars_is_critical():
    assert evaluate_indicator(150, BP_SYSTOLIC, MARS) == Status.critical


def test_same_value_differs_by_environment():
    assert evaluate_indicator(150, BP_SYSTOLIC, EARTH) == Status.warning
    assert evaluate_indicator(150, BP_SYSTOLIC, MARS) == Status.critical


def test_mars_override_keeps_other_ranges():
    merged = merge_ranges(BP_SYSTOLIC, MARS)
    assert merged["warning"] == [130, 140]
    assert merged["normal"] == [90, 129]
    assert merged["critical_high"] == 160
    # El catálogo no se modifica.
    assert BP_SYSTOLIC["ranges"]["warning"] == [130, 159]


def test_no_env_uses_catalog_ranges():
    assert evaluate_indicator(150, BP_SYSTOLIC) == Status.warning


@pytest.mark.parametrize(
    ("value", "expected"),
    [(97, Status.normal), (92, Status.warning), (89, Status.critical), (85, Status.critical)],
)
def test_low_side_warning_band(value, expected):
    assert evaluate_indicator(value, SPO2, EARTH) == expected


def test_stale_value_is_unknown():
    old = NOW - timedelta(seconds=BP_SYSTOLIC["max_age_s"] + 1)
    assert evaluate_indicator(118, BP_SYSTOLIC, EARTH, taken_at=old, now=NOW) == Status.unknown


def test_value_at_max_age_is_still_valid():
    edge = NOW - timedelta(seconds=BP_SYSTOLIC["max_age_s"])
    assert evaluate_indicator(118, BP_SYSTOLIC, EARTH, taken_at=edge, now=NOW) == Status.normal


def test_missing_value_is_unknown():
    assert evaluate_indicator(None, BP_SYSTOLIC, EARTH) == Status.unknown


def test_indicator_without_ranges_is_unknown():
    assert evaluate_indicator(3, {"id": "mood", "ranges": {}}) == Status.unknown


def test_accepts_pydantic_models():
    from app.schemas.config import Indicator

    model = Indicator.model_validate(
        {
            **BP_SYSTOLIC,
            "name": "Tensión sistólica",
            "unit": "mmHg",
            "system_id": "cardiovascular",
            "input": {"type": "number"},
            "measurement_instructions": [],
            "why_it_matters": "",
        }
    )
    assert evaluate_indicator(150, model, MARS) == Status.critical
    assert evaluate_indicator(150, model, EARTH) == Status.warning
