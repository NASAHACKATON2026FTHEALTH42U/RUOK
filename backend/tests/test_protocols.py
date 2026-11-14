"""CNT-02: protocolos por sistema y estado (protocols.json) y fuentes de los textos."""

import re

import pytest

from app.schemas import Protocol
from app.services import catalog
from tests.conftest import API

REAL = catalog.load_protocols()
SYSTEMS = catalog.list_systems()


def _proto(**kw) -> Protocol:
    return Protocol.model_validate({**REAL[0].model_dump(), **kw})


def test_real_file_is_consistent_and_cites_known_sources():
    sources = catalog.source_ids()
    catalog.check_protocols(REAL, SYSTEMS, sources)
    assert sources is None or all(set(p.sources) <= sources for p in REAL)


def test_every_system_has_a_warning_and_a_critical_protocol():
    covered = {(p.system_id, st) for p in REAL for st in p.statuses}
    assert covered == {(s.id, st) for s in SYSTEMS for st in ("warning", "critical")}


def test_recommendations_are_ordered_and_have_text():
    for p in REAL:
        assert [r.priority for r in p.recommendations] == list(
            range(1, len(p.recommendations) + 1)
        )
        assert all(r.text.strip() for r in p.recommendations)
        assert p.message.strip()


@pytest.mark.parametrize(("bad", "fragment"), [
    ({"system_id": "liver"}, "liver"),
    ({"sources": ["S999"]}, "S999"),
])
def test_unknown_system_or_source_is_rejected(bad, fragment):
    with pytest.raises(ValueError, match=fragment):
        catalog.check_protocols([_proto(**bad)], SYSTEMS, {"S1", "S20", "S21", "S22"})


def test_two_protocols_for_the_same_system_and_status_are_rejected():
    twin = _proto(id="proto_twin", recommendations=[
        {"id": "rec_twin", "text": "x", "priority": 1}])
    with pytest.raises(ValueError, match="ya lo cubre"):
        catalog.check_protocols([REAL[0], twin], SYSTEMS)


def test_repeated_recommendation_id_is_rejected():
    other = _proto(id="proto_other", statuses=["critical"])
    with pytest.raises(ValueError, match="repetida"):
        catalog.check_protocols([REAL[0], other], SYSTEMS)


@pytest.mark.parametrize("bad", [
    {"statuses": ["normal"]}, {"statuses": []}, {"recommendations": []},
    {"sources": []}, {"message": ""}, {"typo": 1},
])
def test_schema_rejects_invalid_protocols(bad):
    with pytest.raises(ValueError):
        _proto(**bad)


def test_every_system_and_indicator_text_has_a_source():
    """Criterio de CNT-02: todos los textos tienen fuente en docs/sources.md."""
    if not catalog.SOURCES_FILE.exists():
        pytest.skip("docs/sources.md no está (imagen Docker)")
    doc = catalog.SOURCES_FILE.read_text(encoding="utf-8")
    section = doc.split("## Textos por sistema e indicador (CNT-02)")[1].split("\n## ")[0]
    known = catalog.source_ids()
    rows = {m.group(1): m.group(2)
            for m in re.finditer(r"^\| `([a-z0-9_]+)` \|(.*)$", section, re.M)}
    expected = {s.id for s in SYSTEMS} | {i.id for i in catalog.list_indicators()}
    assert expected <= set(rows), f"sin fuente: {sorted(expected - set(rows))}"
    for item_id in expected:
        cited = set(re.findall(r"\[(S\d+)\]", rows[item_id]))
        assert cited, f"{item_id}: sin fuente citada"
        assert cited <= known, f"{item_id}: fuente desconocida {sorted(cited - known)}"


def test_assessment_uses_the_protocol(client, vega_auth):
    """De punta a punta: tensión crítica de Vega → recomendaciones y mensaje del protocolo."""
    client.post(f"{API}/demo/scenarios/mars_sleep_bp")
    data = client.get(f"{API}/members/1/assessment", headers=vega_auth).json()
    cardio = next(s for s in data["systems"] if s["system_id"] == "cardiovascular")
    proto = next(p for p in REAL
                 if p.system_id == "cardiovascular" and cardio["status"] in p.statuses)
    assert cardio["escalation"]["protocol_id"] == proto.id
    assert cardio["escalation"]["message"] == proto.message
    first = cardio["recommendations"][: len(proto.recommendations)]
    assert [r["id"] for r in first] == [r.id for r in proto.recommendations]
    assert first[0]["priority"] == 1
