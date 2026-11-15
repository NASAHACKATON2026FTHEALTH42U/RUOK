"""FS-02: el OpenAPI cubre todo docs/api-contract.md y los stubs responden datos válidos.

Si añades o cambias un endpoint en el contrato, actualiza CONTRACT_ENDPOINTS.
"""

import uuid
from datetime import UTC, datetime

import pytest

from app import clock

API = "/api/v1"
ALERT_ID = "6f1c2a9e-0b5d-4c1e-9f3a-2d8e7b6a5c41"
NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC).isoformat()

# (método, ruta) exactamente como en docs/api-contract.md
CONTRACT_ENDPOINTS = [
    ("get", "/health"),
    ("post", "/auth/login"),
    ("get", "/auth/me"),
    ("get", "/auth/demo-users"),
    ("get", "/users"),
    ("post", "/users"),
    ("post", "/members/{member_id}/home-messages"),
    ("get", "/members/{member_id}/home-messages"),
    ("get", "/members/{member_id}/summary"),
    ("patch", "/users/{user_id}"),
    ("post", "/members/{member_id}/kudos"),
    ("get", "/environments/{env_id}/kudos"),
    ("get", "/environments/{env_id}/missions"),
    ("post", "/members/{member_id}/missions/{mission_id}/join"),
    ("get", "/environments"),
    ("get", "/environments/{env_id}"),
    ("get", "/indicators"),
    ("get", "/indicators/{indicator_id}"),
    ("get", "/systems"),
    ("get", "/interventions"),
    ("get", "/environments/{env_id}/members"),
    ("get", "/members/{member_id}"),
    ("patch", "/members/{member_id}/privacy"),
    ("post", "/members/{member_id}/measurements"),
    ("get", "/members/{member_id}/measurements"),
    ("get", "/members/{member_id}/assessment"),
    ("get", "/members/{member_id}/forecast"),
    ("post", "/members/{member_id}/heartbeat"),
    ("post", "/members/{member_id}/ruok"),
    ("get", "/members/{member_id}/alerts"),
    ("post", "/members/{member_id}/alerts"),
    ("post", "/members/{member_id}/notifications"),
    ("get", "/members/{member_id}/notifications"),
    ("post", "/alerts/{alert_id}/escalate"),
    ("post", "/alerts/{alert_id}/ack"),
    ("post", "/alerts/{alert_id}/resolve"),
    ("post", "/alerts/{alert_id}/messages"),
    ("get", "/environments/{env_id}/alerts"),
    ("get", "/members/{member_id}/tasks"),
    ("post", "/members/{member_id}/tasks/{task_id}/complete"),
    ("post", "/members/{member_id}/interventions/{intervention_id}/complete"),
    ("get", "/members/{member_id}/game"),
    ("get", "/environments/{env_id}/leaderboard"),
    ("get", "/events/stream"),
    ("get", "/events"),
    ("get", "/devices"),
    ("get", "/control/overview"),
    ("post", "/control/liveness/pause"),
    ("get", "/system/network-info"),
    ("get", "/link"),
    ("get", "/link/messages"),
    ("post", "/demo/reset"),
    ("post", "/demo/scenarios/{name}"),
    ("post", "/demo/link"),
    ("post", "/demo/fast-forward"),
]

PUBLIC = {
    "/health",
    "/auth/login",
    "/auth/demo-users",
    "/system/network-info",
    # Catálogo de configuración: lo usan el SOS y el protocolo autónomo sin sesión (BE-27).
    "/environments",
    "/environments/{env_id}",
    "/indicators",
    "/indicators/{indicator_id}",
    "/systems",
    "/interventions",
}


@pytest.fixture(scope="module")
def openapi():
    from app.main import app

    return app.openapi()


def test_every_contract_endpoint_is_in_openapi(openapi):
    paths = openapi["paths"]
    missing = [(m, p) for m, p in CONTRACT_ENDPOINTS if m not in paths.get(API + p, {})]
    assert not missing, f"Faltan en el OpenAPI: {missing}"


def test_no_undocumented_endpoints(openapi):
    documented = {(m, API + p) for m, p in CONTRACT_ENDPOINTS}
    actual = {(m, p) for p, ops in openapi["paths"].items() if p.startswith(API) for m in ops}
    extra = actual - documented
    assert not extra, f"Endpoints sin documentar en docs/api-contract.md: {extra}"


def test_protected_endpoints_declare_bearer(openapi):
    assert "HTTPBearer" in openapi["components"]["securitySchemes"]
    for method, path in CONTRACT_ENDPOINTS:
        op = openapi["paths"][API + path][method]
        if path in PUBLIC:
            assert "security" not in op, f"{method} {path} debería ser público"
        else:
            assert op.get("security"), f"{method} {path} debería declarar Bearer"


def test_device_header_on_all_endpoints(openapi):
    for method, path in CONTRACT_ENDPOINTS:
        params = openapi["paths"][API + path][method].get("parameters", [])
        assert any(p["name"] == "x-device-id" and p["in"] == "header" for p in params), path


def test_enums_are_named_schemas(openapi):
    schemas = openapi["components"]["schemas"]
    assert schemas["Status"]["enum"] == ["normal", "warning", "critical", "unknown"]
    assert schemas["Liveness"]["enum"] == ["active", "stale", "lost"]
    assert schemas["Role"]["enum"] == [
        "member",
        "medic",
        "commander",
        "responder",
        "psych",
        "family",
        "admin",
    ]
    # Member.position ≠ User.role (roles de acceso)
    assert "position" in schemas["Member"]["properties"]
    assert "role" not in schemas["Member"]["properties"]


# ── Los stubs responden con datos válidos ───────────────────

MEASUREMENT = {
    "id": str(uuid.uuid4()),
    "indicator_id": "bp_systolic",
    "value": 142,
    "taken_at": NOW,
}

CALLS = [
    ("get", "/health", None, 200),
    ("post", "/auth/login", {"username": "vega", "password": "ruok-mars"}, 200),
    ("get", "/auth/me", None, 200),
    ("get", "/auth/demo-users", None, 200),
    ("get", "/users?env_id=mars", None, 200),
    (
        "post",
        "/users",
        {
            "username": "contract-user",
            "display_name": "N",
            "role": "medic",
            "env_id": "mars",
            "password": "contraseña-segura",
        },
        201,
    ),
    ("patch", "/users/1", {"active": True}, 200),
    ("get", "/environments", None, 200),
    ("get", "/environments/mars", None, 200),
    ("get", "/indicators", None, 200),
    ("get", "/indicators/bp_systolic", None, 200),
    ("get", "/systems", None, 200),
    ("get", "/interventions?system_id=neuro_behavioral", None, 200),
    ("get", "/environments/mars/members", None, 200),
    ("get", "/members/1", None, 200),
    ("patch", "/members/1/privacy", {"share_behavioral_details": True}, 200),
    ("post", "/members/1/measurements", {"measurements": [MEASUREMENT]}, 200),
    (
        "get",
        "/members/1/measurements?indicator_id=bp_systolic&from=2026-11-14T10:00:00Z",
        None,
        200,
    ),
    ("get", "/members/1/assessment?env=geriatric", None, 200),
    ("get", "/members/1/forecast?indicator_id=bp_systolic&horizon_days=7", None, 200),
    ("post", "/members/1/heartbeat", {"device_id": str(uuid.uuid4()), "pending_outbox": 2}, 200),
    ("post", "/members/1/ruok", {"ok": False}, 200),
    ("get", "/members/1/alerts?status=escalated", None, 200),
    (
        "post",
        "/members/1/alerts",
        {"id": str(uuid.uuid4()), "category": "emergency", "severity": "emergency"},
        200,
    ),
    # Las acciones (BE-15) son reales: actúan sobre ALERT_ID, que se crea antes (ver abajo).
    ("post", f"/alerts/{ALERT_ID}/escalate", {"target_role": "ground"}, 200),
    ("post", f"/alerts/{ALERT_ID}/ack", {"actor": "responder"}, 200),
    ("post", f"/alerts/{ALERT_ID}/resolve", {"actor": "responder"}, 200),
    ("post", f"/alerts/{ALERT_ID}/messages", {"actor": "member", "text": "hola"}, 200),
    ("get", "/environments/mars/alerts?view=ground", None, 200),
    ("get", "/members/1/tasks?date=2026-11-14", None, 200),
    (
        "post",
        "/members/1/tasks/t_2026-11-14_1_checkin/complete",
        {"id": str(uuid.uuid4()), "completed_at": NOW},
        200,
    ),
    ("get", "/members/1/game", None, 200),
    (
        "post",
        "/members/1/home-messages",
        {"id": "7b1d2c3e-4f50-4a61-8b72-9c83d4e5f601", "text": "Hola"},
        200,
    ),
    ("get", "/members/1/home-messages", None, 200),
    (
        "post",
        "/members/1/kudos",
        {"id": "3c1d2c3e-4f50-4a61-8b72-9c83d4e5f6a1", "to_member_id": 2, "message": "Gracias"},
        200,
    ),
    ("get", "/environments/mars/kudos", None, 200),
    ("get", "/environments/mars/missions", None, 200),
    (
        "post",
        "/members/1/missions/tend_plants/join",
        {"id": "4d2e3d4f-5061-4b72-9c83-ad94e5f6a7b2"},
        200,
    ),
    ("get", "/environments/mars/leaderboard", None, 200),
    ("get", "/events?since_id=1", None, 200),
    ("get", "/devices", None, 200),
    ("get", "/control/overview", None, 200),
    ("post", "/control/liveness/pause", {"env_id": "mars", "paused": False}, 200),
    ("get", "/system/network-info", None, 200),
    ("get", "/link?env=mars", None, 200),
    ("get", "/link/messages?env=mars", None, 200),
    ("post", "/demo/reset", None, 200),
    ("post", "/demo/scenarios/mars_sleep_bp", None, 200),
    ("post", "/demo/link", {"env": "mars", "state": "los"}, 200),
    ("post", "/demo/fast-forward", {"seconds": 60}, 200),
]


# SOS de ejemplo sobre el que actúan escalate/ack/resolve/messages (warning → crew).
ALERT_BODY = {"id": ALERT_ID, "category": "symptom", "severity": "warning", "message": "mareo"}


MEMBER_ONLY = {"/members/1/privacy", "/members/1/heartbeat"}


@pytest.mark.parametrize(("method", "path", "body", "status"), CALLS)
def test_stub_responds(client, method, path, body, status):
    # Token real (BE-26). Con los permisos de BE-27, admin puede casi todo; lo que es
    # solo del propio member (privacidad, heartbeat) se llama como vega (member 1).
    login = {"username": "admin", "password": "ruok-admin"}
    if path.split("?")[0] in MEMBER_ONLY:
        login = {"username": "vega", "password": "ruok-mars"}
    token = client.post(API + "/auth/login", json=login).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    if ALERT_ID in path:  # idempotente: la crea si no existe (o un reset la ha borrado)
        created = client.post(API + "/members/1/alerts", json=ALERT_BODY, headers=headers)
        assert created.status_code == 200
    resp = client.request(method, API + path, json=body, headers=headers)
    assert resp.status_code == status, resp.text


def test_calls_cover_all_contract_endpoints():
    called = {(m, p.split("?")[0]) for m, p, _, _ in CALLS}
    for method, path in CONTRACT_ENDPOINTS:
        if path == "/events/stream":
            continue  # se prueba aparte
        prefix = path.split("{")[0]
        assert any(
            m == method and p.startswith(prefix) and p.count("/") == path.count("/")
            for m, p in called
        ), f"Sin llamada de prueba: {method} {path}"


@pytest.mark.parametrize(
    "path",
    ["/environments/pluto", "/members/999", "/indicators/nope", "/environments/pluto/members"],
)
def test_unknown_resources_return_404(client, path):
    resp = client.get(API + path)
    assert resp.status_code == 404
    assert "detail" in resp.json()


def test_validation_errors_return_422(client):
    resp = client.post(API + "/members/1/measurements", json={"measurements": []})
    assert resp.status_code == 422
    resp = client.post(
        API + "/members/1/measurements", json={"measurements": [{**MEASUREMENT, "extra": 1}]}
    )
    assert resp.status_code == 422  # extra="forbid"


def test_assessment_mode_depends_on_environment(client):
    # El assessment ya es real (BE-11) y el seed (BE-07) da datos normales: se carga
    # el escenario de la demo para tener un sistema en `critical` (sueño de Vega).
    client.post(API + "/demo/scenarios/mars_sleep_bp")
    try:
        mars = client.get(API + "/members/1/assessment").json()
        iss = client.get(API + "/members/1/assessment?env=iss").json()

        def neuro(a):
            return next(s for s in a["systems"] if s["system_id"] == "neuro_behavioral")

        assert neuro(mars)["status"] == "critical"
        # El escalado de un critical va a `crew` (a bordo): realtime y sin retardo (BE-31).
        esc = neuro(mars)["escalation"]
        assert (esc["target_role"], esc["mode"], esc["delay_s"]) == ("crew", "realtime", 0)
        assert neuro(iss)["escalation"]["mode"] == "realtime"  # mismos datos, ISS
    finally:
        client.post(API + "/demo/reset")  # no dejar el escenario a los demás tests


def test_assessment_escalation_follows_contract(client):
    """Regla del contrato (docs/alerts-and-escalation.md), no valores concretos del seed:
    - `autonomous` solo con estado `critical` (y retardo >= 60 s);
    - sin retardo (ISS), todo es `realtime` con delay 0;
    - el mismo member evaluado con otro perfil (`?env=`) usa el retardo de ese perfil.
    """
    mars = client.get(API + "/members/1/assessment?env=mars").json()
    iss = client.get(API + "/members/1/assessment?env=iss").json()
    assert mars["env_id"] == "mars" and iss["env_id"] == "iss"
    for system in mars["systems"] + iss["systems"]:
        if system["escalation"]["mode"] == "autonomous":
            assert system["status"] == "critical", system
    for system in iss["systems"]:
        assert system["escalation"]["mode"] == "realtime", system
        assert system["escalation"]["delay_s"] == 0, system


def test_events_stream_is_sse(client):
    body = {"measurements": [{**MEASUREMENT, "id": str(uuid.uuid4())}]}
    assert client.post(API + "/members/1/measurements", json=body).status_code == 200
    last = client.get(API + "/events?type=measurement.created").json()[-1]["id"]
    headers = {"Last-Event-ID": str(last - 1)}
    with client.stream("GET", API + "/events/stream?env_id=mars", headers=headers) as resp:
        assert resp.headers["content-type"].startswith("text/event-stream")
        text = "".join(resp.iter_text())
    assert f"id: {last}\nevent: measurement.created\ndata: {{" in text


def test_fast_forward_moves_demo_clock(client):
    before = clock.now()
    resp = client.post(API + "/demo/fast-forward", json={"seconds": 840})
    assert resp.json()["offset_s"] == 840
    assert (clock.now() - before).total_seconds() >= 840
