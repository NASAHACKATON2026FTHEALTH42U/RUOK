"""BE-16: check-in "R U OK?", alerta no_contact y vigilancia del liveness."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, select

from app import clock, models, seed
from app.db import init_db, make_engine
from app.schemas import HeartbeatIn
from app.services import alerts, comm_link, liveness_watch
from app.services.liveness import record_heartbeat

T0 = datetime(2026, 11, 15, 9, 0, tzinfo=UTC)
MARS_DELAY = 840
DEVICE = uuid.UUID("11111111-2222-4333-8444-555555555555")


@pytest.fixture
def frozen(monkeypatch):
    state = {"offset": 0.0}
    monkeypatch.setattr(clock, "now", lambda: T0 + timedelta(seconds=state["offset"]))

    def advance(seconds: float) -> None:
        state["offset"] += seconds

    return advance


@pytest.fixture
def session(tmp_path, frozen):
    engine = make_engine(f"sqlite:///{tmp_path}/nc.db")
    init_db(engine)
    with Session(engine) as s:
        seed.seed(s)
        yield s
    engine.dispose()


def member(session, member_id=seed.VEGA):
    return session.get(models.Member, member_id)


def heartbeat(session, member_id=seed.VEGA, activity="normal"):
    return record_heartbeat(
        session, member(session, member_id), HeartbeatIn(device_id=DEVICE, activity=activity)
    )


def no_contact(session, member_id=seed.VEGA):
    return alerts.open_alert(session, liveness_watch.no_contact_key(member_id))


def checks(session, member_id=seed.VEGA):
    return session.exec(
        select(models.RuokCheck).where(models.RuokCheck.member_id == member_id)
    ).all()


# ── Criterio de aceptación: eva_no_contact ───────────────────────────


def test_eva_no_contact_reaches_crew_now_and_ground_after_eta(session, frozen):
    seed.apply_scenario(session, "eva_no_contact")
    alert = no_contact(session)
    assert alert is not None
    assert (alert.category, alert.severity) == ("no_contact", "critical")
    events = alerts.to_schema(session, alert).events
    timeline = [(e.type, e.payload.get("target_role")) for e in events]
    # La tripulación la recibe al instante; tierra queda en cola por el enlace.
    assert ("escalated", "crew") in timeline
    assert (alert.target_role, alert.delivery_mode, alert.delay_s) == ("ground", "autonomous", 840)
    assert alert.delivered_at is None

    frozen(MARS_DELAY)
    comm_link.deliver_due(session)
    session.refresh(alert)
    assert alert.delivered_at == T0 + timedelta(seconds=MARS_DELAY)


# ── Vigilancia ───────────────────────────────────────────────────────


def test_member_without_device_is_not_watched(session, frozen):
    frozen(3600)  # todos los members del seed llevan 1 h sin heartbeat
    assert liveness_watch.check_all(session) == []
    assert session.exec(select(models.RuokCheck)).all() == []


def test_stale_opens_ruok_check_and_heartbeat_asks_for_it(session, frozen):
    heartbeat(session)
    frozen(300)  # stale_after_s
    assert liveness_watch.check_member(session, member(session)) is None
    assert len(checks(session)) == 1
    assert heartbeat(session).checkin_required is True  # vuelve: "R U OK?" a pantalla completa


def test_ruok_timeout_creates_no_contact(session, frozen):
    heartbeat(session)
    frozen(300)
    liveness_watch.check_member(session, member(session))  # abre el check-in
    frozen(119)
    assert liveness_watch.check_member(session, member(session)) is None
    frozen(1)  # ruok_timeout_s = 120
    alert = liveness_watch.check_member(session, member(session))
    assert alert is not None and alert.category == "no_contact"
    assert checks(session)[0].alert_id == alert.id


def test_lost_creates_no_contact_without_waiting(session, frozen):
    heartbeat(session)
    frozen(900)  # lost_after_s
    assert liveness_watch.check_member(session, member(session)) is not None


def test_no_duplicate_no_contact(session, frozen):
    heartbeat(session)
    frozen(900)
    liveness_watch.check_all(session)
    frozen(60)
    liveness_watch.check_all(session)
    rows = session.exec(select(models.Alert).where(models.Alert.category == "no_contact")).all()
    assert len(rows) == 1


def test_active_member_is_left_alone(session, frozen):
    heartbeat(session)
    frozen(60)
    assert liveness_watch.check_member(session, member(session)) is None
    assert checks(session) == []


# ── Respuesta al R U OK? ─────────────────────────────────────────────


def test_ruok_ok_resolves_no_contact(session, frozen):
    heartbeat(session)
    frozen(900)
    alert = liveness_watch.check_member(session, member(session))
    result = liveness_watch.answer_ruok(session, member(session), ok=True)
    assert result.liveness == "active" and result.alert_id is None
    session.refresh(alert)
    assert alert.status == "resolved"
    assert all(c.responded_at is not None and c.ok for c in checks(session))
    assert heartbeat(session).checkin_required is False


def test_ruok_need_help_creates_critical_alert(session, frozen):
    heartbeat(session)
    result = liveness_watch.answer_ruok(session, member(session), ok=False, note="mareo")
    alert = session.get(models.Alert, str(result.alert_id))
    assert (alert.severity, alert.target_role) == ("critical", "ground")
    assert "mareo" in alert.message


# ── API ──────────────────────────────────────────────────────────────


@pytest.fixture
def api(client):
    client.post("/api/v1/demo/reset")  # conserva la clave JWT: el token sigue valiendo
    yield client
    client.post("/api/v1/demo/reset")


def test_api_ruok_and_fast_forward(api, vega_auth):
    hb = {"device_id": str(DEVICE), "activity": "eva"}
    assert api.post("/api/v1/members/1/heartbeat", json=hb, headers=vega_auth).status_code == 200
    api.post("/api/v1/demo/fast-forward", json={"seconds": 150})  # EVA: lost a los 2 min
    body = api.get("/api/v1/members/1/alerts").json()
    assert any(a["category"] == "no_contact" for a in body)

    r = api.post("/api/v1/members/1/ruok", json={"ok": True})
    assert r.status_code == 200 and r.json()["liveness"] == "active"
    open_nc = api.get("/api/v1/members/1/alerts", params={"status": "escalated"}).json()
    assert not any(a["category"] == "no_contact" for a in open_nc)


def test_api_ruok_unknown_member(api):
    assert api.post("/api/v1/members/999/ruok", json={"ok": True}).status_code == 404
