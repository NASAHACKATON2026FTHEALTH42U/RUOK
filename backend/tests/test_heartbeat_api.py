"""BE-12: POST /members/{id}/heartbeat y liveness real en members y assessment."""

import uuid
from datetime import timedelta

import pytest
from sqlmodel import Session

from app import clock, models
from app.db import engine

API = "/api/v1"
MEMBER = 1  # Cmdr. Vega, Marte


@pytest.fixture(autouse=True)
def restore_member(client):
    """Deja al member como estaba (BD compartida con otros tests)."""
    with Session(engine) as s:
        m = s.get(models.Member, MEMBER)
        saved = (m.last_seen_at, m.last_activity, m.device_id)
    yield
    with Session(engine) as s:
        m = s.get(models.Member, MEMBER)
        m.last_seen_at, m.last_activity, m.device_id = saved
        s.add(m)
        s.commit()


def beat(client, **body):
    payload = {"device_id": str(uuid.uuid4()), **body}
    r = client.post(f"{API}/members/{MEMBER}/heartbeat", json=payload)
    assert r.status_code == 200, r.text
    return payload, r.json()


def liveness_of(client):
    return client.get(f"{API}/members/{MEMBER}").json()["liveness"]


def overall_of(client):
    return client.get(f"{API}/members/{MEMBER}/assessment").json()["overall_status"]


def test_heartbeat_marks_active_and_updates_member(client):
    payload, body = beat(client, activity="eva")
    assert body["liveness"] == "active"
    with Session(engine) as s:
        m = s.get(models.Member, MEMBER)
        assert m.last_activity == "eva"
        assert m.device_id == payload["device_id"]
        assert abs((m.last_seen_at - clock.now()).total_seconds()) < 5


def test_heartbeat_registers_device(client):
    payload, _ = beat(client, pending_outbox=3, device_kind="mobile")
    with Session(engine) as s:
        d = s.get(models.Device, payload["device_id"])
        assert (d.kind, d.pending_outbox) == ("mobile", 3)


def test_liveness_goes_stale_and_lost_with_fast_forward(client):
    """Criterio de aceptación: sin heartbeat, nunca overall normal."""
    beat(client)
    assert liveness_of(client) == "active"

    clock.advance(300)  # 5 min
    assert liveness_of(client) == "stale"
    assert overall_of(client) != "normal"

    clock.advance(600)  # 15 min en total
    assert liveness_of(client) == "lost"
    assert overall_of(client) == "critical"


def test_eva_uses_stricter_thresholds(client):
    beat(client, activity="eva")
    clock.advance(30)
    assert liveness_of(client) == "stale"


def test_checkin_required_when_coming_back_from_stale(client):
    _, first = beat(client)
    assert first["checkin_required"] is False
    clock.advance(timedelta(minutes=6).total_seconds())
    _, back = beat(client)
    assert back == {"liveness": "active", "checkin_required": True}
    _, again = beat(client)
    assert again["checkin_required"] is False


def test_unknown_member_is_404(client):
    r = client.post(f"{API}/members/9999/heartbeat", json={"device_id": str(uuid.uuid4())})
    assert r.status_code == 404
