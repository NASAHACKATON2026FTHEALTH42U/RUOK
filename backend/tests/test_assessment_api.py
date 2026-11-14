"""BE-11: GET /members/{id}/assessment y assessment en POST /measurements."""

import uuid

import pytest
from sqlmodel import Session, delete

from app import clock, models
from app.db import engine
from app.schemas import Assessment

API = "/api/v1"
MARS_MEMBER = 1  # demo member de Marte (app/stubs.py)


@pytest.fixture(autouse=True)
def clean(client):
    """Sin mediciones antes de cada test (BD compartida)."""
    with Session(engine) as s:
        s.exec(delete(models.Measurement))
        s.commit()
    yield


def post_bp(client, value, member_id=MARS_MEMBER):
    item = {
        "id": str(uuid.uuid4()),
        "indicator_id": "bp_systolic",
        "value": value,
        "taken_at": clock.now().isoformat().replace("+00:00", "Z"),
    }
    r = client.post(f"{API}/members/{member_id}/measurements", json={"measurements": [item]})
    assert r.status_code == 200, r.text
    return r.json()


def cardio(assessment):
    return next(s for s in assessment["systems"] if s["system_id"] == "cardiovascular")


def bp(assessment):
    return next(i for i in cardio(assessment)["indicators"] if i["indicator_id"] == "bp_systolic")


# --- Criterios de aceptación ---------------------------------------------------


def test_response_validates_against_schema(client):
    post_bp(client, 135)
    r = client.get(f"{API}/members/{MARS_MEMBER}/assessment")
    assert r.status_code == 200
    Assessment.model_validate(r.json())


def test_env_param_gives_other_result_with_same_data(client):
    post_bp(client, 150)
    mars = client.get(f"{API}/members/{MARS_MEMBER}/assessment").json()
    geriatric = client.get(f"{API}/members/{MARS_MEMBER}/assessment?env=geriatric").json()

    assert mars["env_id"] == "mars" and geriatric["env_id"] == "geriatric"
    assert bp(mars)["status"] == "critical"  # override de Marte: warning [130, 140]
    assert bp(geriatric)["status"] == "warning"
    assert cardio(mars)["escalation"]["mode"] == "autonomous"
    assert cardio(geriatric)["escalation"]["target_role"] == "self"


def test_env_param_does_not_modify_data(client):
    post_bp(client, 150)
    client.get(f"{API}/members/{MARS_MEMBER}/assessment?env=geriatric")
    again = client.get(f"{API}/members/{MARS_MEMBER}/assessment").json()
    assert again["env_id"] == "mars"
    assert bp(again)["status"] == "critical"


# --- Recalcular en el POST -------------------------------------------------------


def test_post_measurements_returns_recalculated_assessment(client):
    body = post_bp(client, 150)
    assert body["accepted"] == 1
    assert body["assessment"]["member_id"] == MARS_MEMBER
    assert bp(body["assessment"])["last_value"] == 150
    assert bp(body["assessment"])["status"] == "critical"


# --- Sin datos y errores -----------------------------------------------------------


def test_member_without_measurements_is_unknown(client):
    a = client.get(f"{API}/members/{MARS_MEMBER}/assessment").json()
    assert a["overall_status"] == "unknown"
    assert all(s["status"] == "unknown" for s in a["systems"])


def test_unknown_env_is_404(client):
    r = client.get(f"{API}/members/{MARS_MEMBER}/assessment?env=pluto")
    assert r.status_code == 404


def test_unknown_member_is_404(client):
    assert client.get(f"{API}/members/9999/assessment").status_code == 404


def test_summary_overall_status_is_real(client):
    post_bp(client, 170)  # critical en cualquier entorno
    members = client.get(f"{API}/environments/mars/members").json()
    assert next(m for m in members if m["id"] == MARS_MEMBER)["overall_status"] == "critical"
