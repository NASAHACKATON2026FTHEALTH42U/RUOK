"""BE-29: registro de dispositivos (X-Device-Id + heartbeat) y GET /devices."""

import uuid

import pytest
from sqlmodel import Session

from app import models
from app.db import engine
from app.services.devices import infer_kind

API = "/api/v1"
MEMBER = 1  # Cmdr. Vega, Marte
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148"


@pytest.fixture(autouse=True)
def restore_member(client):
    """El heartbeat cambia al member: se deja como estaba (BD compartida)."""
    with Session(engine) as s:
        m = s.get(models.Member, MEMBER)
        saved = (m.last_seen_at, m.last_activity, m.device_id)
    yield
    with Session(engine) as s:
        m = s.get(models.Member, MEMBER)
        m.last_seen_at, m.last_activity, m.device_id = saved
        s.add(m)
        s.commit()


def _find(client, device_id, **params):
    r = client.get(f"{API}/devices", params=params)
    assert r.status_code == 200, r.text
    return next((d for d in r.json() if d["id"] == device_id), None)


def test_new_phone_appears_with_its_user_and_pending(client, vega_auth):
    """Criterio de aceptación: un móvil nuevo aparece con su usuario y sus pendientes."""
    dev = str(uuid.uuid4())
    headers = {**vega_auth, "X-Device-Id": dev, "User-Agent": IPHONE}
    assert client.get(f"{API}/auth/me", headers=headers).status_code == 200

    found = _find(client, dev)
    assert found is not None
    vega = client.get(f"{API}/auth/me", headers=vega_auth).json()
    assert found["user_id"] == vega["id"]
    assert found["kind"] == "mobile"
    assert found["user_agent"] == IPHONE
    assert found["ip"]  # el TestClient se presenta como "testclient"

    r = client.post(
        f"{API}/members/{MEMBER}/heartbeat",
        json={"device_id": dev, "pending_outbox": 3, "last_sync_at": "2026-11-14T10:00:00Z"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    found = _find(client, dev)
    assert found["pending_outbox"] == 3
    assert found["last_sync_at"].startswith("2026-11-14T10:00:00")


def test_device_registered_event_only_once(client, vega_auth):
    dev = str(uuid.uuid4())
    for _ in range(3):
        client.get(f"{API}/auth/me", headers={**vega_auth, "X-Device-Id": dev})
    evs = client.get(f"{API}/events", params={"type": "device.registered", "limit": 500}).json()
    mine = [e for e in evs if e["device_id"] == dev]
    assert len(mine) == 1
    assert mine[0]["env_id"] == "mars"
    assert mine[0]["member_id"] == MEMBER


def test_request_without_session_keeps_last_user(client, anon_client, vega_auth):
    dev = str(uuid.uuid4())
    client.get(f"{API}/auth/me", headers={**vega_auth, "X-Device-Id": dev})
    user_id = _find(client, dev)["user_id"]
    # Sin sesión (p. ej. el catálogo del SOS): se ve el dispositivo, pero no se pierde el usuario.
    assert anon_client.get(f"{API}/environments", headers={"X-Device-Id": dev}).status_code == 200
    assert _find(client, dev)["user_id"] == user_id


def test_anonymous_device_is_registered_without_user(client, anon_client):
    dev = str(uuid.uuid4())
    anon_client.get(f"{API}/environments", headers={"X-Device-Id": dev})
    found = _find(client, dev)
    assert found is not None and found["user_id"] is None
    assert found["kind"] == "desktop"


def test_invalid_device_id_is_ignored(anon_client):
    r = anon_client.get(f"{API}/environments", headers={"X-Device-Id": "no-es-un-uuid"})
    assert r.status_code == 200


def test_filter_by_env(client, vega_auth):
    dev = str(uuid.uuid4())
    client.get(f"{API}/auth/me", headers={**vega_auth, "X-Device-Id": dev})
    assert _find(client, dev, env_id="mars") is not None
    assert _find(client, dev, env_id="iss") is None


def test_heartbeat_kind_overrides_user_agent(client, vega_auth):
    dev = str(uuid.uuid4())
    r = client.post(
        f"{API}/members/{MEMBER}/heartbeat",
        json={"device_id": dev, "device_kind": "tablet"},
        headers={**vega_auth, "User-Agent": IPHONE},
    )
    assert r.status_code == 200, r.text
    assert _find(client, dev)["kind"] == "tablet"


def test_forwarded_ip_trusted_only_from_loopback(client, vega_auth):
    dev = str(uuid.uuid4())
    client.get(
        f"{API}/auth/me",
        headers={**vega_auth, "X-Device-Id": dev, "X-Forwarded-For": "192.168.8.21"},
    )
    assert _find(client, dev)["ip"] == "192.168.8.21"  # TestClient = proxy local


def test_devices_is_admin_only(client, vega_auth):
    assert client.get(f"{API}/devices", headers=vega_auth).status_code == 403


@pytest.mark.parametrize(
    ("ua", "kind"),
    [
        (IPHONE, "mobile"),
        ("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36", "mobile"),
        ("Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36", "tablet"),
        ("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", "tablet"),
        ("Mozilla/5.0 (X11; Linux x86_64) Firefox/130.0", "desktop"),
        (None, "desktop"),
    ],
)
def test_infer_kind(ua, kind):
    assert infer_kind(ua).value == kind
