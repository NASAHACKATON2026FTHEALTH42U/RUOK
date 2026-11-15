"""BE-30: centro de control (overview, pausa del liveness) y network-info."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session

from app import clock, models, seed
from app.db import init_db, make_engine
from app.schemas import HeartbeatIn
from app.services import control, liveness_watch, network
from app.services.liveness import record_heartbeat

API = "/api/v1"
T0 = datetime(2026, 11, 15, 9, 0, tzinfo=UTC)
DEVICE = uuid.UUID("11111111-2222-4333-8444-666666666666")


# ── BD aislada con reloj congelado ─────────────────────────────────────


@pytest.fixture
def frozen(monkeypatch):
    state = {"offset": 0.0}
    monkeypatch.setattr(clock, "now", lambda: T0 + timedelta(seconds=state["offset"]))

    def advance(seconds: float) -> None:
        state["offset"] += seconds

    return advance


@pytest.fixture
def session(tmp_path, frozen):
    engine = make_engine(f"sqlite:///{tmp_path}/control.db")
    init_db(engine)
    with Session(engine) as s:
        seed.seed(s)
        yield s
    engine.dispose()


def _alert(session, *, env_id="mars", severity="warning", status="open", created=T0):
    alert = models.Alert(
        id=str(uuid.uuid4()),
        member_id=seed.VEGA,
        env_id=env_id,
        origin="manual",
        category="symptom",
        severity=severity,
        target_role="crew",
        delivery_mode="realtime",
        status=status,
        created_at=created,
    )
    session.add(alert)
    session.commit()
    return alert


# ── Pausa del liveness ─────────────────────────────────────────────────


def test_paused_env_gets_no_ruok_nor_no_contact(session, frozen):
    record_heartbeat(session, session.get(models.Member, seed.VEGA), HeartbeatIn(device_id=DEVICE))
    control.set_liveness_paused(session, "mars", True)
    frozen(24 * 3600)  # un día sin señal → lost
    vega = session.get(models.Member, seed.VEGA)
    assert liveness_watch.check_member(session, vega) is None
    assert liveness_watch.pending_check(session, seed.VEGA) is None  # tampoco "R U OK?"

    control.set_liveness_paused(session, "mars", False)
    alert = liveness_watch.check_member(session, vega)
    assert alert is not None and alert.category == "no_contact"


def test_pause_is_per_environment(session):
    control.set_liveness_paused(session, "mars", True)
    control.set_liveness_paused(session, "moon", True)
    control.set_liveness_paused(session, "moon", False)
    assert control.paused_envs(session) == {"mars"}


# ── Overview y métricas ────────────────────────────────────────────────


def test_open_alerts_by_env_and_severity(session):
    _alert(session, severity="warning")
    _alert(session, severity="critical")
    _alert(session, severity="critical", status="acknowledged")  # sigue abierta
    _alert(session, severity="emergency", status="resolved")  # no cuenta
    ov = control.overview(session)
    mars = next(e for e in ov.environments if e.environment.id == "mars")
    assert mars.open_alerts.model_dump() == {"warning": 1, "critical": 2, "emergency": 0}
    assert ov.metrics.open_alerts == 3


def test_overview_has_every_env_with_real_members(session):
    ov = control.overview(session)
    ids = [e.environment.id for e in ov.environments]
    assert {"iss", "moon", "mars", "earth", "hospital", "geriatric"} <= set(ids)
    mars = next(e for e in ov.environments if e.environment.id == "mars")
    vega = next(m for m in mars.members if m.id == seed.VEGA)
    assert vega.overall_status is not None and vega.liveness is not None
    assert all(m.env_id == "mars" for m in mars.members)


def test_avg_response_none_without_acks_then_mean(session):
    assert control.avg_alert_response_s(session) is None  # sin datos ≠ 0
    for delay in (60, 120):
        a = _alert(session, status="acknowledged")
        session.add(
            models.AlertEvent(alert_id=a.id, type="acknowledged", at=T0 + timedelta(seconds=delay))
        )
        # Un segundo reconocimiento no cambia la cuenta: vale el primero.
        session.add(
            models.AlertEvent(alert_id=a.id, type="acknowledged", at=T0 + timedelta(hours=1))
        )
    session.commit()
    assert control.avg_alert_response_s(session) == 90.0


def test_active_devices_and_measurements_last_hour(session, frozen):
    session.add(models.Device(id=str(uuid.uuid4()), first_seen_at=T0, last_seen_at=T0))
    session.add(
        models.Device(id=str(uuid.uuid4()), first_seen_at=T0, last_seen_at=T0 - timedelta(hours=1))
    )
    session.commit()
    before = control.metrics(session).measurements_last_hour
    session.add(
        models.Measurement(
            id=str(uuid.uuid4()),
            member_id=seed.VEGA,
            indicator_id="heart_rate",
            value=70,
            unit="bpm",
            taken_at=T0,
            received_at=T0,
        )
    )
    session.commit()
    m = control.metrics(session)
    assert m.active_devices == 1
    assert m.measurements_last_hour == before + 1



def test_overview_filtered_by_env_has_only_its_data(session, frozen):
    before = {e: control.overview(session, e).metrics for e in ("mars", "hospital")}
    _alert(session, env_id="mars", severity="critical")
    session.add(
        models.Measurement(
            id=str(uuid.uuid4()),
            member_id=seed.VEGA,  # de Marte
            indicator_id="heart_rate",
            value=70,
            unit="bpm",
            taken_at=T0,
            received_at=T0,
        )
    )
    session.commit()
    mars = control.overview(session, "mars")
    hospital = control.overview(session, "hospital")
    assert [e.environment.id for e in mars.environments] == ["mars"]
    assert [e.environment.id for e in hospital.environments] == ["hospital"]
    assert all(m.env_id == "hospital" for m in hospital.environments[0].members)
    # Lo de Marte cuenta en Marte y no en el hospital.
    assert mars.metrics.open_alerts == before["mars"].open_alerts + 1
    assert mars.metrics.measurements_last_hour == before["mars"].measurements_last_hour + 1
    assert hospital.metrics == before["hospital"]

# ── API ────────────────────────────────────────────────────────────────


def test_api_pause_shows_in_overview(client):
    try:
        r = client.post(f"{API}/control/liveness/pause", json={"env_id": "mars", "paused": True})
        assert r.status_code == 200, r.text
        envs = client.get(f"{API}/control/overview").json()["environments"]
        assert next(e for e in envs if e["environment"]["id"] == "mars")["liveness_paused"]
        assert not next(e for e in envs if e["environment"]["id"] == "iss")["liveness_paused"]
    finally:
        client.post(f"{API}/control/liveness/pause", json={"env_id": "mars", "paused": False})


def test_api_pause_unknown_env_404(client):
    r = client.post(f"{API}/control/liveness/pause", json={"env_id": "pluto", "paused": True})
    assert r.status_code == 404


def test_control_is_admin_only(client, medic_auth):
    assert client.get(f"{API}/control/overview", headers=medic_auth).status_code == 403
    r = client.post(
        f"{API}/control/liveness/pause",
        json={"env_id": "mars", "paused": True},
        headers=medic_auth,
    )
    assert r.status_code == 403


# ── network-info ───────────────────────────────────────────────────────


def test_network_info_is_public_and_never_loopback(anon_client):
    r = anon_client.get(f"{API}/system/network-info")
    assert r.status_code == 200
    body = r.json()
    assert body["hostname"]
    for url in body["lan_urls"]:
        assert url.startswith("http://") and url.endswith(":8000")
        assert "127.0.0.1" not in url and "localhost" not in url


def test_lan_ips_filters_and_orders():
    ips = network.lan_ips(
        [
            "127.0.0.1",
            "127.0.1.1",
            "169.254.3.4",
            "8.8.4.4",
            "192.168.8.10",
            "192.168.8.10",
            "10.42.0.1",
            "no-ip",
            "::1",
        ]
    )
    assert ips == ["192.168.8.10", "10.42.0.1", "8.8.4.4"]


def test_detect_ips_uses_lan_ip_not_loopback(monkeypatch):
    monkeypatch.setattr(network, "_outbound_ip", lambda: ["192.168.8.10"])
    monkeypatch.setattr(network, "_interface_ips", lambda: ["10.42.0.1"])
    monkeypatch.setattr(network, "_hostname_ips", lambda _h: ["127.0.1.1"])
    assert network.detect_ips("ruok") == ["192.168.8.10", "10.42.0.1"]


def test_lan_host_and_port_overrides(monkeypatch):
    monkeypatch.setenv("RUOK_LAN_HOST", "192.168.8.10")
    monkeypatch.setenv("RUOK_PUBLIC_PORT", "5173")
    assert network.lan_urls(network.public_port(8000)) == ["http://192.168.8.10:5173"]


def test_api_overview_env_filter_and_unknown_env(client):
    r = client.get(f"{API}/control/overview", params={"env_id": "hospital"})
    assert r.status_code == 200, r.text
    assert [e["environment"]["id"] for e in r.json()["environments"]] == ["hospital"]
    assert client.get(f"{API}/control/overview", params={"env_id": "pluto"}).status_code == 404
