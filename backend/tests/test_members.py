"""BE-05: endpoints de members leídos de la BD."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, delete

from app import models
from app.db import engine

API = "/api/v1"
T0 = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def clean(client):
    """Sin mediciones y privacidad por defecto antes de cada test (BD compartida)."""
    with Session(engine) as s:
        s.exec(delete(models.Measurement))
        for m in s.get(models.Member, 1), s.get(models.Member, 2), s.get(models.Member, 3):
            m.share_behavioral_details = False
            s.add(m)
        s.commit()
    yield


def post_measurement(client, member_id, taken_at):
    item = {"id": str(uuid.uuid4()), "indicator_id": "heart_rate", "value": 70,
            "taken_at": taken_at.isoformat().replace("+00:00", "Z")}
    r = client.post(f"{API}/members/{member_id}/measurements", json={"measurements": [item]})
    assert r.status_code == 200


# ── GET /environments/{env_id}/members ───────────────────────────────


def test_list_members_of_environment(client):
    r = client.get(f"{API}/environments/mars/members")
    assert r.status_code == 200
    body = r.json()
    assert [(m["id"], m["name"], m["position"]) for m in body] == [
        (1, "Cmdr. Vega", "commander"),
        (2, "Ing. Okafor", "engineer"),
    ]
    assert all(m["env_id"] == "mars" for m in body)
    assert [m["id"] for m in client.get(f"{API}/environments/iss/members").json()] == [3]


def test_environment_without_members_is_empty(client):
    r = client.get(f"{API}/environments/hospital/members")
    assert r.status_code == 200
    assert r.json() == []


def test_unknown_environment_is_404(client):
    assert client.get(f"{API}/environments/pluto/members").status_code == 404


def test_summary_stub_fields(client):
    """liveness y open_alerts siguen siendo stub (BE-12, BE-14); overall_status es real (BE-11)."""
    by_id = {m["id"]: m for m in client.get(f"{API}/environments/mars/members").json()}
    # Sin mediciones, la salud es unknown (sin datos = desconocido, nunca verde).
    assert (by_id[1]["liveness"], by_id[1]["overall_status"]) == ("active", "unknown")
    assert (by_id[2]["liveness"], by_id[2]["overall_status"]) == ("stale", "unknown")


def test_last_measurement_at_is_real(client):
    def last(member_id):
        members = client.get(f"{API}/environments/mars/members").json()
        return next(m for m in members if m["id"] == member_id)["last_measurement_at"]

    assert last(1) is None
    post_measurement(client, 1, T0)
    post_measurement(client, 1, T0 + timedelta(hours=5))
    post_measurement(client, 1, T0 + timedelta(hours=2))
    assert datetime.fromisoformat(last(1)) == T0 + timedelta(hours=5)
    assert last(2) is None  # las de otro member no cuentan


# ── GET /members/{id} ────────────────────────────────────────────────


def test_get_member(client):
    r = client.get(f"{API}/members/1")
    assert r.status_code == 200
    assert r.json() == {
        "id": 1, "env_id": "mars", "name": "Cmdr. Vega", "position": "commander",
        "share_behavioral_details": False, "last_seen_at": "2026-11-14T10:00:00Z",
        "liveness": "active",
    }


def test_unknown_member_is_404(client):
    r = client.get(f"{API}/members/999")
    assert r.status_code == 404
    assert "999" in r.json()["detail"]


# ── PATCH /members/{id}/privacy ──────────────────────────────────────


def test_privacy_is_saved(client):
    r = client.patch(f"{API}/members/1/privacy", json={"share_behavioral_details": True})
    assert r.status_code == 200
    assert r.json()["share_behavioral_details"] is True
    assert client.get(f"{API}/members/1").json()["share_behavioral_details"] is True
    listed = client.get(f"{API}/environments/mars/members").json()
    assert next(m for m in listed if m["id"] == 1)["share_behavioral_details"] is True

    r = client.patch(f"{API}/members/1/privacy", json={"share_behavioral_details": False})
    assert r.json()["share_behavioral_details"] is False
    assert client.get(f"{API}/members/1").json()["share_behavioral_details"] is False


def test_privacy_only_changes_that_member(client):
    client.patch(f"{API}/members/1/privacy", json={"share_behavioral_details": True})
    assert client.get(f"{API}/members/2").json()["share_behavioral_details"] is False


@pytest.mark.parametrize(
    "body",
    [{}, {"share_behavioral_details": True, "extra": 1}, {"share_behavioral_details": "maybe"}],
)
def test_privacy_invalid_body_is_422(client, body):
    assert client.patch(f"{API}/members/1/privacy", json=body).status_code == 422


def test_privacy_unknown_member_is_404(client):
    r = client.patch(f"{API}/members/999/privacy", json={"share_behavioral_details": True})
    assert r.status_code == 404
