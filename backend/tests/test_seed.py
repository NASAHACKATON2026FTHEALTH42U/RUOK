"""BE-07: seed determinista, escenarios de demo y endpoints /demo/reset y /demo/scenarios."""

import uuid
from collections import Counter
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session, select

from app import clock, models, seed
from app.db import init_db, make_engine
from app.schemas.common import Liveness, Status
from app.services import catalog, environments, measurements
from app.services.liveness import combine_overall, compute_liveness
from app.services.member_assessment import build_assessment

FROZEN = datetime(2026, 11, 15, 9, 30, tzinfo=UTC)


@pytest.fixture
def frozen_clock(monkeypatch):
    monkeypatch.setattr(clock, "now", lambda: FROZEN)
    return FROZEN


@pytest.fixture
def session(tmp_path, frozen_clock):
    """BD propia y ya sembrada, con el reloj congelado."""
    engine = make_engine(f"sqlite:///{tmp_path}/seed.db")
    init_db(engine)
    with Session(engine) as s:
        seed.seed(s)
        yield s
    engine.dispose()


def assess(session: Session, member_id: int):
    """Assessment real del member (el endpoint aún es stub de BE-11) + liveness."""
    member = session.get(models.Member, member_id)
    env = environments.get_environment(member.env_id)
    series = {
        ind: measurements.list_series(session, member_id, ind) for ind in env.indicators
    }
    result = build_assessment(
        member_id=member_id,
        env=env,
        indicators=catalog.list_indicators(),
        systems=catalog.list_systems(),
        series=series,
        now=clock.now(),
    )
    live = compute_liveness(member.last_seen_at, clock.now(), env.liveness, member.last_activity)
    systems = {s.system_id: s.status for s in result.systems}
    return result, systems, live, combine_overall(result.overall_status, live)


def snapshot(session: Session):
    rows = session.exec(select(models.Measurement).order_by(models.Measurement.id)).all()
    return [(r.id, r.member_id, r.indicator_id, r.value, r.taken_at) for r in rows]


# ── Seed ─────────────────────────────────────────────────────────────


def test_members_per_environment(session):
    by_env = Counter(m.env_id for m in session.exec(select(models.Member)).all())
    assert set(by_env) == {e.id for e in environments.list_environments()}
    assert all(3 <= n <= 4 for n in by_env.values())


def test_first_members_match_stubs(session):
    expected = {1: ("mars", "Cmdr. Vega"), 2: ("mars", "Ing. Okafor"), 3: ("iss", "Dra. Lindqvist")}
    for member_id, (env_id, name) in expected.items():
        m = session.get(models.Member, member_id)
        assert (m.env_id, m.name) == (env_id, name)


def test_thirty_days_of_every_active_indicator(session):
    for m in session.exec(select(models.Member)).all():
        env = environments.get_environment(m.env_id)
        for ind_id in env.indicators:
            rows = measurements.list_series(session, m.id, ind_id)
            expected = 5 if ind_id in seed.WEEKLY else seed.DAYS
            assert len(rows) == expected, (m.id, ind_id)
            span = rows[-1].taken_at - rows[0].taken_at
            assert span >= timedelta(days=27), (m.id, ind_id)
            assert FROZEN - rows[-1].taken_at < timedelta(hours=7)  # dato reciente


def test_values_are_valid_for_the_catalog(session):
    for r in session.exec(select(models.Measurement)).all():
        ind = catalog.get_indicator(r.indicator_id)
        assert ind.input.min <= r.value <= ind.input.max, r.indicator_id
        assert r.unit == ind.unit
        uuid.UUID(r.id)


def test_radiation_dose_only_grows(session):
    values = [r.value for r in measurements.list_series(session, 1, "radiation_dose")]
    assert values == sorted(values)


def test_base_seed_is_never_critical(session):
    for m in session.exec(select(models.Member)).all():
        result, systems, live, overall = assess(session, m.id)
        assert live == Liveness.active
        assert Status.critical not in systems.values(), (m.id, systems)
        assert overall != Status.critical


def test_reset_is_deterministic(tmp_path, frozen_clock):
    """Criterio de aceptación: dos resets dan los mismos datos."""
    snaps = []
    for name in ("a", "b"):
        engine = make_engine(f"sqlite:///{tmp_path}/{name}.db")
        init_db(engine)
        with Session(engine) as s:
            seed.reset(s)
            seed.reset(s)  # también es estable al repetirlo sobre la misma BD
            snaps.append(snapshot(s))
        engine.dispose()
    assert snaps[0] == snaps[1]
    assert len(snaps[0]) > 3000


def test_reset_wipes_added_data(session):
    before = snapshot(session)
    session.add(models.Measurement(
        id=str(uuid.uuid4()), member_id=1, indicator_id="heart_rate", value=70, unit="lpm",
        taken_at=FROZEN,
    ))
    session.get(models.Member, 1).share_behavioral_details = True
    session.commit()
    seed.reset(session)
    assert snapshot(session) == before
    assert session.get(models.Member, 1).share_behavioral_details is False


def test_ensure_seeded_only_once(session):
    assert seed.ensure_seeded(session) is False


# ── Escenarios ───────────────────────────────────────────────────────


def test_mars_sleep_bp(session):
    """Paso 3 del guion: cardio en ámbar y neuro-conductual en rojo."""
    seed.apply_scenario(session, "mars_sleep_bp")
    _, systems, _, _ = assess(session, seed.VEGA)
    assert systems["cardiovascular"] == Status.warning
    assert systems["neuro_behavioral"] == Status.critical


def test_eva_no_contact(session):
    """Paso 6: EVA sin señal hace 3 min → lost → estado global critical."""
    seed.apply_scenario(session, "eva_no_contact")
    _, _, live, overall = assess(session, seed.VEGA)
    assert live == Liveness.lost
    assert overall == Status.critical


def test_geriatric_fall_risk(session):
    """Paso 8: hidratación, sueño y tensión baja de un residente."""
    seed.apply_scenario(session, "geriatric_fall_risk")
    member = session.get(models.Member, seed.FALL_RISK_RESIDENT)
    assert member.env_id == "geriatric"
    _, systems, _, overall = assess(session, member.id)
    assert systems["metabolic"] == Status.warning
    assert systems["neuro_behavioral"] == Status.critical
    assert systems["cardiovascular"] == Status.warning
    assert overall == Status.critical


def test_scenario_series_ends_with_scenario_values(session):
    """Los últimos días son los del escenario, sin puntos del seed intercalados."""
    seed.apply_scenario(session, "mars_sleep_bp")
    sleep = [r.value for r in measurements.list_series(session, seed.VEGA, "sleep_hours")]
    assert sleep[-5:] == [5.5, 5, 4.5, 4, 3.5]
    assert len(sleep) == seed.DAYS  # 25 del seed + 5 del escenario


def test_scenario_keeps_real_measurements(session):
    real = models.Measurement(
        id=str(uuid.uuid4()), member_id=seed.VEGA, indicator_id="sleep_hours", value=7,
        unit="h", taken_at=FROZEN - timedelta(hours=1),
    )
    session.add(real)
    session.commit()
    seed.apply_scenario(session, "mars_sleep_bp")
    assert session.get(models.Measurement, real.id) is not None


@pytest.mark.parametrize("name", list(seed.SCENARIOS))
def test_scenarios_are_idempotent(session, name):
    seed.apply_scenario(session, name)
    first = snapshot(session)
    seed.apply_scenario(session, name)
    assert snapshot(session) == first


def test_scenario_is_saved_in_app_state(session):
    seed.apply_scenario(session, "mars_sleep_bp")
    assert session.get(models.AppState, "scenario").value == "mars_sleep_bp"


# ── API ──────────────────────────────────────────────────────────────


def test_api_reset(client):
    client.post("/api/v1/members/1/measurements", json={"measurements": [{
        "id": str(uuid.uuid4()), "indicator_id": "heart_rate", "value": 70,
        "taken_at": "2026-11-14T10:00:00Z",
    }]})
    r = client.post("/api/v1/demo/reset")
    assert r.status_code == 200
    assert "20 members" in r.json()["detail"]
    hr = client.get("/api/v1/members/1/measurements", params={"indicator_id": "heart_rate"})
    assert len(hr.json()) == seed.DAYS


def test_api_scenario(client):
    client.post("/api/v1/demo/reset")
    r = client.post("/api/v1/demo/scenarios/mars_sleep_bp")
    assert r.status_code == 200
    sleep = client.get("/api/v1/members/1/measurements", params={"indicator_id": "sleep_hours"})
    assert sleep.json()[-1]["value"] == 3.5


def test_api_unknown_scenario_is_404(client):
    assert client.post("/api/v1/demo/scenarios/nope").status_code == 404
