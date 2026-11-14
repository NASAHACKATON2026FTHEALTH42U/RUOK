"""BE-21: catálogo de intervenciones, GET /interventions y su enlace con el assessment."""

import pytest

from app.schemas import Intervention
from app.schemas.common import Status
from app.services import behavioral, catalog
from app.services.assessment import MAX_INTERVENTIONS_PER_SYSTEM, intervention_recommendations
from app.services.member_assessment import build_assessment
from tests.test_behavioral import ENV, IND, NOW, SYSTEMS, daily

API = "/api/v1"
NEURO = "neuro_behavioral"
REAL = catalog.list_interventions()


def _ids(recs):
    return [r.intervention_id for r in recs]


# ── Catálogo ───────────────────────────────────────────────────────────


def test_catalog_has_the_five_kinds_of_countermeasure():
    categories = {i.category for i in REAL}
    assert {"stress", "mood", "journal", "sleep", "exercise"} <= categories
    assert all(i.offline for i in REAL)  # todas funcionan sin enlace
    assert all(i.sources for i in REAL)  # cada una cita docs/sources.md


def test_catalog_is_consistent_with_indicators_systems_and_sources():
    catalog.check_interventions(
        REAL, catalog.list_indicators(), catalog.list_systems(), catalog.source_ids()
    )


def test_every_behavioral_indicator_has_an_intervention():
    """Cualquier indicador conductual que salte tiene al menos una específica."""
    covered = {ind for i in REAL for ind in i.indicator_ids}
    neuro = next(s for s in catalog.list_systems() if s.id == NEURO)
    assert set(neuro.indicators) <= covered


@pytest.mark.parametrize(
    ("change", "error"),
    [
        ({"system_id": "nope"}, "system_id 'nope' no existe"),
        ({"indicator_ids": ["nope"]}, "el indicador 'nope' no existe"),
        ({"indicator_ids": ["heart_rate"]}, "'heart_rate' es de 'cardiovascular'"),
        ({"sources": ["S999"]}, "la fuente 'S999'"),
    ],
)
def test_check_interventions_rejects_typos(change, error):
    bad = REAL[0].model_copy(update=change)
    with pytest.raises(ValueError, match=error):
        catalog.check_interventions(
            [bad], catalog.list_indicators(), catalog.list_systems(), catalog.source_ids()
        )


def test_duplicated_ids_are_rejected(tmp_path):
    path = tmp_path / "interventions.json"
    item = REAL[0].model_dump_json()
    path.write_text(f"[{item}, {item}]")
    with pytest.raises(ValueError, match="duplicados"):
        catalog.load_interventions(path)


# ── API ────────────────────────────────────────────────────────────────


def test_list_is_public_and_filters(anon_client):
    r = anon_client.get(f"{API}/interventions")
    assert r.status_code == 200
    assert len(r.json()) == len(REAL)
    neuro = anon_client.get(f"{API}/interventions", params={"system_id": NEURO}).json()
    assert neuro and all(i["system_id"] == NEURO for i in neuro)
    sleep = anon_client.get(f"{API}/interventions", params={"category": "sleep"}).json()
    assert [i["id"] for i in sleep] == ["int_sleep_light"]
    assert anon_client.get(f"{API}/interventions", params={"category": "x"}).json() == []


# ── Recomendaciones (función pura) ─────────────────────────────────────


def test_no_recommendation_when_normal_or_unknown():
    for status in (Status.normal, Status.unknown):
        assert intervention_recommendations(NEURO, status, {"mood": status}, REAL) == []


def test_flagged_indicator_first_then_generic():
    recs = intervention_recommendations(NEURO, Status.warning, {"stress": Status.warning}, REAL)
    ids = _ids(recs)
    assert ids[0] == "int_box_breathing"
    assert ids[-1] == "int_reach_out"  # la genérica siempre está
    assert len(ids) <= MAX_INTERVENTIONS_PER_SYSTEM
    assert [r.priority for r in recs] == list(range(1, len(recs) + 1))


def test_warning_system_without_specific_match_still_suggests_one():
    """Criterio de aceptación: un sistema conductual en warning sugiere al menos una."""
    recs = intervention_recommendations(NEURO, Status.warning, {}, REAL)
    assert _ids(recs) == ["int_reach_out"]


def test_priorities_continue_after_protocol():
    recs = intervention_recommendations(
        NEURO, Status.warning, {"mood": "warning"}, REAL, first_priority=3
    )
    assert recs[0].priority == 3


def test_other_systems_use_their_own():
    recs = intervention_recommendations(
        "musculoskeletal", Status.warning, {"exercise_min": Status.warning}, REAL
    )
    assert _ids(recs) == ["int_exercise_session"]
    assert intervention_recommendations("eyes", Status.critical, {}, REAL) == []


# ── En el assessment y con privacidad ──────────────────────────────────


def _assessment(**kw):
    return build_assessment(
        member_id=1,
        env=ENV,
        indicators=IND.values(),
        systems=SYSTEMS,
        now=NOW,
        series={"mood": daily([5] * 9 + [3.5] * 5)},  # ánimo bajo → warning (BE-20)
        interventions=REAL,
        **kw,
    )


def test_behavioral_warning_links_interventions_in_assessment():
    system = _assessment().systems[0]
    assert system.status == Status.warning
    ids = _ids(system.recommendations)
    assert "int_cbt_reframe" in ids  # específica del ánimo
    assert "int_reach_out" in ids
    assert all(r.intervention_id for r in system.recommendations)


def test_redact_keeps_only_generic_interventions():
    """Sin permiso para ver detalles, una tarjeta de «ánimo» delataría el indicador."""
    hidden = behavioral.redact(_assessment()).systems[0]
    assert _ids(hidden.recommendations) == ["int_reach_out"]
    visible = behavioral.redact(_assessment(behavioral_details_visible=True)).systems[0]
    assert "int_cbt_reframe" in _ids(visible.recommendations)


def test_member_sees_specific_but_medic_only_generic(client, vega_auth, medic_auth):
    """De punta a punta con la BD de demo: escenario de sueño y tensión de Vega."""
    client.post(f"{API}/demo/scenarios/mars_sleep_bp")
    own = client.get(f"{API}/members/1/assessment", headers=vega_auth).json()
    neuro = next(s for s in own["systems"] if s["system_id"] == NEURO)
    assert neuro["status"] in ("warning", "critical")
    # Las recomendaciones del protocolo (CNT-02) no llevan intervention_id: son las mismas
    # salte el indicador que salte, así que no delatan nada y las ve todo el mundo.
    own_ids = [r["intervention_id"] for r in neuro["recommendations"] if r["intervention_id"]]
    assert "int_sleep_light" in own_ids

    other = client.get(f"{API}/members/1/assessment", headers=medic_auth).json()
    neuro = next(s for s in other["systems"] if s["system_id"] == NEURO)
    medic_ids = [r["intervention_id"] for r in neuro["recommendations"] if r["intervention_id"]]
    protocol_texts = [r["text"] for r in neuro["recommendations"] if not r["intervention_id"]]
    assert protocol_texts  # el protocolo del sistema sí se ve
    if other["behavioral"]["details_visible"]:  # comparte o hay emergencia (BD compartida)
        assert medic_ids == own_ids
    else:
        assert medic_ids == ["int_reach_out"]


def test_schema_rejects_unknown_fields():
    with pytest.raises(ValueError):
        Intervention.model_validate({**REAL[0].model_dump(), "typo": 1})
