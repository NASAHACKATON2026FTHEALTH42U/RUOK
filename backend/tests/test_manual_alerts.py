"""BE-15: alertas manuales (SOS) y acciones: escalar, ack, resolver y mensajes."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session

from app import clock, models, seed
from app.db import init_db, make_engine
from app.schemas import AlertIn
from app.services import alerts, comm_link

T0 = datetime(2026, 11, 15, 9, 0, tzinfo=UTC)
MARS_DELAY = 840


@pytest.fixture
def frozen(monkeypatch):
    state = {"offset": 0.0}
    monkeypatch.setattr(clock, "now", lambda: T0 + timedelta(seconds=state["offset"]))

    def advance(seconds: float) -> None:
        state["offset"] += seconds

    return advance


@pytest.fixture
def session(tmp_path, frozen):
    engine = make_engine(f"sqlite:///{tmp_path}/manual.db")
    init_db(engine)
    with Session(engine) as s:
        seed.seed(s)
        yield s
    engine.dispose()


def sos(**kw):
    data = {"id": uuid.uuid4(), "category": "emergency", "severity": "emergency"}
    data.update(kw)
    return AlertIn(**data)


def vega(session):
    return session.get(models.Member, seed.VEGA)


def timeline(session, alert):
    return [(e.type, e.actor) for e in alerts.to_schema(session, alert).events]


# ── Criterio de aceptación: flujo SOS completo con su timeline ───────


def test_full_sos_flow_with_timeline(session, frozen):
    """Paso 5 del guion: SOS en LOS → tripulación al instante, tierra al volver el enlace."""
    comm_link.set_state(session, "mars", "los")
    alert, created = alerts.create_manual(session, vega(session), sos(message="Dolor torácico"))
    assert created
    assert (alert.origin, alert.status, alert.level, alert.target_role) == (
        "manual", "escalated", 2, "ground",
    )
    assert (alert.delivery_mode, alert.delay_s) == ("autonomous", MARS_DELAY)
    assert alert.delivered_at is None  # en cola por el LOS

    frozen(600)
    comm_link.set_state(session, "mars", "delayed")  # vuelve el enlace
    frozen(MARS_DELAY)
    comm_link.deliver_due(session)
    session.refresh(alert)
    assert alert.delivered_at == T0 + timedelta(seconds=600 + MARS_DELAY)

    alerts.add_message(session, alert, "responder", "Recibido, siga el protocolo")
    alerts.acknowledge(session, alert, "responder")
    alerts.resolve(session, alert, "member", "Remitió el dolor")

    assert alert.status == "resolved"
    assert timeline(session, alert) == [
        ("created", "member"),
        ("escalated", "member"),  # crew
        ("escalated", "member"),  # ground
        ("queued", "system"),
        ("delivered", "system"),
        ("message", "responder"),
        ("acknowledged", "responder"),
        ("resolved", "member"),
    ]
    msg = alerts.to_schema(session, alert).events[5]
    assert (msg.payload["via_link"], msg.payload["text"]) == ("down", "Recibido, siga el protocolo")


# ── Creación ─────────────────────────────────────────────────────────


def test_create_is_idempotent(session):
    body = sos(message="Ayuda")
    first, created = alerts.create_manual(session, vega(session), body)
    again, created_again = alerts.create_manual(session, vega(session), body)
    assert created and not created_again
    assert again.id == first.id
    assert len(comm_link.list_messages(session, "mars", "up")) == 1


def test_same_id_other_content_is_conflict(session):
    body = sos(message="Ayuda")
    alerts.create_manual(session, vega(session), body)
    with pytest.raises(alerts.AlertConflict):
        alerts.create_manual(session, vega(session), sos(id=body.id, message="Otra cosa"))


def test_warning_goes_to_crew_in_realtime(session):
    alert, _ = alerts.create_manual(
        session, vega(session), sos(category="symptom", severity="warning")
    )
    assert (alert.level, alert.target_role, alert.delivery_mode, alert.delay_s) == (
        1, "crew", "realtime", 0,
    )
    assert alert.eta is None


def test_target_role_can_skip_levels(session):
    alert, _ = alerts.create_manual(
        session, vega(session), sos(category="physical", severity="warning", target_role="ground")
    )
    assert (alert.level, alert.target_role) == (2, "ground")
    assert alert.delivery_mode == "delayed"  # warning: sin protocolo autónomo
    assert alert.eta is not None


def test_unknown_target_role_is_invalid(session):
    with pytest.raises(alerts.InvalidAlert):
        alerts.create_manual(session, vega(session), sos(target_role="nurse"))


def test_several_manual_alerts_can_be_open(session):
    alerts.create_manual(session, vega(session), sos())
    alerts.create_manual(session, vega(session), sos())
    assert alerts.count_open(session, seed.VEGA) == 2


# ── Acciones ─────────────────────────────────────────────────────────


def test_escalate_next_level_and_skip(session):
    alert, _ = alerts.create_manual(session, vega(session), sos(severity="warning"))
    assert alert.target_role == "crew"
    alerts.escalate(session, alert, message="No mejora")
    assert (alert.level, alert.target_role) == (2, "ground")
    assert alert.eta is not None  # ha salido por el enlace
    with pytest.raises(alerts.InvalidAlert):
        alerts.escalate(session, alert)  # ya en el último nivel


def test_escalate_to_lower_level_is_invalid(session):
    alert, _ = alerts.create_manual(session, vega(session), sos())
    with pytest.raises(alerts.InvalidAlert):
        alerts.escalate(session, alert, target_role="crew")


def test_resolved_alert_rejects_actions(session):
    alert, _ = alerts.create_manual(session, vega(session), sos(severity="warning"))
    alerts.resolve(session, alert, "responder")
    for action in (
        lambda: alerts.resolve(session, alert, "responder"),
        lambda: alerts.acknowledge(session, alert, "member"),
        lambda: alerts.escalate(session, alert),
    ):
        with pytest.raises(alerts.AlertConflict):
            action()


def test_onboard_message_does_not_use_the_link(session):
    alert, _ = alerts.create_manual(session, vega(session), sos(severity="warning"))
    before = len(comm_link.list_messages(session, "mars"))
    alerts.add_message(session, alert, "member", "Sigo mareado")
    assert len(comm_link.list_messages(session, "mars")) == before
    assert "via_link" not in alerts.to_schema(session, alert).events[-1].payload


def test_member_message_to_ground_goes_up(session):
    alert, _ = alerts.create_manual(session, vega(session), sos())
    alerts.add_message(session, alert, "member", "Empeora")
    up = comm_link.list_messages(session, "mars", "up")
    assert [m.kind for m in up] == ["alert", "alert_event"]


# ── API ──────────────────────────────────────────────────────────────


@pytest.fixture
def api(client):
    client.post("/api/v1/demo/reset")
    yield client
    client.post("/api/v1/demo/reset")


def test_api_sos_and_actions(api):
    body = {"id": str(uuid.uuid4()), "category": "emergency", "severity": "emergency",
            "message": "SOS"}
    r = api.post("/api/v1/members/1/alerts", json=body)
    assert r.status_code == 200
    created = r.json()
    assert (created["target_role"], created["delivery_mode"]) == ("ground", "autonomous")
    assert api.post("/api/v1/members/1/alerts", json=body).json()["id"] == created["id"]
    assert api.post(
        "/api/v1/members/1/alerts", json={**body, "message": "otra"}
    ).status_code == 409

    aid = created["id"]
    assert api.post(f"/api/v1/alerts/{aid}/ack", json={"actor": "member"}).json()["status"] == (
        "acknowledged"
    )
    done = api.post(f"/api/v1/alerts/{aid}/resolve", json={"actor": "member", "note": "ok"})
    assert done.json()["status"] == "resolved"
    assert api.post(f"/api/v1/alerts/{aid}/resolve", json={"actor": "member"}).status_code == 409
    listed = api.get("/api/v1/members/1/alerts", params={"status": "resolved"}).json()
    assert [a["id"] for a in listed] == [aid]


def test_api_errors(api):
    missing = str(uuid.uuid4())
    assert api.post(f"/api/v1/alerts/{missing}/ack", json={"actor": "member"}).status_code == 404
    body = {"id": str(uuid.uuid4()), "category": "symptom", "severity": "warning",
            "target_role": "nurse"}
    assert api.post("/api/v1/members/1/alerts", json=body).status_code == 422
    r = api.post("/api/v1/members/999/alerts", json={**body, "target_role": None})
    assert r.status_code == 404
