"""Protocolos de respuesta completados: puntos una vez por alerta, registro y notificación."""

import uuid

import pytest
from sqlmodel import Session, delete, select

from app import clock, models
from app.db import engine
from app.schemas import EventType
from app.services import routine

URL = "/api/v1/members/{}/interventions/{}/complete"
GAME = "/api/v1/members/{}/game"
PROTOCOL = "int_box_breathing"


@pytest.fixture(autouse=True)
def clean(client):
    with Session(engine) as s:
        s.exec(delete(models.TaskCompletion))
        s.exec(delete(models.Task).where(models.Task.task_type == "protocol"))
        s.commit()
    yield


def points(client, member_id=1) -> int:
    return client.get(GAME.format(member_id)).json()["points"]


def done(client, intervention=PROTOCOL, member_id=1, **kw):
    body = {"id": str(uuid.uuid4()), "completed_at": clock.now().isoformat(), **kw}
    return client.post(URL.format(member_id, intervention), json=body)


def sos(client, member_id=1) -> str:
    r = client.post(
        f"/api/v1/members/{member_id}/alerts",
        json={"id": str(uuid.uuid4()), "category": "psychological", "severity": "warning"},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def test_points_come_from_config_and_count_once_a_day_without_alert(client):
    before = points(client)
    r = done(client)
    assert r.status_code == 200, r.text
    expected = routine.task_type("protocol").points
    assert expected > 0
    assert r.json()["points"] == before + expected
    # Otro completado del mismo protocolo, el mismo día y sin alerta: no suma otra vez.
    assert done(client).json()["points"] == before + expected


def test_same_uuid_is_idempotent(client):
    body = {"id": str(uuid.uuid4()), "completed_at": clock.now().isoformat()}
    first = client.post(URL.format(1, PROTOCOL), json=body).json()["points"]
    again = client.post(URL.format(1, PROTOCOL), json=body)
    assert again.status_code == 200
    assert again.json()["points"] == first


def test_each_alert_counts_once_and_leaves_a_message_in_its_timeline(client):
    alert_id = sos(client)
    before = points(client)
    gained = done(client, alert_id=alert_id).json()["points"] - before
    assert gained == routine.task_type("protocol").points
    assert done(client, alert_id=alert_id).json()["points"] == before + gained
    with Session(engine) as s:
        msgs = s.exec(
            select(models.AlertEvent).where(
                models.AlertEvent.alert_id == alert_id, models.AlertEvent.type == "message"
            )
        ).all()
    assert any("protocolo" in (m.payload or {}).get("text", "").lower() for m in msgs)


def test_shows_as_a_completed_task_and_a_system_notification(client):
    done(client)
    tasks = client.get("/api/v1/members/1/tasks").json()
    proto = [t for t in tasks if t["task_type"] == "protocol"]
    assert proto and proto[0]["completed"] is True
    notes = client.get("/api/v1/members/1/notifications").json()
    assert notes[0]["payload"]["title"] == "Protocolo completado"
    assert notes[0]["payload"]["from_role"] == "system"
    with Session(engine) as s:
        logged = s.exec(
            select(models.EventLog).where(
                models.EventLog.type == EventType.task_completed.value,
                models.EventLog.member_id == 1,
            )
        ).all()
    assert any(e.payload.get("task_type") == "protocol" for e in logged)


def test_unknown_protocol_or_foreign_alert_is_404(client):
    assert done(client, intervention="no_such_protocol").status_code == 404
    other = sos(client, member_id=2)
    assert done(client, alert_id=other).status_code == 404


def test_member_cannot_complete_for_someone_else(client, vega_auth):
    body = {"id": str(uuid.uuid4()), "completed_at": clock.now().isoformat()}
    r = client.post(URL.format(2, PROTOCOL), json=body, headers=vega_auth)
    assert r.status_code == 403
