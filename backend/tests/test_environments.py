"""BE-03: perfiles de entorno (app/data/environments.json) y GET /environments."""

import json

import pytest
from pydantic import ValidationError

from app.services import environments
from app.services.environments import DATA_FILE, load_environments

# Tabla de docs/environments.md:
# id, kind, gravity_g, comm_delay_s, radiation_level, escalation_ladder, vocabulary.member
DOC_TABLE = [
    ("iss", "space", 0.0, 0, "medium", ["self", "crew", "ground"], "astronauta"),
    ("moon", "space", 0.16, 1, "high", ["self", "crew", "ground"], "astronauta"),
    ("mars", "space", 0.38, 840, "high", ["self", "crew", "ground"], "astronauta"),
    ("earth", "earth", 1.0, 0, "low", ["self", "crew", "ground"], "participante"),
    ("hospital", "earth", 1.0, 0, "none", ["self", "nurse", "doctor"], "paciente"),
    ("geriatric", "earth", 1.0, 0, "none", ["self", "caregiver", "doctor", "family"], "residente"),
]
REALTIME_MAX_DELAY_S = 5  # docs/alerts-and-escalation.md: < 5 s → realtime


# ── Fichero JSON ─────────────────────────────────────────────────────


def test_six_profiles_validate():
    envs = load_environments()
    assert [e.id for e in envs] == [row[0] for row in DOC_TABLE]


@pytest.mark.parametrize(("env_id", "kind", "g", "delay", "rad", "ladder", "member"), DOC_TABLE)
def test_values_match_docs(env_id, kind, g, delay, rad, ladder, member):
    env = environments.get_environment(env_id)
    assert env is not None
    assert env.kind == kind
    assert env.gravity_g == g
    assert env.comm_delay_s == delay
    assert env.radiation_level == rad
    assert env.escalation_ladder == ladder
    assert env.vocabulary["member"] == member


@pytest.mark.parametrize("env", load_environments(), ids=lambda e: e.id)
def test_profile_invariants(env):
    assert env.escalation_ladder[0] == "self"
    assert {"member", "crew", "ground"} <= set(env.vocabulary)
    assert env.liveness.stale_after_s < env.liveness.lost_after_s
    assert env.indicators, "cada entorno necesita indicadores activos"
    assert len(set(env.indicators)) == len(env.indicators)
    if env.mission is not None:
        assert env.mission.start < env.mission.end


def test_only_mars_is_delayed():
    delayed = [e.id for e in load_environments() if e.comm_delay_s >= REALTIME_MAX_DELAY_S]
    assert delayed == ["mars"]


def test_radiation_dose_only_in_space():
    for env in load_environments():
        assert ("radiation_dose" in env.indicators) == (env.kind == "space"), env.id


def test_unknown_field_is_rejected(tmp_path):
    data = json.loads(DATA_FILE.read_text())
    data[0]["typo_field"] = 1
    bad = tmp_path / "environments.json"
    bad.write_text(json.dumps(data))
    with pytest.raises(ValidationError):
        load_environments(bad)


def test_duplicated_ids_are_rejected(tmp_path):
    data = json.loads(DATA_FILE.read_text())
    bad = tmp_path / "environments.json"
    bad.write_text(json.dumps([data[0], data[0]]))
    with pytest.raises(ValueError, match="duplicados"):
        load_environments(bad)


def test_get_unknown_environment_returns_none():
    assert environments.get_environment("pluto") is None


# ── API ──────────────────────────────────────────────────────────────


def test_list_environments_endpoint(client):
    r = client.get("/api/v1/environments")
    assert r.status_code == 200
    assert [e["id"] for e in r.json()] == [row[0] for row in DOC_TABLE]


def test_get_environment_endpoint(client):
    r = client.get("/api/v1/environments/mars")
    assert r.status_code == 200
    body = r.json()
    assert body["comm_delay_s"] == 840
    assert body["threshold_overrides"] == {"bp_systolic": {
        "normal": None, "warning": [130.0, 140.0], "critical_low": None, "critical_high": None,
    }}


def test_unknown_environment_is_404(client):
    r = client.get("/api/v1/environments/pluto")
    assert r.status_code == 404
    assert "pluto" in r.json()["detail"]


# ── BE-33: umbrales de liveness y escalado ───────────────────────────

ESCALATE_AFTER = {
    "iss": 21600, "moon": 21600, "mars": 21600,
    "earth": 43200, "hospital": 7200, "geriatric": 14400,
}


@pytest.mark.parametrize("env", load_environments(), ids=lambda e: e.id)
def test_liveness_thresholds_are_complete(env):
    lv = env.liveness
    assert (lv.stale_after_s, lv.lost_after_s) == (300, 900)
    assert (lv.eva_stale_after_s, lv.eva_lost_after_s) == (30, 120)
    assert lv.sleep_factor == 3
    assert lv.warning_escalate_after_s == ESCALATE_AFTER[env.id]
    assert lv.morning_checkin_by == ("10:00" if env.id == "geriatric" else None)


@pytest.mark.parametrize(
    ("activity", "expected"), [("normal", (300, 900)), ("eva", (30, 120)), ("sleep", (900, 2700))]
)
def test_liveness_service_reads_environment(activity, expected):
    from app.services.liveness import thresholds_for

    assert thresholds_for(environments.get_environment("mars").liveness, activity) == expected


@pytest.mark.parametrize(
    "change",
    [
        {"eva_lost_after_s": None},  # obligatorio
        {"sleep_factor": None},
        {"warning_escalate_after_s": None},
        {"morning_checkin_by": "25:00"},  # no es una hora
        {"morning_checkin_by": "10h"},
        {"sleep_factor": 0.5},  # el sueño no puede endurecer los umbrales
        {"eva_lost_after_s": 20},  # menor que eva_stale_after_s
        {"lost_after_s": 100},  # menor que stale_after_s
    ],
)
def test_invalid_liveness_is_rejected(tmp_path, change):
    data = json.loads(DATA_FILE.read_text())
    lv = data[0]["liveness"]
    for key, value in change.items():
        if value is None:
            lv.pop(key)
        else:
            lv[key] = value
    bad = tmp_path / "environments.json"
    bad.write_text(json.dumps(data))
    with pytest.raises(ValidationError):
        load_environments(bad)


# ── BE-31: niveles de a bordo ────────────────────────────────────────


@pytest.mark.parametrize("env", load_environments(), ids=lambda e: e.id)
def test_external_from_level(env):
    assert env.external_from_level == 2
    assert env.escalation_ladder[: env.external_from_level][0] == "self"


@pytest.mark.parametrize("value", [0, 9])
def test_external_from_level_out_of_range_is_rejected(tmp_path, value):
    data = json.loads(DATA_FILE.read_text())
    data[0]["external_from_level"] = value
    bad = tmp_path / "environments.json"
    bad.write_text(json.dumps(data))
    with pytest.raises(ValidationError):
        load_environments(bad)
