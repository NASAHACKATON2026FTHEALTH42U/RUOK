"""Tests de BE-11: composición del Assessment completo."""

from datetime import UTC, datetime, timedelta

import pytest

from app.schemas.common import EscalationMode, Liveness, Status, Trend
from app.schemas.members import Assessment
from app.services.environments import get_environment
from app.services.member_assessment import build_assessment

NOW = datetime(2026, 11, 14, 10, 0, tzinfo=UTC)

# Catálogo mínimo con la forma de docs/api-contract.md (BE-04 aún no está en main).
INDICATORS = [
    {
        "id": "bp_systolic",
        "unit": "mmHg",
        "system_id": "cardiovascular",
        "ranges": {
            "normal": [90, 129],
            "warning": [130, 159],
            "critical_low": 80,
            "critical_high": 160,
        },
        "max_age_s": 172800,
        "higher_is_worse": True,
    },
    {
        "id": "heart_rate",
        "unit": "bpm",
        "system_id": "cardiovascular",
        "ranges": {"normal": [50, 100], "warning": [101, 120], "critical_high": 140},
        "max_age_s": 172800,
    },
    {
        "id": "mood",
        "unit": "1-5",
        "system_id": "neuro_behavioral",
        "ranges": {"normal": [3, 5], "warning": [2, 2], "critical_low": 1},
        "max_age_s": 172800,
        "higher_is_worse": False,
    },
]
SYSTEMS = [
    {"id": "cardiovascular", "indicators": ["bp_systolic", "heart_rate"]},
    {"id": "neuro_behavioral", "indicators": ["mood"]},
    {"id": "musculoskeletal", "indicators": ["bone_loss_risk"]},  # no está en el catálogo
]
PROTOCOLS = [
    {
        "id": "proto_bp_high",
        "system_id": "cardiovascular",
        "statuses": ["warning", "critical"],
        "message": "Sigue el protocolo de tensión alta.",
        "recommendations": [{"id": "rec_bp_repeat", "text": "Repite en reposo", "priority": 1}],
    }
]


def env(env_id, **overrides):
    """Perfil real de environments.json, con los indicadores del catálogo de test."""
    e = get_environment(env_id).model_dump()
    e["indicators"] = ["bp_systolic", "heart_rate", "mood"]
    e.update(overrides)
    return e


def daily(values, end=NOW):
    start = end - timedelta(days=len(values) - 1)
    return [(start + timedelta(days=i), v) for i, v in enumerate(values)]


SERIES = {
    "bp_systolic": daily([118, 120, 119, 121, 118, 120, 119, 120, 135]),
    "heart_rate": daily([70, 72, 71]),
    "mood": daily([4, 4, 4]),
}


def assess(env_id, series=SERIES, **kw):
    return build_assessment(
        member_id=1,
        env=env(env_id),
        indicators=INDICATORS,
        systems=SYSTEMS,
        series=series,
        protocols=PROTOCOLS,
        now=NOW,
        **kw,
    )


def system(a, system_id):
    return next(s for s in a.systems if s.system_id == system_id)


# --- Criterios de aceptación ---------------------------------------------------


def test_response_validates_against_schema():
    a = assess("earth")
    assert Assessment.model_validate(a.model_dump(mode="json")) == a


def test_other_env_gives_other_result_with_same_data():
    """Mismos datos con ?env=: el perfil cambia umbrales, escalera y retardo."""
    earth, mars, geriatric = assess("earth"), assess("mars"), assess("geriatric")

    # 135 mmHg: warning en la Tierra (130-159) y en Marte (override 130-140).
    assert system(earth, "cardiovascular").status == Status.warning
    # 150 mmHg: warning en la Tierra y critical en Marte.
    high = {**SERIES, "bp_systolic": daily([150])}
    assert system(assess("earth", high), "cardiovascular").status == Status.warning
    assert system(assess("mars", high), "cardiovascular").status == Status.critical

    # La escalera y el modo salen del perfil.
    crit_mars = system(assess("mars", high), "cardiovascular").escalation
    assert crit_mars.mode == EscalationMode.autonomous
    assert mars.env_id == "mars" and geriatric.env_id == "geriatric"

    crit = {**SERIES, "bp_systolic": daily([170])}
    assert system(assess("geriatric", crit), "cardiovascular").escalation.target_role == (
        "caregiver"
    )
    assert system(assess("hospital", crit), "cardiovascular").escalation.target_role == "nurse"


# --- Composición -----------------------------------------------------------------


def test_indicator_fields():
    bp = system(assess("earth"), "cardiovascular").indicators[0]
    assert bp.indicator_id == "bp_systolic"
    assert bp.last_value == 135
    assert bp.taken_at == NOW
    assert bp.status == Status.warning
    assert bp.baseline == pytest.approx(119.2857, rel=1e-3)  # media de los primeros 7 días
    assert bp.trend == Trend.rising
    assert bp.range == {"normal": (90, 129), "warning": (130, 159)}


def test_mars_range_includes_override():
    bp = system(assess("mars"), "cardiovascular").indicators[0]
    assert bp.range["warning"] == (130, 140)


def test_system_status_recommendations_and_overall():
    a = assess("earth")
    cardio = system(a, "cardiovascular")
    assert cardio.status == Status.warning
    assert [r.id for r in cardio.recommendations] == ["rec_bp_repeat"]
    assert cardio.escalation.protocol_id == "proto_bp_high"
    assert a.overall_status == Status.warning


def test_missing_series_is_unknown_never_normal():
    a = assess("earth", series={"heart_rate": daily([70, 72, 71])})
    cardio = system(a, "cardiovascular")
    bp = next(i for i in cardio.indicators if i.indicator_id == "bp_systolic")
    assert bp.status == Status.unknown
    assert bp.last_value is None
    assert cardio.status == Status.unknown
    assert system(a, "neuro_behavioral").status == Status.unknown


def test_stale_data_is_unknown():
    old = {k: daily(v, end=NOW - timedelta(days=5)) for k, v in
           {"bp_systolic": [120], "heart_rate": [70], "mood": [4]}.items()}
    a = assess("earth", series=old)
    assert a.overall_status == Status.unknown


def test_systems_without_active_indicators_are_skipped():
    a = assess("earth")
    assert [s.system_id for s in a.systems] == ["cardiovascular", "neuro_behavioral"]

    only_bp = build_assessment(
        member_id=1,
        env=env("earth", indicators=["bp_systolic"]),
        indicators=INDICATORS,
        systems=SYSTEMS,
        series=SERIES,
        now=NOW,
    )
    assert [s.system_id for s in only_bp.systems] == ["cardiovascular"]
    assert [i.indicator_id for i in only_bp.systems[0].indicators] == ["bp_systolic"]


def test_worsening_rule_applies():
    # Normal pero subiendo 3 días seguidos -> warning.
    worsening = {**SERIES, "bp_systolic": daily([110, 113, 116, 119])}
    bp = system(assess("earth", worsening), "cardiovascular").indicators[0]
    assert bp.status == Status.warning


def test_behavioral_summary_is_private_by_default():
    a = assess("earth")
    assert a.behavioral.status == Status.normal
    assert a.behavioral.details_visible is False
    shared = assess("earth", behavioral_details_visible=True)
    assert shared.behavioral.details_visible is True


def test_liveness_is_passed_through():
    a = assess("earth", liveness="stale", last_seen_at=NOW - timedelta(minutes=10))
    assert a.liveness == Liveness.stale
    assert a.last_seen_at == NOW - timedelta(minutes=10)
    assert a.provisional is False
