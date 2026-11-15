"""FS-09: GET /members/{id}/forecast (contrato, permisos, privacidad conductual y reloj).

El modelo se prueba en test_forecast.py; aquí, el endpoint con los datos del seed.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select

from app import clock, models
from app.db import engine
from app.main import app
from app.schemas import Forecast
from app.services import behavioral
from tests.conftest import login_headers

API = "/api/v1"
VEGA = 1  # member de Marte (seed); su usuario es `vega`
MARS_PASSWORD = "ruok-mars"
PRIVATE = behavioral.load_rules()["private_indicators"]


@pytest.fixture(scope="module")
def api():
    """Cliente admin para todo el módulo, con el seed recién cargado (la BD es compartida)."""
    with TestClient(app) as c:
        c.headers.update(login_headers(c, "admin", "ruok-admin"))
        assert c.post(f"{API}/demo/reset").status_code == 200
        yield c
        c.post(f"{API}/demo/reset")  # deja el seed limpio para los módulos siguientes


@pytest.fixture
def reseed(api):
    """Para los tests que cambian datos o el reloj: vuelve al seed al terminar."""
    yield
    assert api.post(f"{API}/demo/reset").status_code == 200


@pytest.fixture(scope="module")
def auth(api):
    """Cabecera de sesión de un usuario demo (los tokens sobreviven al reset)."""
    cache: dict[str, dict[str, str]] = {}

    def get(username: str, password: str = MARS_PASSWORD) -> dict[str, str]:
        if username not in cache:
            cache[username] = login_headers(api, username, password)
        return cache[username]

    return get


def forecast(api, indicator_id="heart_rate", member_id=VEGA, headers=None, **query):
    return api.get(
        f"{API}/members/{member_id}/forecast",
        params={"indicator_id": indicator_id, **query},
        headers=headers,
    )


def when(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def count(*tables) -> list[int]:
    with Session(engine) as s:
        return [s.exec(select(func.count()).select_from(t)).one() for t in tables]


# ── Contrato ────────────────────────────────────────────────────────


def test_ok_forecast_has_the_documented_shape(api):
    r = forecast(api)
    assert r.status_code == 200, r.text
    data = r.json()
    Forecast.model_validate(data)

    assert data["member_id"] == VEGA
    assert data["indicator_id"] == "heart_rate"
    assert data["unit"] == "lpm"
    assert data["status"] == "ok"
    assert data["method"] == "holt_damped"
    assert data["horizon_days"] == 7
    assert data["step_days"] == 1  # el seed mide a diario
    assert data["history_days"] >= 7
    assert data["current_status"] == "normal"  # el seed está dentro del rango normal
    assert data["change"] is None
    assert data["last_value_unusual"] is False
    assert data["backtest_mae"] is not None and data["backtest_mae"] >= 0

    points = data["points"]
    assert len(points) == 7
    generated = when(data["generated_at"])
    dates = [when(p["at"]) for p in points]
    assert dates == sorted(dates)
    assert generated < dates[0] and dates[-1] <= generated + timedelta(days=7)
    assert all(b - a == timedelta(days=1) for a, b in zip(dates, dates[1:], strict=False))
    for p in points:
        assert p["low"] <= p["value"] <= p["high"]
        assert p["status"] == "normal"


@pytest.mark.parametrize("days", [1, 3, 14])
def test_horizon_days_sets_the_number_of_daily_points(api, days):
    data = forecast(api, horizon_days=days).json()
    assert data["horizon_days"] == days
    assert len(data["points"]) == days


def test_weekly_indicator_without_a_week_of_points_is_insufficient(api):
    data = forecast(api, "radiation_dose").json()  # semanal: 5 puntos en 30 días
    assert data["status"] == "insufficient_data"
    assert data["points"] == [] and data["change"] is None and data["backtest_mae"] is None
    assert data["current_status"] == "normal"  # el último valor sigue vigente


def test_indicator_without_measurements_is_insufficient_and_unknown(api):
    data = forecast(api, "glucose").json()  # Marte no mide la glucosa
    assert data["status"] == "insufficient_data"
    assert data["history_days"] == 0
    assert data["current_status"] == "unknown"
    assert data["points"] == []


@pytest.mark.parametrize(
    ("member_id", "query", "status"),
    [
        (VEGA, {"indicator_id": "nope"}, 404),  # indicador desconocido
        (999, {"indicator_id": "heart_rate"}, 404),  # member desconocido
        (VEGA, {}, 422),  # falta indicator_id
        (VEGA, {"indicator_id": "Heart-Rate"}, 422),  # no es un slug
        (VEGA, {"indicator_id": "heart_rate", "horizon_days": 0}, 422),
        (VEGA, {"indicator_id": "heart_rate", "horizon_days": 15}, 422),
        (VEGA, {"indicator_id": "heart_rate", "horizon_days": "abc"}, 422),
    ],
)
def test_invalid_requests(api, member_id, query, status):
    r = api.get(f"{API}/members/{member_id}/forecast", params=query)
    assert r.status_code == status, r.text


# ── Permisos (los del historial) ────────────────────────────────────


def test_needs_a_session():
    anon = TestClient(app)  # sin lifespan: la app ya está arrancada por `api`
    r = anon.get(f"{API}/members/{VEGA}/forecast", params={"indicator_id": "heart_rate"})
    assert r.status_code == 401


@pytest.mark.parametrize(
    "username", ["vega", "medic-mars", "commander-mars", "responder-mars", "psych-mars"]
)
def test_crew_and_ground_of_the_environment_can_read_it(api, auth, username):
    assert forecast(api, headers=auth(username)).status_code == 200


def test_a_member_cannot_read_another_member(api, auth):
    r = forecast(api, headers=auth("okafor"))
    assert r.status_code == 403
    # El permiso va antes que el catálogo: tampoco se distingue un indicador que no existe.
    assert forecast(api, "nope", headers=auth("okafor")).status_code == 403


def test_staff_of_another_environment_cannot_read_it(api, auth):
    assert forecast(api, headers=auth("medic-iss", "ruok-iss")).status_code == 403


# ── Privacidad conductual ───────────────────────────────────────────


@pytest.mark.parametrize(
    ("username", "allowed"),
    [
        ("vega", True),  # el propio member
        ("psych-mars", True),
        ("medic-mars", False),  # solo si comparte o hay una emergencia
        ("responder-mars", False),
        ("commander-mars", False),  # nunca
    ],
)
def test_private_indicator_needs_permission_to_see_behavioral_details(api, auth, username, allowed):
    r = forecast(api, "mood", headers=auth(username))
    assert r.status_code == (200 if allowed else 403)
    if not allowed:
        # Nada de la previsión en el error: ni valores ni estado.
        assert r.json() == {"detail": "Los detalles conductuales de este member son privados"}


def test_admin_sees_private_forecasts(api):
    assert forecast(api, "mood").status_code == 200


@pytest.mark.parametrize("indicator_id", PRIVATE)
def test_every_private_indicator_is_protected(api, auth, indicator_id):
    assert forecast(api, indicator_id, headers=auth("medic-mars")).status_code == 403


def test_non_private_indicator_of_the_same_system_is_visible(api, auth):
    # sleep_hours es neuro-conductual, pero no está en `private_indicators`.
    assert forecast(api, "sleep_hours", headers=auth("medic-mars")).status_code == 200


def test_sharing_opens_it_to_medic_and_responder_but_never_to_commander(api, auth, reseed):
    share = api.patch(
        f"{API}/members/{VEGA}/privacy",
        json={"share_behavioral_details": True},
        headers=auth("vega"),
    )
    assert share.status_code == 200
    assert forecast(api, "mood", headers=auth("medic-mars")).status_code == 200
    assert forecast(api, "mood", headers=auth("responder-mars")).status_code == 200
    assert forecast(api, "mood", headers=auth("commander-mars")).status_code == 403


def test_an_open_emergency_opens_it_until_it_is_resolved(api, auth, reseed):
    alert = {"id": str(uuid.uuid4()), "category": "emergency", "severity": "emergency"}
    r = api.post(f"{API}/members/{VEGA}/alerts", json=alert, headers=auth("vega"))
    assert r.status_code == 200, r.text
    assert forecast(api, "mood", headers=auth("medic-mars")).status_code == 200
    assert forecast(api, "mood", headers=auth("commander-mars")).status_code == 403

    resolved = api.post(f"{API}/alerts/{alert['id']}/resolve", json={"actor": "responder"})
    assert resolved.status_code == 200, resolved.text
    assert forecast(api, "mood", headers=auth("medic-mars")).status_code == 403


# ── Escenario de la demo ────────────────────────────────────────────


def test_demo_scenario_projects_the_rising_pressure_into_critical(api, auth, reseed):
    assert api.post(f"{API}/demo/scenarios/mars_sleep_bp").status_code == 200

    bp = forecast(api, "bp_systolic", headers=auth("vega")).json()
    assert bp["status"] == "ok"
    assert bp["current_status"] == "warning"  # 137 mmHg: en Marte, atención es 130–140
    values = [p["value"] for p in bp["points"]]
    assert values == sorted(values) and values[0] > 137  # sigue subiendo
    assert bp["change"]["status"] == "critical"
    assert 1 <= bp["change"]["in_days"] <= 7
    first_other = next(p for p in bp["points"] if p["status"] != "warning")
    assert bp["change"]["at"] == first_other["at"]
    assert first_other["value"] > 140  # el límite de atención de Marte (threshold_overrides)

    assert bp["last_value_unusual"] is False  # la última medición continúa la racha

    sleep = forecast(api, "sleep_hours", headers=auth("vega")).json()
    assert sleep["current_status"] == "critical"  # 3,5 h
    assert sleep["change"] is None  # sigue en crítico: no hay cambio que anunciar
    assert all(p["status"] == "critical" for p in sleep["points"])


# ── Informativa: no escribe nada ────────────────────────────────────


def test_forecast_is_read_only(api, auth, reseed):
    assert api.post(f"{API}/demo/scenarios/mars_sleep_bp").status_code == 200
    tables = (models.Alert, models.AlertEvent, models.EventLog, models.Measurement, models.Task)
    assessment = api.get(f"{API}/members/{VEGA}/assessment").json()
    before = count(*tables)

    for indicator_id in ("bp_systolic", "sleep_hours", "mood", "radiation_dose"):
        assert forecast(api, indicator_id, headers=auth("vega")).status_code == 200

    assert count(*tables) == before
    after = api.get(f"{API}/members/{VEGA}/assessment").json()
    assessment.pop("generated_at")
    after.pop("generated_at")
    assert after == assessment


# ── Reloj de la demo ────────────────────────────────────────────────


def test_follows_the_demo_clock(api, reseed):
    fresh = forecast(api).json()
    assert fresh["status"] == "ok"
    assert abs(when(fresh["generated_at"]) - clock.now()) < timedelta(minutes=1)

    assert api.post(f"{API}/demo/fast-forward", json={"seconds": 3 * 86400}).status_code == 200
    later = forecast(api).json()
    assert when(later["generated_at"]) - when(fresh["generated_at"]) >= timedelta(days=3)
    # Tres días sin medir: el dato ha caducado y no se prevé nada (sin datos = desconocido).
    assert later["status"] == "stale"
    assert later["current_status"] == "unknown"
    assert later["points"] == [] and later["change"] is None


# ── Última medición sin confirmar ───────────────────────────────────


def test_one_odd_reading_is_flagged_and_a_second_one_confirms_it(api, auth, reseed):
    def post_bp(value: float, minutes_ago: int) -> None:
        taken_at = (clock.now() - timedelta(minutes=minutes_ago)).isoformat()
        item = {
            "id": str(uuid.uuid4()),
            "indicator_id": "bp_systolic",
            "value": value,
            "taken_at": taken_at.replace("+00:00", "Z"),
        }
        r = api.post(
            f"{API}/members/{VEGA}/measurements",
            json={"measurements": [item]},
            headers=auth("vega"),
        )
        assert r.status_code == 200, r.text

    def next_day() -> None:
        r = api.post(f"{API}/demo/fast-forward", json={"seconds": 86400})
        assert r.status_code == 200

    usual = forecast(api, "bp_systolic").json()["points"][0]["value"]

    next_day()
    post_bp(150, minutes_ago=2)  # una sola lectura crítica, lejos de lo habitual
    odd = forecast(api, "bp_systolic").json()
    assert odd["current_status"] == "critical"
    assert odd["last_value_unusual"] is True
    assert abs(odd["points"][0]["value"] - usual) < 10  # la previsión apenas se mueve

    next_day()
    post_bp(152, minutes_ago=2)  # al día siguiente se repite: ya no es un valor suelto
    confirmed = forecast(api, "bp_systolic").json()
    assert confirmed["last_value_unusual"] is False
    assert confirmed["points"][0]["value"] > 140
    assert confirmed["change"] is None  # sigue en crítico
