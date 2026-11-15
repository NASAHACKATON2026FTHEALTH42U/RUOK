"""BE-27: autorización por rol y propiedad del dato en todos los endpoints.

La matriz esperada se escribe aquí a mano (copiada de docs/auth-and-roles.md) y no se
lee de app/auth/permissions.py: así el test comprueba el código contra el doc.
"""

import uuid

import pytest
from sqlmodel import Session, select

from app import models
from app.db import engine
from app.services import accounts
from tests.conftest import login_headers

API = "/api/v1"

# Usuarios demo de Marte (BE-25): vega es el member 1.
USERS = {
    "member": ("vega", "ruok-mars"),
    "medic": ("medic-mars", "ruok-mars"),
    "commander": ("commander-mars", "ruok-mars"),
    "responder": ("responder-mars", "ruok-mars"),
    "psych": ("psych-mars", "ruok-mars"),
    "admin": ("admin", "ruok-admin"),
}
ROLES = list(USERS)
EVERYONE = set(ROLES)
CREW_VIEW = {"member", "medic", "commander", "responder", "psych", "admin"}
ACK = {"medic", "commander", "responder", "psych", "admin"}
GAME = {"member", "medic", "commander", "admin"}
ADMIN = {"admin"}

ALERT = "{alert}"  # se sustituye por una alerta real del member 1


def _warning():
    return {"id": str(uuid.uuid4()), "category": "physical", "severity": "warning"}


def _measurement():
    return {
        "measurements": [
            {
                "id": str(uuid.uuid4()),
                "indicator_id": "heart_rate",
                "value": 70,
                "taken_at": "2026-11-14T10:00:00Z",
            }
        ]
    }


# (método, ruta, cuerpo (o función que lo genera), roles con permiso)
MATRIX = [
    ("get", "/environments/mars/members", None, {"medic", "commander", "admin"}),
    ("get", "/members/1", None, CREW_VIEW),
    ("patch", "/members/1/privacy", {"share_behavioral_details": False}, {"member"}),
    ("post", "/members/1/measurements", _measurement, {"member", "medic", "admin"}),
    ("get", "/members/1/measurements", None, CREW_VIEW),
    ("get", "/members/1/assessment", None, CREW_VIEW),
    ("get", "/members/1/forecast?indicator_id=heart_rate", None, CREW_VIEW),
    ("post", "/members/1/heartbeat", lambda: {"device_id": str(uuid.uuid4())}, {"member"}),
    ("post", "/members/1/ruok", {"ok": True}, {"member", "admin"}),
    ("get", "/members/1/alerts", None, CREW_VIEW),
    ("post", "/members/1/alerts", _warning, {"member", "medic", "commander", "admin"}),
    ("post", f"/alerts/{ALERT}/escalate", {}, {"member", "medic", "commander", "admin"}),
    ("post", f"/alerts/{ALERT}/ack", {"actor": "responder"}, ACK),
    ("post", f"/alerts/{ALERT}/messages", {"actor": "member", "text": "hola"}, CREW_VIEW),
    ("post", f"/alerts/{ALERT}/resolve", {"actor": "responder"}, ACK),
    ("get", "/environments/mars/alerts?view=ground", None, {"responder", "psych", "admin"}),
    ("get", "/members/1/tasks", None, GAME),
    ("get", "/members/1/game", None, GAME),
    (
        "post",
        "/members/1/tasks/t_2026-11-14_1_checkin/complete",
        lambda: {"id": str(uuid.uuid4()), "completed_at": "2026-11-14T10:00:00Z"},
        {"member", "admin"},
    ),
    ("get", "/environments/mars/leaderboard", None, GAME),
    ("get", "/link?env=mars", None, EVERYONE),
    ("get", "/link/messages?env=mars", None, EVERYONE),
    ("get", "/events", None, ADMIN),
    ("get", "/devices", None, ADMIN),
    ("get", "/control/overview", None, ADMIN),
    ("post", "/control/liveness/pause", {"env_id": "mars", "paused": False}, ADMIN),
    ("post", "/demo/link", {"env": "mars", "state": "online"}, ADMIN),
    ("post", "/demo/fast-forward", {"seconds": 1}, ADMIN),
    ("post", "/demo/scenarios/nope", None, ADMIN),  # admin → 404, el resto → 403
    ("get", "/users", None, ADMIN),
    (
        "post",
        "/users",
        {"username": "n", "display_name": "N", "role": "medic", "password": "x"},
        ADMIN,
    ),
]

CASES = [
    pytest.param(role, method, path, body, role in allowed, id=f"{role}-{method}-{path}")
    for method, path, body, allowed in MATRIX
    for role in ROLES
]


@pytest.fixture
def headers(client):
    cache: dict[str, dict[str, str]] = {}

    def get(role: str) -> dict[str, str]:
        if role not in cache:
            cache[role] = login_headers(client, *USERS[role])
        return cache[role]

    return get


@pytest.fixture
def alert_id(client):
    """Una alerta warning del member 1, recién creada (admin)."""
    r = client.post(f"{API}/members/1/alerts", json=_warning())
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.mark.parametrize(("role", "method", "path", "body", "allowed"), CASES)
def test_matrix(client, headers, alert_id, role, method, path, body, allowed):
    body = body() if callable(body) else body
    resp = client.request(
        method, API + path.replace(ALERT, alert_id), json=body, headers=headers(role)
    )
    if allowed:
        # 404 (escenario inexistente), 409 (alerta resuelta) o 422 (último nivel) son
        # respuestas de negocio: lo que importa es que no sea 401/403.
        assert resp.status_code not in (401, 403), resp.text
    else:
        assert resp.status_code == 403, resp.text


@pytest.mark.parametrize(("method", "path", "body", "allowed"), [m[:2] + m[2:] for m in MATRIX])
def test_matrix_without_session_is_401(anon_client, alert_id, method, path, body, allowed):
    body = body() if callable(body) else body
    resp = anon_client.request(method, API + path.replace(ALERT, alert_id), json=body)
    assert resp.status_code == 401, resp.text


# ── Propiedad del dato ──────────────────────────────────────────────


@pytest.mark.parametrize(
    "path",
    ["/members/2", "/members/2/assessment", "/members/2/measurements", "/members/2/alerts"],
)
def test_member_cannot_read_another_member(client, headers, path):
    assert client.get(API + path, headers=headers("member")).status_code == 403


def test_member_cannot_write_for_another_member(client, headers):
    h = headers("member")
    assert (
        client.post(f"{API}/members/2/measurements", json=_measurement(), headers=h).status_code
        == 403
    )
    assert (
        client.post(
            f"{API}/members/2/heartbeat", json={"device_id": str(uuid.uuid4())}, headers=h
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"{API}/members/2/privacy", json={"share_behavioral_details": True}, headers=h
        ).status_code
        == 403
    )


def test_member_can_read_own_data(client, headers):
    assert client.get(f"{API}/members/1/assessment", headers=headers("member")).status_code == 200


@pytest.mark.parametrize("role", ["medic", "commander", "responder", "psych"])
def test_staff_cannot_cross_environments(client, headers, role):
    h = headers(role)
    iss_member = 3  # Dra. Lindqvist (ISS)
    assert client.get(f"{API}/members/{iss_member}/assessment", headers=h).status_code == 403
    assert client.get(f"{API}/link?env=iss", headers=h).status_code == 403


def test_staff_env_endpoints_are_scoped(client, headers):
    assert (
        client.get(f"{API}/environments/iss/members", headers=headers("medic")).status_code == 403
    )
    assert (
        client.get(f"{API}/environments/iss/alerts", headers=headers("responder")).status_code
        == 403
    )
    assert (
        client.get(f"{API}/environments/iss/leaderboard", headers=headers("member")).status_code
        == 403
    )


def test_admin_is_global(client):
    assert client.get(f"{API}/members/3/assessment").status_code == 200
    assert client.get(f"{API}/environments/iss/members").status_code == 200


def test_alert_actions_check_the_alert_owner(client, headers):
    """vega no puede escalar la alerta de otro member (ni un medic de otro entorno)."""
    r = client.post(f"{API}/members/2/alerts", json=_warning())
    other = r.json()["id"]
    assert (
        client.post(
            f"{API}/alerts/{other}/escalate", json={}, headers=headers("member")
        ).status_code
        == 403
    )
    medic_iss = login_headers(client, "medic-iss", "ruok-iss")
    assert (
        client.post(
            f"{API}/alerts/{other}/ack", json={"actor": "responder"}, headers=medic_iss
        ).status_code
        == 403
    )


# ── SOS sin sesión ─────────────────────────────────────────────────


def _sos():
    return {"id": str(uuid.uuid4()), "category": "emergency", "severity": "emergency"}


def test_sos_without_token_is_accepted_unauthenticated(anon_client):
    r = anon_client.post(f"{API}/members/1/alerts", json=_sos())
    assert r.status_code == 200, r.text
    assert r.json()["authenticated"] is False
    assert r.json()["created_by_user_id"] is None


def test_sos_with_expired_or_garbage_token_still_works(anon_client):
    h = {"Authorization": "Bearer caducado"}
    r = anon_client.post(f"{API}/members/1/alerts", json=_sos(), headers=h)
    assert r.status_code == 200
    assert r.json()["authenticated"] is False


def test_sos_with_session_is_authenticated(client, headers):
    r = client.post(f"{API}/members/1/alerts", json=_sos(), headers=headers("member"))
    assert r.status_code == 200
    body = r.json()
    assert body["authenticated"] is True
    with Session(engine) as s:
        vega = s.exec(select(models.UserAccount).where(models.UserAccount.username == "vega")).one()
    assert body["created_by_user_id"] == vega.id


def test_sos_with_token_without_permission_is_still_accepted(client, headers):
    """El SOS nunca se rechaza por permisos: queda como no autenticado."""
    r = client.post(f"{API}/members/1/alerts", json=_sos(), headers=headers("responder"))
    assert r.status_code == 200
    assert r.json()["authenticated"] is False


def test_non_emergency_alert_without_token_is_401(anon_client):
    assert anon_client.post(f"{API}/members/1/alerts", json=_warning()).status_code == 401


def test_sos_with_malformed_device_id_is_not_422(anon_client):
    h = {"X-Device-Id": "esto-no-es-un-uuid"}
    assert anon_client.post(f"{API}/members/1/alerts", json=_sos(), headers=h).status_code == 200


# ── Públicos ────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "path",
    [
        "/health",
        "/system/network-info",
        "/auth/demo-users",
        "/environments",
        "/environments/mars",
        "/indicators",
        "/systems",
        "/interventions",
    ],
)
def test_public_endpoints(anon_client, path):
    assert anon_client.get(API + path).status_code == 200


# ── SSE ─────────────────────────────────────────────────────────────


def test_events_stream_needs_token_in_query(anon_client, client, headers):
    assert anon_client.get(f"{API}/events/stream").status_code == 401
    token = headers("member")["Authorization"].removeprefix("Bearer ")
    r = anon_client.get(f"{API}/events/stream", params={"token": token})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/event-stream")


# ── Privacidad conductual por rol ───────────────────────────────────


@pytest.fixture
def private_vega(client, headers):
    """vega no comparte sus detalles conductuales y no tiene emergencias abiertas."""
    with Session(engine) as s:
        for a in s.exec(select(models.Alert).where(models.Alert.member_id == 1)).all():
            a.status = "resolved"
            s.add(a)
        s.commit()
    h = headers("member")
    client.patch(f"{API}/members/1/privacy", json={"share_behavioral_details": False}, headers=h)
    yield
    client.patch(f"{API}/members/1/privacy", json={"share_behavioral_details": False}, headers=h)


@pytest.mark.parametrize(
    ("role", "visible"),
    [
        ("member", True),  # el propio member
        ("psych", True),
        ("admin", True),
        ("medic", False),  # solo si comparte o hay emergencia
        ("responder", False),
        ("commander", False),  # nunca: solo el agregado
    ],
)
def test_behavioral_details_by_role(client, headers, private_vega, role, visible):
    a = client.get(f"{API}/members/1/assessment", headers=headers(role)).json()
    assert a["behavioral"]["details_visible"] is visible


def test_commander_never_sees_details_even_if_shared(client, headers, private_vega):
    client.patch(
        f"{API}/members/1/privacy",
        json={"share_behavioral_details": True},
        headers=headers("member"),
    )
    a = client.get(f"{API}/members/1/assessment", headers=headers("commander")).json()
    assert a["behavioral"]["details_visible"] is False
    a = client.get(f"{API}/members/1/assessment", headers=headers("medic")).json()
    assert a["behavioral"]["details_visible"] is True


# ── Demo ───────────────────────────────────────────────────────────


def test_demo_reset_keeps_sessions_valid(client, headers):
    h = headers("member")
    assert client.post(f"{API}/demo/reset").status_code == 200
    assert client.get(f"{API}/auth/me", headers=h).status_code == 200
    assert accounts.demo_mode()
