"""BE-13: enlace simulado con la Tierra (store-and-forward, retardo y LOS)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session

from app import clock, models
from app.db import init_db, make_engine
from app.schemas.common import LinkState
from app.services import comm_link

T0 = datetime(2026, 11, 15, 9, 0, tzinfo=UTC)
MARS_DELAY = 840


@pytest.fixture
def frozen(monkeypatch):
    """Reloj controlado: `now` = T0 + avance manual."""
    state = {"offset": 0.0}
    monkeypatch.setattr(clock, "now", lambda: T0 + timedelta(seconds=state["offset"]))

    def advance(seconds: float) -> None:
        state["offset"] += seconds

    return advance


@pytest.fixture
def db_path(tmp_path):
    return f"sqlite:///{tmp_path}/link.db"


@pytest.fixture
def session(db_path, frozen):
    engine = make_engine(db_path)
    init_db(engine)
    with Session(engine) as s:
        yield s
    engine.dispose()


def alert_up(session, env_id="mars", ref="a1"):
    return comm_link.send(
        session, env_id, "up", "alert", ref_id=ref, payload={"severity": "critical"}
    )


# ── Estado del enlace ────────────────────────────────────────────────


def test_default_state_depends_on_delay(session):
    mars = comm_link.status(session, "mars")
    iss = comm_link.status(session, "iss")
    assert (mars.state, mars.delay_s, mars.queued) == (LinkState.delayed, MARS_DELAY, 0)
    assert (iss.state, iss.delay_s) == (LinkState.online, 0)
    moon = comm_link.status(session, "moon")
    assert (moon.state, moon.delay_s) == (LinkState.online, 1)  # conserva su retardo natural


def test_unknown_environment(session):
    with pytest.raises(comm_link.UnknownEnvironment):
        comm_link.status(session, "pluto")
    with pytest.raises(comm_link.UnknownEnvironment):
        comm_link.send(session, "pluto", "up", "alert")


# ── Entrega tras la ETA ──────────────────────────────────────────────


def test_delivered_after_eta(session, frozen):
    msg = alert_up(session)
    assert msg.state == "in_transit"
    assert msg.eta == T0 + timedelta(seconds=MARS_DELAY)

    frozen(MARS_DELAY - 1)
    assert comm_link.deliver_due(session, "mars") == []
    assert comm_link.status(session, "mars").queued == 1

    frozen(1)
    assert [m.id for m in comm_link.deliver_due(session, "mars")] == [msg.id]
    session.refresh(msg)
    assert msg.state == "delivered"
    assert msg.delivered_at == msg.eta
    assert comm_link.status(session, "mars").queued == 0


def test_late_check_keeps_real_arrival_time(session, frozen):
    msg = alert_up(session)
    frozen(3600)  # nadie consulta hasta una hora después
    comm_link.deliver_due(session)
    session.refresh(msg)
    assert msg.delivered_at == T0 + timedelta(seconds=MARS_DELAY)


def test_no_delay_is_delivered_instantly(session):
    msg = alert_up(session, "iss")
    session.refresh(msg)
    assert msg.state == "delivered"
    assert msg.delivered_at == T0


# ── LOS ──────────────────────────────────────────────────────────────


def test_queued_during_los(session, frozen):
    comm_link.set_state(session, "mars", "los")
    msg = alert_up(session)
    assert msg.state == "queued"
    frozen(3600)
    comm_link.deliver_due(session)
    session.refresh(msg)
    assert msg.state == "queued"
    status = comm_link.status(session, "mars")
    assert (status.state, status.queued) == (LinkState.los, 1)


def test_delivered_when_link_returns(session, frozen):
    comm_link.set_state(session, "mars", "los")
    msg = alert_up(session)
    frozen(600)
    comm_link.set_state(session, "mars", "delayed")
    session.refresh(msg)
    assert msg.state == "in_transit"
    assert msg.eta == T0 + timedelta(seconds=600 + MARS_DELAY)  # sale al volver el enlace
    frozen(MARS_DELAY)
    comm_link.deliver_due(session)
    session.refresh(msg)
    assert msg.state == "delivered"


def test_in_flight_messages_wait_while_los(session, frozen):
    msg = alert_up(session)
    comm_link.set_state(session, "mars", "los")
    frozen(MARS_DELAY + 10)
    comm_link.deliver_due(session)
    session.refresh(msg)
    assert msg.state == "in_transit"  # no se entrega durante LOS
    comm_link.set_state(session, "mars", "delayed")
    session.refresh(msg)
    assert msg.state == "delivered"  # su ETA ya había pasado


def test_state_change_updates_since(session, frozen):
    frozen(120)
    row = comm_link.set_state(session, "mars", "los")
    assert row.since == T0 + timedelta(seconds=120)


# ── Retardo ──────────────────────────────────────────────────────────


def test_forced_online_has_no_delay(session):
    comm_link.set_state(session, "mars", "online")
    assert comm_link.status(session, "mars").delay_s == 0
    msg = alert_up(session)
    session.refresh(msg)
    assert msg.state == "delivered"


def test_delay_override(session, frozen):
    row = comm_link.get_state(session, "mars")
    row.delay_override_s = 60
    session.add(row)
    session.commit()
    msg = alert_up(session)
    assert msg.eta == T0 + timedelta(seconds=60)


# ── Persistencia ─────────────────────────────────────────────────────


def test_messages_survive_restart(db_path, frozen):
    engine = make_engine(db_path)
    init_db(engine)
    with Session(engine) as s:
        comm_link.set_state(s, "mars", "los")
        msg_id = alert_up(s).id
    engine.dispose()  # "reinicio" del servidor

    engine = make_engine(db_path)
    with Session(engine) as s:
        assert comm_link.status(s, "mars").state == LinkState.los
        assert s.get(models.LinkMessage, msg_id).state == "queued"
        comm_link.set_state(s, "mars", "delayed")
        frozen(MARS_DELAY)
        comm_link.deliver_due(s)
        assert s.get(models.LinkMessage, msg_id).state == "delivered"
    engine.dispose()


# ── Mensajes ─────────────────────────────────────────────────────────


def test_list_messages_by_direction(session, frozen):
    alert_up(session, ref="a1")
    frozen(1)
    comm_link.send(session, "mars", "down", "alert_event", ref_id="e1")
    frozen(1)
    alert_up(session, ref="a2")
    assert [m.ref_id for m in comm_link.list_messages(session, "mars")] == ["a1", "e1", "a2"]
    assert [m.ref_id for m in comm_link.list_messages(session, "mars", "up")] == ["a1", "a2"]
    assert comm_link.list_messages(session, "iss") == []


# ── API ──────────────────────────────────────────────────────────────


@pytest.fixture
def api(client):
    client.post("/api/v1/demo/reset")
    yield client
    client.post("/api/v1/demo/reset")


def test_api_get_link(api):
    r = api.get("/api/v1/link", params={"env": "mars"})
    assert r.status_code == 200
    body = r.json()
    assert (body["env_id"], body["state"], body["delay_s"], body["queued"]) == (
        "mars", "delayed", MARS_DELAY, 0,
    )
    assert api.get("/api/v1/link", params={"env": "pluto"}).status_code == 404
    assert api.get("/api/v1/link/messages", params={"env": "pluto"}).status_code == 404


def test_api_demo_link_and_fast_forward(api):
    from app.db import engine

    r = api.post("/api/v1/demo/link", json={"env": "mars", "state": "los"})
    assert r.status_code == 200 and r.json()["state"] == "los"
    assert api.get("/api/v1/link", params={"env": "mars"}).json()["state"] == "los"

    with Session(engine) as s:
        comm_link.send(s, "mars", "up", "alert", ref_id="sos")
    assert api.get("/api/v1/link", params={"env": "mars"}).json()["queued"] == 1

    api.post("/api/v1/demo/link", json={"env": "mars", "state": "delayed"})
    api.post("/api/v1/demo/fast-forward", json={"seconds": MARS_DELAY})
    msgs = api.get("/api/v1/link/messages", params={"env": "mars", "direction": "up"}).json()
    assert [(m["ref_id"], m["state"]) for m in msgs] == [("sos", "delivered")]
    assert api.get("/api/v1/link", params={"env": "mars"}).json()["queued"] == 0


def test_api_demo_link_unknown_env(api):
    assert api.post("/api/v1/demo/link", json={"env": "pluto", "state": "los"}).status_code == 404


def test_control_and_ground_show_real_link(api):
    api.post("/api/v1/demo/link", json={"env": "mars", "state": "los"})
    overview = api.get("/api/v1/control/overview").json()
    mars = next(e for e in overview["environments"] if e["environment"]["id"] == "mars")
    assert mars["link"]["state"] == "los"
    ground = api.get("/api/v1/environments/mars/alerts", params={"view": "ground"}).json()
    assert ground["link"]["state"] == "los"
