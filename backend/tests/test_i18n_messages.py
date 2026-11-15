"""FE-38: los textos que genera el servidor (resúmenes, errores, evaluación, alertas) salen en
inglés con `Accept-Language: en` y en español sin cabecera. En la BD se guardan en español."""

import json
import re
import uuid

import pytest

from app import clock, i18n, models
from app.services import alerts, catalog, ground

API = "/api/v1"
EN = {"Accept-Language": "en"}


@pytest.fixture(autouse=True)
def fresh_seed(client):
    assert client.post(f"{API}/demo/reset").status_code == 200
    yield
    client.post(f"{API}/demo/reset")  # deja el seed limpio para los módulos siguientes


@pytest.fixture
def english():
    i18n.set_lang("en")
    yield
    i18n.set_lang("es")


def test_messages_layer_keeps_the_holes():
    layer = json.loads((i18n.I18N_DIR / "en" / "messages.json").read_text(encoding="utf-8"))
    assert layer
    for es, en in layer.items():
        assert en.strip(), es
        assert sorted(re.findall(r"\{\w+\}", es)) == sorted(re.findall(r"\{\w+\}", en)), es


def test_summary_in_english_and_spanish(client):
    en = client.get(f"{API}/members/1/summary", params={"period": "day"}, headers=EN).json()
    es = client.get(f"{API}/members/1/summary", params={"period": "day"}).json()
    assert en["text"].startswith("Here's how I'm doing today: Overall I")
    assert es["text"].startswith("Así estoy hoy: En general estoy")

    week = client.get(f"{API}/members/1/summary", params={"period": "week"}, headers=EN).json()
    assert week["text"].startswith("This week I")
    assert "semana" not in week["text"]


def test_http_errors_follow_the_language(client, anon_client):
    r = client.get(f"{API}/members/999/assessment", headers=EN)
    assert r.status_code == 404 and r.json()["detail"] == "Unknown member: 999"
    r = client.get(f"{API}/members/999/assessment")
    assert r.json()["detail"] == "Member desconocido: 999"

    bad = {"username": "admin", "password": "nope"}
    r = anon_client.post(f"{API}/auth/login", json=bad, headers=EN)
    assert r.status_code == 401 and r.json()["detail"] == "Wrong username or password"
    r = anon_client.post(f"{API}/auth/login", json=bad)
    assert r.json()["detail"] == "Usuario o contraseña incorrectos"

    r = anon_client.get(f"{API}/auth/me", headers=EN)
    assert r.status_code == 401 and r.json()["detail"] == "Session token missing"

    m = {"id": str(uuid.uuid4()), "indicator_id": "heart_rate", "value": 999,
         "taken_at": clock.now().isoformat()}
    r = client.post(f"{API}/members/1/measurements", json={"measurements": [m]}, headers=EN)
    assert r.status_code == 422 and "outside the allowed range" in r.json()["detail"]


def test_role_label_uses_the_english_vocabulary(client, vega_auth):
    assert client.get(f"{API}/auth/me", headers={**vega_auth, **EN}).json()["role_label"] == (
        "astronaut"
    )
    assert client.get(f"{API}/auth/me", headers=EN).json()["role_label"] == "operator"
    assert client.get(f"{API}/auth/me", headers=vega_auth).json()["role_label"] == "astronauta"


def test_assessment_and_alert_texts_in_english_stored_in_spanish(client, vega_auth):
    m = {"id": str(uuid.uuid4()), "indicator_id": "heart_rate", "value": 150,
         "taken_at": clock.now().isoformat()}
    r = client.post(
        f"{API}/members/1/measurements", json={"measurements": [m]}, headers={**vega_auth, **EN}
    )
    assert r.status_code == 200, r.text
    systems = r.json()["assessment"]["systems"]
    cardio = next(s for s in systems if s["system_id"] == "cardiovascular")
    protocol_id = cardio["escalation"]["protocol_id"]
    protocol = next(p for p in catalog.list_protocols() if p.id == protocol_id)
    i18n.set_lang("en")
    try:
        shown = catalog.localized_protocol(protocol)
    finally:
        i18n.set_lang("es")
    assert shown.message != protocol.message
    assert cardio["escalation"]["message"] == shown.message
    texts = [rec["text"] for rec in cardio["recommendations"]]
    assert shown.recommendations[0].text in texts
    assert protocol.recommendations[0].text not in texts

    # La alerta se guarda en español y se lee en el idioma de cada petición.
    en = [a for a in client.get(f"{API}/members/1/alerts", headers=EN).json()
          if a["system_id"] == "cardiovascular"]
    es = [a for a in client.get(f"{API}/members/1/alerts").json()
          if a["system_id"] == "cardiovascular"]
    assert en[0]["message"] == shown.message
    assert es[0]["message"] == protocol.message

    # Sin cabecera, el assessment sigue en español.
    es_assessment = client.get(f"{API}/members/1/assessment").json()
    cardio_es = next(s for s in es_assessment["systems"] if s["system_id"] == "cardiovascular")
    assert cardio_es["escalation"]["message"] == protocol.message


def _alert(**kw) -> models.Alert:
    base = {"id": str(uuid.uuid4()), "member_id": 1, "env_id": "mars", "origin": "auto",
            "category": "indicator", "severity": "warning", "message": ""}
    return models.Alert(**{**base, **kw})


def test_generated_alert_messages_are_translated_when_read(english):
    no_contact = _alert(
        category="no_contact", severity="critical",
        message=alerts.NO_CONTACT_MESSAGE.format(name="Cmdr. Vega", since="10:05"),
    )
    assert alerts.localized_message(no_contact) == "No contact with Cmdr. Vega since 10:05 UTC"

    help_ = _alert(origin="manual", category="symptom",
                   message=alerts.RUOK_HELP_MESSAGE + ": me mareo")
    assert alerts.localized_message(help_) == "Answered 'I need help' to R U OK?: me mareo"

    system = catalog.list_systems()[0]
    fallback = _alert(system_id=system.id, message=f"{system.name} en aviso")
    english_name = catalog.localized_system(system).name
    assert alerts.localized_message(fallback) == f"{english_name} at warning level"

    # Lo que escribe una persona no se toca.
    manual = _alert(origin="manual", category="symptom", message="Me duele la cabeza")
    assert alerts.localized_message(manual) == "Me duele la cabeza"


def test_generated_alert_messages_stay_spanish_without_header():
    no_contact = _alert(category="no_contact", message="Sin contacto con Vega desde las 10:05 UTC")
    assert alerts.localized_message(no_contact) == "Sin contacto con Vega desde las 10:05 UTC"
    assert i18n.tr(ground.HIDDEN_MESSAGE) == "Alerta conductual activa"


def test_ground_hidden_message_in_english(english):
    assert i18n.tr(ground.HIDDEN_MESSAGE) == "Active behavioral alert"


def test_units_and_seed_display_names_in_english(client, vega_auth):
    a = client.get(f"{API}/members/1/assessment", headers=EN).json()
    units = {i["indicator_id"]: i["unit"] for s in a["systems"] for i in s["indicators"]}
    assert units["heart_rate"] == "bpm"
    es = client.get(f"{API}/members/1/assessment").json()
    assert {i["indicator_id"]: i["unit"] for s in es["systems"] for i in s["indicators"]}[
        "heart_rate"
    ] == "lpm"

    rows = client.get(
        f"{API}/members/1/measurements", params={"indicator_id": "heart_rate"}, headers=EN
    ).json()
    assert rows and {r["unit"] for r in rows} == {"bpm"}
    fc = client.get(
        f"{API}/members/1/forecast", params={"indicator_id": "heart_rate"}, headers=EN
    ).json()
    assert fc["unit"] == "bpm"

    assert client.get(f"{API}/auth/me", headers=EN).json()["display_name"] == "Operator"
    assert client.get(f"{API}/auth/me").json()["display_name"] == "Operador"
    assert client.get(f"{API}/auth/me", headers={**vega_auth, **EN}).json()["display_name"] == (
        "Cmdr. Vega"
    )
    demo = client.get(f"{API}/auth/demo-users", headers=EN).json()
    staff = [u["display_name"] for u in demo if u["role"] == "medic" and u["env_id"] == "mars"]
    es_staff = [u["display_name"] for u in client.get(f"{API}/auth/demo-users").json()
                if u["role"] == "medic" and u["env_id"] == "mars"]
    assert staff and es_staff and staff != es_staff
    assert "Marte" not in staff[0]


def test_stored_fixed_summaries_are_read_in_the_reader_language():
    from app import i18n, models
    from app.services import events

    row = models.EventLog(id=1, type="alert.created", summary="Sin contacto con el member")
    assert events.to_schema(row).summary == "Sin contacto con el member"
    i18n.set_lang("en")
    try:
        assert events.to_schema(row).summary == "No contact with the member"
    finally:
        i18n.set_lang("es")
