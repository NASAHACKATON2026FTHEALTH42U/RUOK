"""BE-04: catálogo de indicadores y sistemas (app/data/*.json) y sus endpoints."""

import json

import pytest
from pydantic import ValidationError

from app.schemas.common import Status
from app.services import catalog, environments
from app.services.assessment import classify, merge_ranges
from app.services.catalog import (
    INDICATORS_FILE,
    SYSTEMS_FILE,
    check_consistency,
    load_indicators,
    load_systems,
)

# Lista de la issue #10 (+ vision_changes, el indicador del sistema `eyes`).
EXPECTED_INDICATORS = {
    "heart_rate",
    "bp_systolic",
    "bp_diastolic",
    "spo2",
    "glucose",
    "temperature",
    "sleep_hours",
    "exercise_min",
    "hydration_ml",
    "weight_kg",
    "radiation_dose",
    "mood",
    "stress",
    "energy",
    "loneliness",
    "sleep_quality",
    "crew_relation",
    "pvt_mean_rt_ms",
    "pvt_lapses",
    "vision_changes",
}
# Sistema -> región del SVG que pinta BodyFigure en el front (FE-05).
EXPECTED_SYSTEMS = {
    "cardiovascular": "heart",
    "musculoskeletal": "bones",
    "immune": "immune",
    "metabolic": "metabolic",
    "neuro_behavioral": "brain",
    "eyes": "eyes",
    "radiation": "halo",
}


def write_json(tmp_path, name, data):
    path = tmp_path / name
    path.write_text(json.dumps(data))
    return path


# ── Ficheros JSON ────────────────────────────────────────────────────


def test_indicator_ids():
    assert {i.id for i in load_indicators()} == EXPECTED_INDICATORS


def test_systems_and_svg_regions():
    assert {s.id: s.svg_region for s in load_systems()} == EXPECTED_SYSTEMS


@pytest.mark.parametrize("ind", load_indicators(), ids=lambda i: i.id)
def test_indicator_is_complete(ind):
    """Criterio de aceptación: ranges, max_age_s, input e instrucciones."""
    assert ind.ranges.normal[0] <= ind.ranges.normal[1]
    assert ind.max_age_s > 0
    assert ind.input.min is not None and ind.input.max is not None
    assert ind.input.min < ind.input.max
    assert ind.measurement_instructions and all(ind.measurement_instructions)
    assert ind.why_it_matters


@pytest.mark.parametrize("ind", load_indicators(), ids=lambda i: i.id)
def test_ranges_are_ordered(ind):
    r = ind.ranges
    lo, hi = r.normal
    if r.critical_low is not None:
        assert r.critical_low < lo
    if r.critical_high is not None:
        assert r.critical_high > hi
    if r.warning is not None:
        assert r.warning[0] <= r.warning[1]
        assert r.warning[1] < lo or r.warning[0] > hi, "warning no puede solaparse con normal"


def test_catalog_is_consistent():
    check_consistency(load_indicators(), load_systems(), environments.list_environments())


def test_every_environment_indicator_exists():
    ids = {i.id for i in load_indicators()}
    for env in environments.list_environments():
        assert set(env.indicators) <= ids, env.id


# ── Validación ───────────────────────────────────────────────────────


def test_unknown_field_is_rejected(tmp_path):
    data = json.loads(INDICATORS_FILE.read_text())
    data[0]["typo"] = True
    with pytest.raises(ValidationError):
        load_indicators(write_json(tmp_path, "indicators.json", data))


def test_duplicated_indicator_is_rejected(tmp_path):
    data = json.loads(INDICATORS_FILE.read_text())
    with pytest.raises(ValueError, match="duplicados"):
        load_indicators(write_json(tmp_path, "indicators.json", [data[0], data[0]]))


def test_duplicated_system_is_rejected(tmp_path):
    data = json.loads(SYSTEMS_FILE.read_text())
    with pytest.raises(ValueError, match="duplicados"):
        load_systems(write_json(tmp_path, "systems.json", [data[0], data[0]]))


def test_indicator_with_unknown_system():
    inds = load_indicators()
    inds[0] = inds[0].model_copy(update={"system_id": "nowhere"})
    with pytest.raises(ValueError, match="nowhere"):
        check_consistency(inds, load_systems())


def test_system_listing_unknown_indicator():
    systems = load_systems()
    systems[0] = systems[0].model_copy(update={"indicators": [*systems[0].indicators, "ghost"]})
    with pytest.raises(ValueError, match="ghost"):
        check_consistency(load_indicators(), systems)


def test_indicator_missing_from_its_system():
    systems = [
        s.model_copy(update={"indicators": []}) if s.id == "eyes" else s for s in load_systems()
    ]
    with pytest.raises(ValueError, match="vision_changes"):
        check_consistency(load_indicators(), systems)


def test_environment_with_unknown_indicator():
    env = environments.get_environment("mars")
    bad = env.model_copy(update={"indicators": [*env.indicators, "fall_risk"]})
    with pytest.raises(ValueError, match="fall_risk"):
        check_consistency(load_indicators(), load_systems(), [bad])


# ── Encaja con el motor (BE-08) ──────────────────────────────────────


@pytest.mark.parametrize(
    ("ind_id", "value", "expected"),
    [
        ("heart_rate", 70, Status.normal),
        ("heart_rate", 110, Status.warning),
        ("heart_rate", 135, Status.critical),
        ("spo2", 92, Status.warning),
        ("spo2", 88, Status.critical),
        ("stress", 2, Status.normal),
        ("stress", 4, Status.warning),
        ("stress", 5, Status.critical),
        ("energy", 4, Status.normal),
        ("energy", 2, Status.warning),
        ("energy", 1, Status.critical),
        ("hydration_ml", 1200, Status.warning),
        ("hydration_ml", 700, Status.critical),
        ("weight_kg", 38, Status.critical),
        ("pvt_mean_rt_ms", 420, Status.warning),
        ("pvt_lapses", 7, Status.critical),
    ],
)
def test_ranges_classify_with_engine(ind_id, value, expected):
    ind = catalog.get_indicator(ind_id)
    assert classify(value, merge_ranges(ind)) == expected


@pytest.mark.parametrize("ind", load_indicators(), ids=lambda i: i.id)
def test_no_gap_between_warning_and_critical(ind):
    """CNT-01: el borde exterior de la banda warning coincide con el umbral crítico.

    El motor trata como critical todo lo que sobrepasa la banda warning por fuera, así que si
    el umbral `critical_*` quedara más lejos habría valores "critical" antes de tiempo (hueco).
    """
    r = ind.ranges
    if r.warning is None:
        return
    if r.warning[0] > r.normal[1] and r.critical_high is not None:  # banda por arriba
        assert r.warning[1] == r.critical_high, (ind.id, r.warning, r.critical_high)
    if r.warning[1] < r.normal[0] and r.critical_low is not None:  # banda por abajo
        assert r.warning[0] == r.critical_low, (ind.id, r.warning, r.critical_low)


@pytest.mark.parametrize(
    ("ind_id", "value", "expected"),
    [
        ("bp_systolic", 175, Status.warning),  # hipertensión estadio 2 [S20]
        ("bp_systolic", 180, Status.critical),  # crisis hipertensiva [S20]
        ("bp_diastolic", 85, Status.warning),  # estadio 1 [S20]
        ("bp_diastolic", 120, Status.critical),
        ("glucose", 60, Status.warning),  # hipoglucemia nivel 1 [S25]
        ("glucose", 54, Status.critical),  # hipoglucemia nivel 2 [S25]
        ("temperature", 38.0, Status.warning),  # fiebre [S23]
        ("temperature", 34.9, Status.critical),  # hipotermia
        ("heart_rate", 125, Status.warning),  # antes salía critical por el hueco
        ("sleep_hours", 4.5, Status.warning),  # antes salía critical por el hueco
        ("radiation_dose", 600, Status.critical),  # límite de carrera [S13]
        ("pvt_mean_rt_ms", 500, Status.critical),  # umbral de lapso [S12]
    ],
)
def test_sourced_thresholds(ind_id, value, expected):
    ind = catalog.get_indicator(ind_id)
    assert classify(value, merge_ranges(ind)) == expected


def test_geriatric_fever_override():
    """Fiebre en mayores de residencias: ≥ 37,8 °C [S24]."""
    ind = catalog.get_indicator("temperature")
    geriatric = environments.get_environment("geriatric")
    assert classify(37.8, merge_ranges(ind)) == Status.normal
    assert classify(37.8, merge_ranges(ind, geriatric)) == Status.warning


def test_mars_override_applies_to_catalog_indicator():
    ind = catalog.get_indicator("bp_systolic")
    mars = environments.get_environment("mars")
    assert classify(150, merge_ranges(ind)) == Status.warning
    assert classify(150, merge_ranges(ind, mars)) == Status.critical


# ── API ──────────────────────────────────────────────────────────────


def test_list_indicators_endpoint(client):
    r = client.get("/api/v1/indicators")
    assert r.status_code == 200
    assert {i["id"] for i in r.json()} == EXPECTED_INDICATORS


def test_get_indicator_endpoint(client):
    r = client.get("/api/v1/indicators/spo2")
    assert r.status_code == 200
    assert r.json()["higher_is_worse"] is False


def test_unknown_indicator_is_404(client):
    r = client.get("/api/v1/indicators/fall_risk")
    assert r.status_code == 404
    assert "fall_risk" in r.json()["detail"]


def test_list_systems_endpoint(client):
    r = client.get("/api/v1/systems")
    assert r.status_code == 200
    assert {s["id"]: s["svg_region"] for s in r.json()} == EXPECTED_SYSTEMS
