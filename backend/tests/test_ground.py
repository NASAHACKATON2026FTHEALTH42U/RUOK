"""BE-17: consola /ground con estado as-of, solo lo entregado y filtro de privacidad."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session

from app import clock, models, seed
from app.db import init_db, make_engine
from app.schemas import AlertIn
from app.services import alerts, comm_link, ground

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
    engine = make_engine(f"sqlite:///{tmp_path}/ground.db")
    init_db(engine)
    with Session(engine) as s:
        seed.seed(s)
        yield s
    engine.dispose()


def sos(session, member_id=seed.VEGA, **kw):
    data = {"id": uuid.uuid4(), "category": "emergency", "severity": "emergency",
            "message": "SOS"}
    data.update(kw)
    alert, _ = alerts.create_manual(session, session.get(models.Member, member_id), AlertIn(**data))
    return alert


def ids(view):
    return [str(a.id) for a in view.alerts]


# ── Solo lo entregado, con estado as-of ──────────────────────────────


def test_only_delivered_alerts_are_visible(session, frozen):
    alert = sos(session)
    view = ground.ground_view(session, "mars")
    assert ids(view) == []  # en camino: ETA de 14 min
    assert view.as_of == T0 - timedelta(seconds=MARS_DELAY)

    frozen(MARS_DELAY)
    view = ground.ground_view(session, "mars")
    assert ids(view) == [alert.id]
    assert view.as_of == T0  # lo que pasaba hace 14 min


def test_onboard_alerts_never_reach_ground(session):
    sos(session, category="symptom", severity="warning")  # va a crew (a bordo)
    assert ids(ground.ground_view(session, "mars")) == []


def test_other_environments_are_not_mixed(session, frozen):
    sos(session)
    frozen(MARS_DELAY)
    assert ids(ground.ground_view(session, "iss")) == []


def test_members_summary_with_last_seen(session):
    view = ground.ground_view(session, "mars")
    assert {m.id for m in view.members} == {1, 2, 4, 5}
    assert all(m.last_seen_at is not None for m in view.members)


# ── Criterio de aceptación: LOS ──────────────────────────────────────


def test_during_los_no_new_messages_and_unknown_state(session, frozen):
    old = sos(session)
    frozen(MARS_DELAY)
    assert ids(ground.ground_view(session, "mars")) == [old.id]

    frozen(60)
    comm_link.set_state(session, "mars", "los")
    los_since = T0 + timedelta(seconds=MARS_DELAY + 60)
    new = sos(session)  # SOS durante el LOS
    frozen(3600)
    view = ground.ground_view(session, "mars")
    assert ids(view) == [old.id]  # la nueva no llega mientras no haya enlace
    assert view.link.state == "los"
    assert view.as_of == los_since  # último momento conocido
    assert {m.overall_status for m in view.members} == {"unknown"}  # nunca verde

    comm_link.set_state(session, "mars", "delayed")
    frozen(MARS_DELAY)
    view = ground.ground_view(session, "mars")
    assert set(ids(view)) == {old.id, new.id}  # al volver el enlace, llega lo encolado


# ── Privacidad conductual ────────────────────────────────────────────


def psych_alert(session, severity="critical"):
    return sos(session, category="psychological", severity=severity,
               message="Necesito hablar: no duermo y estoy muy triste")


def test_behavioral_details_are_hidden(session, frozen):
    psych_alert(session)
    frozen(MARS_DELAY)
    (alert,) = ground.ground_view(session, "mars").alerts
    assert alert.message == ground.HIDDEN_MESSAGE
    assert alert.indicator_ids == []
    assert all(e.payload == {} for e in alert.events)


def test_details_visible_if_member_shares(session, frozen):
    member = session.get(models.Member, seed.VEGA)
    member.share_behavioral_details = True
    session.add(member)
    session.commit()
    psych_alert(session)
    frozen(MARS_DELAY)
    (alert,) = ground.ground_view(session, "mars").alerts
    assert "no duermo" in alert.message


def test_details_visible_in_emergency(session, frozen):
    psych_alert(session, severity="emergency")
    frozen(MARS_DELAY)
    (alert,) = ground.ground_view(session, "mars").alerts
    assert "no duermo" in alert.message


def test_psych_role_sees_details(session, frozen):
    psych_alert(session)
    frozen(MARS_DELAY)
    (alert,) = ground.ground_view(session, "mars", viewer_role="psych").alerts
    assert "no duermo" in alert.message


def test_auto_neuro_alert_is_hidden(session, frozen):
    seed.apply_scenario(session, "mars_sleep_bp")  # neuro-conductual critical → ground
    frozen(MARS_DELAY)
    view = ground.ground_view(session, "mars")
    neuro = [a for a in view.alerts if a.system_id == "neuro_behavioral"]
    assert len(neuro) == 1 and neuro[0].message == ground.HIDDEN_MESSAGE


# ── API ──────────────────────────────────────────────────────────────


@pytest.fixture
def api(client):
    client.post("/api/v1/demo/reset")
    yield client
    client.post("/api/v1/demo/reset")


def test_api_ground_view(api):
    body = {"id": str(uuid.uuid4()), "category": "emergency", "severity": "emergency"}
    api.post("/api/v1/members/1/alerts", json=body)
    view = api.get("/api/v1/environments/mars/alerts", params={"view": "ground"}).json()
    assert view["alerts"] == [] and view["link"]["state"] == "delayed"
    api.post("/api/v1/demo/fast-forward", json={"seconds": MARS_DELAY})
    view = api.get("/api/v1/environments/mars/alerts", params={"view": "ground"}).json()
    assert [a["id"] for a in view["alerts"]] == [body["id"]]


def test_api_unknown_environment(api):
    r = api.get("/api/v1/environments/pluto/alerts", params={"view": "ground"})
    assert r.status_code == 404
