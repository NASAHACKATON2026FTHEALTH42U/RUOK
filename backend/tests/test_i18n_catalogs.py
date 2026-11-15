"""FE-38: los catálogos (entornos, sistemas, indicadores) salen en inglés con
`Accept-Language: en` y en español sin cabecera; la lógica interna sigue en español."""

import json
from datetime import UTC, datetime

import pytest

from app import i18n
from app.schemas import (
    Assessment,
    BehavioralSummary,
    Escalation,
    IndicatorAssessment,
    Recommendation,
    SystemAssessment,
)
from app.services import catalog, environments

EN = {"Accept-Language": "en"}
CATALOGS = ("environments", "systems", "indicators")


def test_environments_in_english(client):
    envs = {e["id"]: e for e in client.get("/api/v1/environments", headers=EN).json()}
    assert envs["iss"]["name"] == "International Space Station"
    assert envs["iss"]["vocabulary"]["member"] == "astronaut"
    assert envs["iss"]["vocabulary"]["ground"] == "flight surgeon"
    assert envs["hospital"]["vocabulary"]["member"] == "patient"
    assert envs["geriatric"]["vocabulary"]["member"] == "resident"
    # Lo que no es texto no cambia.
    assert envs["mars"]["comm_delay_s"] == environments.get_environment("mars").comm_delay_s

    one = client.get("/api/v1/environments/mars", headers=EN).json()
    assert one["name"] == "Mars base"
    assert one["vocabulary"]["crew"] == "crew"


def test_environments_in_spanish_by_default(client):
    envs = {e["id"]: e for e in client.get("/api/v1/environments").json()}
    assert envs["iss"]["name"] == "Estación Espacial Internacional"
    assert envs["iss"]["vocabulary"]["member"] == "astronauta"
    es = client.get("/api/v1/environments/mars", headers={"Accept-Language": "es-ES"}).json()
    assert es["name"] == "Base marciana"


def test_systems_and_indicators_in_english(client):
    systems = {s["id"]: s for s in client.get("/api/v1/systems", headers=EN).json()}
    assert systems["metabolic"]["name"] == "Metabolism and nutrition"
    assert systems["eyes"]["function"] == "Vision."

    inds = {i["id"]: i for i in client.get("/api/v1/indicators", headers=EN).json()}
    assert inds["heart_rate"]["name"] == "Heart rate"
    assert inds["heart_rate"]["unit"] == "bpm"
    assert inds["bp_systolic"]["unit"] == "mmHg"  # los símbolos se quedan
    assert inds["heart_rate"]["measurement_instructions"][1] == "Measure for 60 s"
    # Los rangos (umbrales) no se tocan.
    assert inds["heart_rate"]["ranges"] == client.get("/api/v1/indicators").json()[0]["ranges"]

    one = client.get("/api/v1/indicators/spo2", headers=EN).json()
    assert one["name"] == "Oxygen saturation"


def test_systems_and_indicators_in_spanish_by_default(client):
    systems = {s["id"]: s for s in client.get("/api/v1/systems").json()}
    assert systems["metabolic"]["name"] == "Metabólico y nutrición"
    one = client.get("/api/v1/indicators/heart_rate").json()
    assert one["name"] == "Frecuencia cardiaca"
    assert one["unit"] == "lpm"


def test_cached_catalog_stays_in_spanish(client):
    client.get("/api/v1/environments", headers=EN)
    client.get("/api/v1/indicators", headers=EN)
    client.get("/api/v1/systems", headers=EN)
    # El motor de evaluación y el resto de servicios usan los originales.
    assert environments.get_environment("iss").vocabulary["member"] == "astronauta"
    assert catalog.get_indicator("heart_rate").name == "Frecuencia cardiaca"
    assert catalog.list_systems()[0].function.startswith("Bombea")


@pytest.mark.parametrize("name", CATALOGS)
def test_layer_covers_every_item_with_known_fields(name):
    source = {x["id"]: x for x in json.loads((catalog.DATA_DIR / f"{name}.json").read_text())}
    layer = json.loads((i18n.I18N_DIR / "en" / f"{name}.json").read_text())
    assert set(layer) == set(source)
    for item_id, fields in layer.items():
        for field, value in fields.items():
            assert field in source[item_id], f"{name}/{item_id}: campo {field} desconocido"
            original = source[item_id][field]
            if isinstance(value, list):
                assert len(value) == len(original), f"{name}/{item_id}.{field}"
            if isinstance(value, dict):
                assert set(value) == set(original), f"{name}/{item_id}.{field}"
            assert value, f"{name}/{item_id}.{field} vacío"


@pytest.fixture
def english():
    token = i18n._lang.set("en")
    yield
    i18n._lang.reset(token)


def _assessment() -> Assessment:
    proto = next(p for p in catalog.list_protocols() if p.id == "proto_cardiovascular_warning")
    item = next(i for i in catalog.list_interventions() if i.system_id == "cardiovascular")
    return Assessment(
        member_id=1,
        env_id="mars",
        generated_at=datetime(2026, 11, 15, tzinfo=UTC),
        overall_status="warning",
        liveness="active",
        systems=[
            SystemAssessment(
                system_id="cardiovascular",
                status="warning",
                indicators=[
                    IndicatorAssessment(
                        indicator_id="heart_rate",
                        unit="lpm",
                        status="warning",
                        trend="stable",
                        range={},
                    )
                ],
                recommendations=[
                    Recommendation(id=r.id, text=r.text, priority=r.priority)
                    for r in proto.recommendations
                ]
                + [
                    Recommendation(
                        id=f"rec_{item.id}",
                        text=f"{item.title} ({item.duration_min} min)",
                        priority=9,
                        intervention_id=item.id,
                    )
                ],
                escalation=Escalation(
                    level=0,
                    target_role="self",
                    mode="realtime",
                    delay_s=0,
                    message=proto.message,
                    protocol_id=proto.id,
                ),
            )
        ],
        behavioral=BehavioralSummary(status="normal", details_visible=True),
    )


def test_assessment_stays_spanish_by_default():
    original = _assessment()
    assert catalog.localized_assessment(original) is original
    assert catalog.localized_unit("heart_rate", "lpm") == "lpm"


def test_assessment_texts_in_english(english):
    original = _assessment()
    out = catalog.localized_assessment(original).systems[0]
    assert out.escalation.message == "Cardiovascular warning: measure again at rest."
    assert out.recommendations[0].text == "Rest for 5 minutes sitting down and measure again"
    item = catalog.get_intervention(out.recommendations[-1].intervention_id)
    title = catalog.localized_intervention(item).title
    assert title != item.title
    assert out.recommendations[-1].text == f"{title} ({item.duration_min} min)"
    assert out.indicators[0].unit == "bpm"
    # Ids, prioridades y estados no cambian; el original sigue en español.
    assert [r.id for r in out.recommendations] == [
        r.id for r in original.systems[0].recommendations
    ]
    assert original.systems[0].indicators[0].unit == "lpm"
    assert original.systems[0].escalation.message.startswith("Cardiovascular en aviso")


def test_localized_unit_only_translates_catalog_units(english):
    assert catalog.localized_unit("heart_rate", "lpm") == "bpm"
    assert catalog.localized_unit("pvt_lapses", "lapsos") == "lapses"
    assert catalog.localized_unit("bp_systolic", "mmHg") == "mmHg"
    assert catalog.localized_unit("heart_rate", "otra") == "otra"
    assert catalog.localized_unit("no_existe", "lpm") == "lpm"


def test_interventions_endpoint_is_localized(client):
    es = {i["id"]: i for i in client.get("/api/v1/interventions").json()}
    en = {i["id"]: i for i in client.get("/api/v1/interventions", headers=EN).json()}
    assert set(es) == set(en)
    item_id = next(iter(es))
    assert en[item_id]["title"] != es[item_id]["title"]
    assert len(en[item_id]["steps"]) == len(es[item_id]["steps"])
    assert en[item_id]["duration_min"] == es[item_id]["duration_min"]
    assert es[item_id]["title"] == catalog.get_intervention(item_id).title
