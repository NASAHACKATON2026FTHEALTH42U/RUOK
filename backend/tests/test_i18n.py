"""FE-38: idioma por petición y capas en inglés."""

from pydantic import BaseModel

from app import i18n


class Step(BaseModel):
    text: str


class Item(BaseModel):
    id: str
    title: str
    vocabulary: dict[str, str] = {}
    steps: list[Step] = []


def test_parse_accept_language():
    assert i18n.parse_accept_language(None) == "es"
    assert i18n.parse_accept_language("en-GB,en;q=0.9") == "en"
    assert i18n.parse_accept_language("es-ES") == "es"
    assert i18n.parse_accept_language("fr") == "es"


def test_localized_merges_fields_and_keeps_missing_ones(monkeypatch):
    layer = {
        "x": {"title": "Title", "vocabulary": {"member": "astronaut"}, "steps": [{"text": "One"}]}
    }
    monkeypatch.setattr(i18n, "_layer", lambda name, language="en": layer)
    item = Item(id="x", title="Título", vocabulary={"member": "astronauta", "crew": "tripulación"},
                steps=[Step(text="Uno")])
    i18n.set_lang("es")
    assert i18n.localized("demo", "x", item) is item
    i18n.set_lang("en")
    try:
        out = i18n.localized("demo", "x", item)
        assert out.title == "Title"
        assert out.vocabulary == {"member": "astronaut", "crew": "tripulación"}
        assert out.steps[0].text == "One"
        assert item.title == "Título"  # el original no cambia (catálogos en caché)
        assert i18n.localized("demo", "missing", item) is item
    finally:
        i18n.set_lang("es")


def test_tr_fills_holes_and_falls_back(monkeypatch):
    monkeypatch.setattr(i18n, "_layer", lambda name, language="en": {"Hola {n}": "Hi {n}"})
    i18n.set_lang("en")
    try:
        assert i18n.tr("Hola {n}", n=3) == "Hi 3"
        assert i18n.tr("Sin traducir") == "Sin traducir"
    finally:
        i18n.set_lang("es")
    assert i18n.tr("Hola {n}", n=3) == "Hola 3"


def test_response_says_its_language(client):
    r = client.get("/api/v1/health", headers={"Accept-Language": "en"})
    assert r.headers["content-language"] == "en"
    assert client.get("/api/v1/health").headers["content-language"] == "es"
