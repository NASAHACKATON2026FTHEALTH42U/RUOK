"""BE-14: alertas automáticas desde la evaluación (dedupe, escalera y enlace)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, delete

from app import clock, models, seed
from app.db import init_db, make_engine
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
    engine = make_engine(f"sqlite:///{tmp_path}/alerts.db")
    init_db(engine)
    with Session(engine) as s:
        seed.seed(s)
        yield s
    engine.dispose()


def member_alerts(session, member_id=seed.VEGA):
    return {a.system_id: a for a in alerts.list_for_member(session, member_id)}


def events(session, alert):
    return [e.type for e in alerts.to_schema(session, alert).events]


def add(session, member_id, indicator_id, value, unit):
    session.add(models.Measurement(
        id=str(uuid.uuid4()), member_id=member_id, indicator_id=indicator_id, value=value,
        unit=unit, taken_at=clock.now(),
    ))
    session.commit()
    return alerts.evaluate_member(session, session.get(models.Member, member_id))


# ── Criterio de aceptación: mars_sleep_bp llega a ground con ETA ─────


def test_mars_sleep_bp_reaches_ground_with_eta(session, frozen):
    seed.apply_scenario(session, "mars_sleep_bp")
    neuro = member_alerts(session)["neuro_behavioral"]

    assert (neuro.severity, neuro.status) == ("critical", "escalated")
    assert (neuro.target_role, neuro.level) == ("ground", 2)
    assert (neuro.delivery_mode, neuro.delay_s) == ("autonomous", MARS_DELAY)
    assert neuro.eta == T0 + timedelta(seconds=MARS_DELAY)
    assert neuro.delivered_at is None  # /ground todavía no la ve
    # La timeline: self → crew (a bordo, al instante) → ground (en cola por el enlace).
    assert events(session, neuro) == ["created", "escalated", "escalated", "queued"]

    frozen(MARS_DELAY)
    comm_link.deliver_due(session)
    session.refresh(neuro)
    assert neuro.delivered_at == T0 + timedelta(seconds=MARS_DELAY)
    assert events(session, neuro)[-1] == "delivered"


def test_warning_stays_on_self(session):
    seed.apply_scenario(session, "mars_sleep_bp")
    cardio = member_alerts(session)["cardiovascular"]  # 137 mmHg: warning en Marte
    assert (cardio.severity, cardio.level, cardio.target_role) == ("warning", 0, "self")
    assert (cardio.delivery_mode, cardio.delay_s, cardio.eta) == ("realtime", 0, None)
    assert cardio.status == "open"


# ── Sin duplicados ───────────────────────────────────────────────────


def test_no_duplicate_alerts(session):
    seed.apply_scenario(session, "mars_sleep_bp")
    first = {k: a.id for k, a in member_alerts(session).items()}
    for _ in range(3):
        alerts.evaluate_member(session, session.get(models.Member, seed.VEGA))
    seed.apply_scenario(session, "mars_sleep_bp")
    assert {k: a.id for k, a in member_alerts(session).items()} == first
    messages = comm_link.list_messages(session, "mars", "up")
    assert len(messages) == 1  # la alerta a tierra solo se envía una vez


def test_worse_updates_the_same_alert(session):
    seed.apply_scenario(session, "mars_sleep_bp")
    cardio = member_alerts(session)["cardiovascular"]
    add(session, seed.VEGA, "bp_systolic", 150, "mmHg")  # critical en Marte
    session.refresh(cardio)
    assert cardio.id == member_alerts(session)["cardiovascular"].id
    assert (cardio.severity, cardio.target_role) == ("critical", "ground")
    assert "updated" in events(session, cardio)


# ── Escalera ─────────────────────────────────────────────────────────


def test_warning_that_persists_escalates(session, frozen):
    seed.apply_scenario(session, "mars_sleep_bp")
    cardio = member_alerts(session)["cardiovascular"]
    frozen(21600 - 1)  # warning_escalate_after_s de Marte: 6 h
    alerts.reevaluate_open(session)
    session.refresh(cardio)
    assert cardio.level == 0
    frozen(1)
    alerts.reevaluate_open(session)
    session.refresh(cardio)
    assert (cardio.level, cardio.target_role, cardio.delay_s) == (1, "crew", 0)


def test_external_level_waits_during_los(session, frozen):
    comm_link.set_state(session, "mars", "los")
    seed.apply_scenario(session, "mars_sleep_bp")
    neuro = member_alerts(session)["neuro_behavioral"]
    frozen(3600)
    comm_link.deliver_due(session)
    session.refresh(neuro)
    assert neuro.delivered_at is None
    comm_link.set_state(session, "mars", "delayed")
    frozen(MARS_DELAY)
    comm_link.deliver_due(session)
    session.refresh(neuro)
    assert neuro.delivered_at is not None


def test_no_delay_environment_delivers_at_once(session):
    member = session.get(models.Member, 3)  # ISS
    add(session, member.id, "spo2", 85, "%")  # critical
    cardio = member_alerts(session, member.id)["cardiovascular"]
    assert (cardio.target_role, cardio.delivery_mode, cardio.delay_s) == ("ground", "realtime", 0)
    assert cardio.delivered_at == T0
    assert events(session, cardio)[-2:] == ["queued", "delivered"]


def test_recovery_is_flagged_not_closed(session):
    seed.apply_scenario(session, "mars_sleep_bp")
    add(session, seed.VEGA, "bp_systolic", 115, "mmHg")  # vuelve a normal
    add(session, seed.VEGA, "bp_systolic", 114, "mmHg")
    cardio = member_alerts(session)["cardiovascular"]
    assert cardio.status == "open"
    recovered = [
        e for e in alerts.to_schema(session, cardio).events if e.payload.get("recovered")
    ]
    assert len(recovered) == 1


def test_unknown_does_not_create_alerts(session):
    """Sin datos (unknown) no hay alerta: el no_contact es de BE-16."""
    session.exec(delete(models.Measurement).where(
        models.Measurement.member_id == seed.VEGA,
        models.Measurement.indicator_id == "radiation_dose",
    ))
    session.commit()
    alerts.evaluate_member(session, session.get(models.Member, seed.VEGA))
    assert "radiation" not in member_alerts(session)


# ── API ──────────────────────────────────────────────────────────────


@pytest.fixture
def api(client):
    client.post("/api/v1/demo/reset")
    yield client
    client.post("/api/v1/demo/reset")


def test_api_alerts_after_measurements(api):
    item = {"id": str(uuid.uuid4()), "indicator_id": "bp_systolic", "value": 150,
            "taken_at": clock.now().isoformat().replace("+00:00", "Z")}
    r = api.post("/api/v1/members/1/measurements", json={"measurements": [item]})
    assert r.status_code == 200
    body = api.get("/api/v1/members/1/alerts").json()
    cardio = next(a for a in body if a["system_id"] == "cardiovascular")
    assert (cardio["severity"], cardio["target_role"], cardio["delivery_mode"]) == (
        "critical", "ground", "autonomous",
    )
    assert [e["type"] for e in cardio["events"]][:2] == ["created", "escalated"]
    members = api.get("/api/v1/environments/mars/members").json()
    assert next(m for m in members if m["id"] == 1)["open_alerts"] >= 1


def test_api_fast_forward_delivers_alert(api):
    api.post("/api/v1/demo/scenarios/mars_sleep_bp")
    api.post("/api/v1/demo/fast-forward", json={"seconds": MARS_DELAY})
    body = api.get("/api/v1/members/1/alerts").json()
    neuro = next(a for a in body if a["system_id"] == "neuro_behavioral")
    assert neuro["delivered_at"] is not None


def test_api_unknown_member_alerts_is_404(api):
    assert api.get("/api/v1/members/999/alerts").status_code == 404
