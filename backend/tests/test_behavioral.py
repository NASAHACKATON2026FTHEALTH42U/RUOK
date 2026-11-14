"""BE-20: reglas conductuales frente a la línea base y privacidad de los detalles."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, delete

from app import clock, models
from app.db import engine
from app.schemas.common import Status
from app.services import behavioral, catalog, environments
from app.services.member_assessment import build_assessment

NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)
API = "/api/v1"

IND = {
    "mood": {
        "id": "mood", "unit": "1-5", "system_id": "neuro_behavioral", "max_age_s": 129600,
        "ranges": {"normal": [3, 5], "warning": [1.5, 2.9], "critical_low": 1.5},
        "higher_is_worse": False,
    },
    "loneliness": {
        "id": "loneliness", "unit": "1-5", "system_id": "neuro_behavioral", "max_age_s": 129600,
        "ranges": {"normal": [1, 3], "warning": [3.1, 4.5], "critical_high": 4.5},
        "higher_is_worse": True,
    },
    "pvt_mean_rt_ms": {
        "id": "pvt_mean_rt_ms", "unit": "ms", "system_id": "neuro_behavioral",
        "max_age_s": 259200,
        "ranges": {"normal": [100, 354], "warning": [355, 500], "critical_high": 500},
        "higher_is_worse": True,
    },
    "sleep_hours": {
        "id": "sleep_hours", "unit": "h", "system_id": "neuro_behavioral", "max_age_s": 129600,
        "ranges": {"normal": [7, 10], "warning": [4, 6.9], "critical_low": 4},
        "higher_is_worse": False,
    },
}
SYSTEMS = [{"id": "neuro_behavioral", "indicators": list(IND)}]
ENV = {
    "id": "test", "comm_delay_s": 0, "escalation_ladder": ["self", "crew", "ground"],
    "external_from_level": 2,
    "indicators": list(IND),
}


def daily(values, hour=9):
    """Una medición al día; la última, hoy (NOW). ``values`` de más antigua a más reciente."""
    n = len(values)
    return [
        (NOW.replace(hour=hour) - timedelta(days=n - 1 - i) - timedelta(hours=1), float(v))
        for i, v in enumerate(values)
    ]


def fired_ids(series, indicators=IND, now=NOW):
    return {f.rule_id for f in behavioral.evaluate_rules(series, indicators, now)}


# --- Regla: ánimo bajo frente a la línea base ----------------------------------


def test_low_mood_5_days_below_baseline_fires():
    # Línea base 5 (primeros 7 días); 5 días seguidos a 3,5 (< 5 - 1), aún "normal" por rango.
    series = {"mood": daily([5] * 9 + [3.5] * 5)}
    assert fired_ids(series) == {"low_mood"}


def test_low_mood_4_days_is_not_enough():
    assert fired_ids({"mood": daily([5] * 10 + [3.5] * 4)}) == set()


def test_low_mood_gap_breaks_the_streak():
    series = daily([5] * 9 + [3.5] * 6)
    del series[-3]  # falta un día en medio de la racha
    assert fired_ids({"mood": series}) == set()


def test_low_mood_needs_a_baseline():
    # Menos de 7 días de historia: no hay línea base, no se afirma nada.
    assert fired_ids({"mood": daily([3.5] * 5)}) == set()


def test_low_mood_with_stale_data_does_not_fire():
    later = NOW + timedelta(days=3)  # el último dato ya ha caducado (max_age 36 h)
    assert fired_ids({"mood": daily([5] * 9 + [3.5] * 5)}, now=later) == set()


# --- Regla: soledad en aumento ---------------------------------------------------


def test_rising_loneliness_5_days_fires():
    series = {"loneliness": daily([1, 1, 1, 1.2, 1.5, 1.8, 2.1, 2.4])}
    assert fired_ids(series) == {"rising_loneliness"}


def test_loneliness_rising_only_4_days_does_not_fire():
    assert fired_ids({"loneliness": daily([1, 1, 1, 1, 1.5, 1.8, 2.1, 2.4])}) == set()


# --- Regla: PVT peor que la línea base junto con mal sueño -------------------------


def test_pvt_worse_with_poor_sleep_fires():
    series = {
        "pvt_mean_rt_ms": daily([250] * 8 + [320]),  # +28 % sobre la línea base 250
        "sleep_hours": daily([8] * 8 + [5]),
    }
    assert fired_ids(series) == {"pvt_with_poor_sleep"}


@pytest.mark.parametrize(
    ("pvt_last", "sleep_last"),
    [(320, 7.5), (290, 5)],  # buen sueño / PVT solo un 16 % peor
)
def test_pvt_rule_needs_both_conditions(pvt_last, sleep_last):
    series = {
        "pvt_mean_rt_ms": daily([250] * 8 + [pvt_last]),
        "sleep_hours": daily([8] * 8 + [sleep_last]),
    }
    assert fired_ids(series) == set()


def test_rules_of_inactive_indicators_are_not_evaluated():
    series = {"mood": daily([5] * 9 + [3.5] * 5)}
    assert fired_ids(series, indicators={"sleep_hours": IND["sleep_hours"]}) == set()


# --- Efecto en el assessment ------------------------------------------------------


def neuro(series):
    a = build_assessment(member_id=1, env=ENV, indicators=IND.values(), systems=SYSTEMS,
                         series=series, now=NOW)
    return next(s for s in a.systems if s.system_id == "neuro_behavioral")


def test_one_rule_raises_its_indicator_to_warning():
    system = neuro({"mood": daily([5] * 9 + [3.5] * 5)})
    mood = next(i for i in system.indicators if i.indicator_id == "mood")
    assert mood.status == Status.warning
    # El resto no tiene datos (unknown), así que el peor del sistema es warning.
    assert system.status == Status.warning


def test_two_rules_make_the_system_critical():
    system = neuro({
        "mood": daily([5] * 9 + [3.5] * 5),
        "loneliness": daily([1, 1, 1, 1.2, 1.5, 1.8, 2.1, 2.4]),
    })
    assert system.status == Status.critical
    assert system.escalation.target_role == "crew"  # critical → nivel 1 (a bordo)


def test_without_rules_the_status_is_unchanged():
    system = neuro({"mood": daily([4] * 14), "sleep_hours": daily([8] * 14)})
    mood = next(i for i in system.indicators if i.indicator_id == "mood")
    assert mood.status == Status.normal


# --- Visibilidad (docs/auth-and-roles.md, "Detalles conductuales") ------------------


@pytest.mark.parametrize(
    ("viewer_role", "owner", "share", "emergency", "expected"),
    [
        (None, False, False, False, False),  # sin auth todavía: privado por defecto
        (None, False, True, False, True),
        (None, False, False, True, True),
        ("member", True, False, False, True),  # el propio member
        ("psych", False, False, False, True),
        ("admin", False, False, False, True),
        ("medic", False, False, False, False),
        ("medic", False, True, False, True),
        ("responder", False, False, True, True),
        ("commander", False, True, True, False),  # solo agregado
        ("family", False, True, False, False),
    ],
)
def test_details_visible_matrix(viewer_role, owner, share, emergency, expected):
    assert behavioral.details_visible(
        share_behavioral_details=share,
        emergency_open=emergency,
        viewer_role=viewer_role,
        viewer_is_owner=owner,
    ) is expected


def test_redact_hides_private_indicators_but_keeps_aggregate():
    a = build_assessment(
        member_id=1, env=ENV, indicators=IND.values(), systems=SYSTEMS, now=NOW,
        series={"mood": daily([5] * 9 + [3.5] * 5), "sleep_hours": daily([8] * 14)},
    )
    hidden = behavioral.redact(a)
    system = hidden.systems[0]
    assert [i.indicator_id for i in system.indicators] == ["sleep_hours"]
    assert system.status == Status.warning  # el semáforo agregado sigue
    assert hidden.behavioral.status == Status.warning
    # No modifica el original (lo usan las alertas).
    assert len(a.systems[0].indicators) == len(IND)

    a.behavioral.details_visible = True
    assert behavioral.redact(a) is a


# --- Configuración ---------------------------------------------------------------------


def test_rules_config_refers_to_real_indicators():
    rules = behavioral.load_rules()
    known = {i.id for i in catalog.list_indicators()}
    assert set(rules["private_indicators"]) <= known
    for key in ("low_mood", "rising_loneliness", "pvt_with_poor_sleep"):
        assert rules[key]["indicator_id"] in known
    assert rules["pvt_with_poor_sleep"]["sleep_indicator_id"] in known


@pytest.mark.parametrize("env_id", ["iss", "moon", "mars"])
def test_space_envs_evaluate_checkin_and_pvt(env_id):
    active = set(environments.get_environment(env_id).indicators)
    assert set(behavioral.load_rules()["private_indicators"]) <= active


# --- API: GET /members/{id}/assessment ---------------------------------------------


@pytest.fixture
def vega(client):
    """Cmdr. Vega (member 1, Marte) sin mediciones ni alertas y sin compartir."""
    with Session(engine) as s:
        s.exec(delete(models.AlertEvent))
        s.exec(delete(models.LinkMessage))
        s.exec(delete(models.Alert))
        s.exec(delete(models.Measurement))
        s.commit()
    client.patch(f"{API}/members/1/privacy", json={"share_behavioral_details": False})
    now = clock.now().isoformat().replace("+00:00", "Z")
    body = {"measurements": [
        {"id": str(uuid.uuid4()), "indicator_id": ind, "value": v, "taken_at": now}
        for ind, v in (("mood", 4), ("loneliness", 2), ("sleep_hours", 8))
    ]}
    r = client.post(f"{API}/members/1/measurements", json=body)
    assert r.status_code == 200, r.text
    yield 1
    client.patch(f"{API}/members/1/privacy", json={"share_behavioral_details": False})


def neuro_ids(assessment):
    system = next(s for s in assessment["systems"] if s["system_id"] == "neuro_behavioral")
    return {i["indicator_id"] for i in system["indicators"]}


def test_api_hides_details_when_member_does_not_share(client, vega):
    a = client.get(f"{API}/members/{vega}/assessment").json()
    assert a["behavioral"]["details_visible"] is False
    ids = neuro_ids(a)
    assert "sleep_hours" in ids
    assert not ids & {"mood", "loneliness", "stress", "pvt_mean_rt_ms"}


def test_api_post_measurements_response_is_redacted_too(client, vega):
    item = {"id": str(uuid.uuid4()), "indicator_id": "mood", "value": 3,
            "taken_at": clock.now().isoformat().replace("+00:00", "Z")}
    a = client.post(f"{API}/members/{vega}/measurements",
                    json={"measurements": [item]}).json()["assessment"]
    assert "mood" not in neuro_ids(a)


def test_api_shows_details_when_member_shares(client, vega):
    client.patch(f"{API}/members/{vega}/privacy", json={"share_behavioral_details": True})
    a = client.get(f"{API}/members/{vega}/assessment").json()
    assert a["behavioral"]["details_visible"] is True
    mood = next(i for s in a["systems"] for i in s["indicators"] if i["indicator_id"] == "mood")
    assert mood["last_value"] == 4


def test_api_shows_details_with_open_emergency(client, vega):
    with Session(engine) as s:
        s.add(models.Alert(
            id=str(uuid.uuid4()), member_id=vega, env_id="mars", origin="manual",
            category="emergency", severity="emergency", target_role="crew",
            delivery_mode="realtime",
        ))
        s.commit()
    a = client.get(f"{API}/members/{vega}/assessment").json()
    assert a["behavioral"]["details_visible"] is True
    assert "mood" in neuro_ids(a)
