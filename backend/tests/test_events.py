"""BE-28: bitácora de eventos (event_log), bus en memoria y stream SSE."""

import json
import threading
import time
import uuid
from datetime import timedelta

import pytest
from sqlmodel import Session, select

from app import clock, models
from app.db import engine
from app.schemas import EventType
from app.services import events
from tests.conftest import login_headers

API = "/api/v1"

# El arranque de la app (fixture `client`) crea las tablas y siembra la BD.
pytestmark = pytest.mark.usefixtures("client")


def _emit(type_=EventType.measurement_created, **kw) -> int:
    kw.setdefault("env_id", "mars")
    kw.setdefault("member_id", 1)
    with Session(engine) as s:
        row = events.emit(s, type_, summary=kw.pop("summary", "prueba"), **kw)
        s.commit()
        return row.id


def _parse(text: str) -> list[dict]:
    """Mensajes SSE → lista de {id, event, data}."""
    out = []
    for block in text.split("\n\n"):
        fields = dict(
            line.split(": ", 1) for line in block.splitlines() if line and not line.startswith(":")
        )
        if "data" in fields:
            out.append({**fields, "id": int(fields["id"])})
    return out


def _stream(client, *, last_id=None, params="", headers=None):
    h = dict(headers or {})
    if last_id is not None:
        h["Last-Event-ID"] = str(last_id)
    with client.stream("GET", f"{API}/events/stream{params}", headers=h) as resp:
        assert resp.status_code == 200, resp.read()
        return _parse("".join(resp.iter_text()))


# ── emit y transacciones ────────────────────────────────────────────


def test_emit_is_saved_on_commit():
    ev_id = _emit(ref_id="abc", payload={"x": 1})
    with Session(engine) as s:
        row = s.get(models.EventLog, ev_id)
    assert row.type == "measurement.created"
    assert row.ref_id == "abc" and row.payload == {"x": 1}


def test_emit_is_discarded_on_rollback():
    with Session(engine) as s:
        ev_id = events.emit(s, EventType.heartbeat, env_id="mars", summary="x").id
        s.rollback()
    with Session(engine) as s:
        assert s.get(models.EventLog, ev_id) is None


def test_purge_removes_events_older_than_7_days():
    old = _emit()
    clock.advance(events.RETENTION.total_seconds() + 60)
    recent = _emit()
    with Session(engine) as s:
        events.purge_old(s)
        assert s.get(models.EventLog, old) is None
        assert s.get(models.EventLog, recent) is not None


# ── SSE ─────────────────────────────────────────────────────────────


def test_sse_client_receives_event_emitted_while_connected(client, monkeypatch):
    """El evento se emite DESPUÉS de abrir el stream: llega por el bus, no por la BD."""
    monkeypatch.setenv("RUOK_SSE_MAX_SECONDS", "2")
    marker = f"vivo-{uuid.uuid4()}"
    timer = threading.Timer(0.3, lambda: _emit(summary=marker))
    started = time.monotonic()
    timer.start()
    try:
        with client.stream("GET", f"{API}/events/stream") as resp:
            for line in resp.iter_lines():
                if marker in line:
                    elapsed = time.monotonic() - started
                    break
            else:
                pytest.fail("El evento no llegó por el stream")
    finally:
        timer.cancel()
    assert elapsed < 1.5  # sin esperar al keepalive (15 s): el commit despierta el stream
    data = json.loads(line.removeprefix("data: "))
    assert data["summary"] == marker and data["type"] == "measurement.created"


def test_sse_message_format(client):
    ev_id = _emit(summary="formato")
    with client.stream(
        "GET", f"{API}/events/stream", headers={"Last-Event-ID": str(ev_id - 1)}
    ) as r:
        assert r.headers["content-type"].startswith("text/event-stream")
        assert r.headers["cache-control"] == "no-cache"
        text = "".join(r.iter_text())
    assert text.startswith("retry: 3000\n\n")
    assert f"id: {ev_id}\nevent: measurement.created\ndata: {{" in text


def test_reconnect_with_last_event_id_loses_nothing(client):
    ids = [_emit(summary=f"e{i}") for i in range(4)]
    got = _stream(client, last_id=ids[0])
    got_ids = [m["id"] for m in got]
    assert got_ids[:3] == ids[1:]  # en orden, sin el ya visto y sin huecos
    assert len(got_ids) == len(set(got_ids))


def test_first_connection_only_gets_new_events(client):
    _emit(summary="viejo")
    assert _stream(client) == []


def test_types_and_env_filters(client):
    first = _emit(EventType.heartbeat, summary="hb")
    _emit(EventType.measurement_created, summary="m")
    _emit(EventType.heartbeat, env_id="iss", member_id=3, summary="hb-iss")
    got = _stream(client, last_id=first - 1, params="?types=heartbeat&env_id=mars")
    assert [json.loads(m["data"])["summary"] for m in got] == ["hb"]


# ── Filtro por rol ──────────────────────────────────────────────────


def _row(**kw):
    base = {"type": "measurement.created", "env_id": "mars", "member_id": 1, "summary": ""}
    return models.EventLog(**{**base, **kw})


@pytest.mark.parametrize(
    ("viewer", "row", "visible"),
    [
        (events.Viewer(1, "admin", None, None), _row(type="auth.failed"), True),
        (events.Viewer(2, "medic", "mars", None), _row(), True),
        (events.Viewer(2, "medic", "mars", None), _row(env_id="iss"), False),
        (events.Viewer(3, "commander", "mars", None), _row(member_id=2), True),
        (events.Viewer(4, "member", "mars", 1), _row(), True),
        (events.Viewer(4, "member", "mars", 1), _row(member_id=2), False),
        (events.Viewer(5, "responder", "mars", None), _row(), False),  # aún no entregado
        (events.Viewer(5, "responder", "mars", None), _row(type="link.delivered"), True),
        (events.Viewer(6, "psych", "mars", None), _row(type="link.state_changed"), True),
        (events.Viewer(6, "psych", "mars", None), _row(type="link.delivered", env_id="iss"), False),
        (events.Viewer(2, "medic", "mars", None), _row(type="auth.login"), False),  # solo admin
        (events.Viewer(7, "family", "mars", None), _row(), False),
    ],
)
def test_visible_to(viewer, row, visible):
    assert events.visible_to(row, viewer) is visible


def test_sse_filters_by_role_of_token(anon_client, client):
    mine = _emit(member_id=1, summary="de vega")
    _emit(member_id=2, summary="de okafor")
    _emit(EventType.auth_login, member_id=1, summary="login de vega")
    token = login_headers(client, "vega", "ruok-mars")["Authorization"].removeprefix("Bearer ")
    got = _stream(anon_client, last_id=mine - 1, params=f"?token={token}")
    summaries = [json.loads(m["data"])["summary"] for m in got]
    assert "de vega" in summaries
    assert "de okafor" not in summaries
    assert "login de vega" not in summaries  # auth.*: solo admin


# ── GET /events (fallback de polling) ───────────────────────────────


def test_list_events_since_id(client):
    a = _emit(summary="a")
    b = _emit(EventType.heartbeat, summary="b")
    got = client.get(f"{API}/events", params={"since_id": a - 1}).json()
    assert [e["id"] for e in got][:2] == [a, b]
    only = client.get(f"{API}/events", params={"since_id": a - 1, "type": "heartbeat"}).json()
    assert [e["id"] for e in only] == [b]


def test_list_events_limit_is_validated(client):
    assert client.get(f"{API}/events", params={"limit": 501}).status_code == 422
    assert client.get(f"{API}/events", params={"limit": 1}).status_code == 200


# ── Eventos que emite el sistema ────────────────────────────────────


def _types_since(since: int) -> list[str]:
    with Session(engine) as s:
        rows = s.exec(
            select(models.EventLog).where(models.EventLog.id > since).order_by(models.EventLog.id)
        ).all()
    return [r.type for r in rows]


def _last() -> int:
    with Session(engine) as s:
        return events.last_id(s)


def test_sos_and_alert_actions_emit_events(client):
    since = _last()
    body = {"id": str(uuid.uuid4()), "category": "emergency", "severity": "emergency"}
    alert = client.post(f"{API}/members/1/alerts", json=body).json()
    client.post(f"{API}/alerts/{alert['id']}/ack", json={"actor": "responder"})
    client.post(f"{API}/alerts/{alert['id']}/resolve", json={"actor": "responder"})
    types = _types_since(since)
    assert types[0] == "alert.created"
    assert "alert.escalated" in types  # el SOS sube hasta el primer nivel externo
    assert types[-2:] == ["alert.acknowledged", "alert.resolved"]


def test_login_events(client):
    since = _last()
    login_headers(client, "medic-mars", "ruok-mars")
    client.post(f"{API}/auth/login", json={"username": "medic-mars", "password": "mal"})
    client.post(f"{API}/auth/login", json={"username": "medic-mars", "password": "ruok-mars"})
    assert _types_since(since) == ["auth.login", "auth.failed", "auth.login"]


def test_heartbeat_emits_heartbeat_and_liveness_change(client, vega_auth):
    clock.advance(24 * 3600)  # vega lleva un día sin señal → lost
    since = _last()
    hb = {"device_id": str(uuid.uuid4())}
    client.post(f"{API}/members/1/heartbeat", json=hb, headers=vega_auth)
    assert _types_since(since) == ["heartbeat", "liveness.changed"]
    since = _last()
    client.post(f"{API}/members/1/heartbeat", json=hb, headers=vega_auth)
    assert _types_since(since) == ["heartbeat"]  # ya estaba activo


def _measurements(n: int, age: timedelta):
    taken = (clock.now() - age).isoformat().replace("+00:00", "Z")
    return {
        "measurements": [
            {
                "id": str(uuid.uuid4()),
                "indicator_id": "heart_rate",
                "value": 60 + i,
                "taken_at": taken,
            }
            for i in range(n)
        ]
    }


def test_fresh_measurements_emit_one_event_each(client):
    since = _last()
    client.post(f"{API}/members/1/measurements", json=_measurements(2, timedelta(0)))
    assert _types_since(since).count("measurement.created") == 2


def test_offline_batch_emits_single_sync_batch(client):
    since = _last()
    client.post(f"{API}/members/1/measurements", json=_measurements(3, timedelta(hours=2)))
    types = _types_since(since)
    assert types.count("sync.batch") == 1
    assert "measurement.created" not in types


def test_link_state_and_delivery_events(client):
    since = _last()
    client.post(f"{API}/demo/link", json={"env": "mars", "state": "los"})
    client.post(f"{API}/demo/link", json={"env": "mars", "state": "online"})
    assert _types_since(since).count("link.state_changed") == 2
