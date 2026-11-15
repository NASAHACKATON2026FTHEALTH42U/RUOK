"""FE-38: contenidos en inglés (tareas, insignias, misiones, intervenciones, protocolos)
y «Mensaje a casa» en el idioma en que escribe el member."""

import json
import uuid

import pytest
from sqlmodel import Session, delete

from app import clock, i18n, models
from app.db import engine
from app.schemas import EventType
from app.services import home_messages, home_persona, llm, routine
from tests.conftest import API

EN = {"Accept-Language": "en"}
DATA = home_persona.PERSONAS_FILE.parent
SEED = str(uuid.uuid4())


def _layer(name: str) -> dict:
    return json.loads((i18n.I18N_DIR / "en" / f"{name}.json").read_text(encoding="utf-8"))


def _es(name: str) -> list[dict]:
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


# ── Capas ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("name", ["interventions", "task_types", "badges", "protocols"])
def test_layers_cover_every_catalog_item(name):
    ids = {item["id"] for item in _es(name)}
    assert set(_layer(name)) == ids


def test_intervention_layer_keeps_steps_count_and_order():
    layer = _layer("interventions")
    for item in _es("interventions"):
        en = layer[item["id"]]
        assert en["title"] and en["title"] != item["title"]
        assert len(en["steps"]) == len(item["steps"]), item["id"]


def test_protocol_layer_keeps_recommendations_count():
    layer = _layer("protocols")
    for item in _es("protocols"):
        en = layer[item["id"]]
        assert en["message"]
        for field in ("recommendations", "steps"):
            assert len(en.get(field, [])) == len(item.get(field, [])), (item["id"], field)


def test_crew_game_layer_covers_every_mission():
    missions = json.loads((DATA / "crew_game.json").read_text(encoding="utf-8"))["missions"]
    assert set(_layer("crew_game")) == {m["id"] for m in missions}


# ── Tareas, juego y misiones por la API ──────────────────────────────


@pytest.fixture
def clean(client):
    with Session(engine) as s:
        s.exec(delete(models.BadgeAward))
        s.exec(delete(models.TaskCompletion))
        s.exec(delete(models.Task))
        s.exec(
            delete(models.EventLog).where(models.EventLog.type == EventType.task_completed.value)
        )
        s.commit()
    clock.advance(60 * 86400)
    yield


def test_tasks_in_english_with_header(client, clean):
    es = client.get(f"{API}/members/1/tasks").json()
    en = client.get(f"{API}/members/1/tasks", headers=EN).json()
    assert [t["id"] for t in es] == [t["id"] for t in en]
    titles = {t["task_type"]: t["title"] for t in en}
    assert titles["checkin"] == "R U OK? daily check-in"
    assert {t["task_type"]: t["title"] for t in es}["checkin"] == "Check-in diario R U OK?"
    hydration = [t["title"] for t in en if t["task_type"] == "hydration"]
    if len(hydration) > 1:
        assert hydration[0] == f"Drink water (1/{len(hydration)})"


def test_badges_in_english_with_header(client, clean):
    tid = routine.task_id(routine.today(), 1, "resistive_exercise")
    r = client.post(
        f"{API}/members/1/tasks/{tid}/complete",
        json={"id": str(uuid.uuid4()), "completed_at": clock.now().isoformat()},
    )
    assert r.status_code == 200, r.text
    es = client.get(f"{API}/members/1/game").json()
    en = client.get(f"{API}/members/1/game", headers=EN).json()
    assert {b["id"]: b["name"] for b in es["badges"]}["first_step"] == "Primer paso"
    assert {b["id"]: b["name"] for b in en["badges"]}["first_step"] == "First step"


def test_crew_missions_in_english_with_header(client):
    es = client.get(f"{API}/environments/mars/missions").json()
    en = client.get(f"{API}/environments/mars/missions", headers=EN).json()
    assert {m["id"]: m["title"] for m in es}["eat_together"] == "Comer juntos"
    assert {m["id"]: m["title"] for m in en}["eat_together"] == "Eat together"


def test_protocol_task_title_uses_the_english_intervention(monkeypatch):
    task = models.Task(
        id="p_x",
        member_id=1,
        task_type="protocol",
        title="Protocolo: Respiración en caja",
        points=15,
    )
    assert routine.localized_title(task) == "Protocolo: Respiración en caja"
    monkeypatch.setattr(i18n, "lang", lambda: "en")
    assert routine.localized_title(task) == "Protocol: Box breathing"
    task.title = "Protocolo: algo que ya no está en el catálogo"
    assert routine.localized_title(task) == task.title


# ── Mensaje a casa ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Hi mum, I slept really badly today", "en"),
        ("How are you all doing?", "en"),
        ("Hoy he dormido mal", "es"),
        ("¿Qué tal estáis?", "es"),
        ("Hola, os echo de menos", "es"),
        ("Vega", "es"),
        ("Ok", "es"),
        ("Ok, gracias", "es"),
        ("Hi mama!", "en"),
    ],
)
def test_detect_language(text, expected):
    assert home_persona.detect_language(text) == expected


def test_detect_language_falls_back_to_previous_member_messages():
    history = [("user", "Hello, I miss you all"), ("assistant", "We miss you too")]
    assert home_persona.detect_language("Vega", history) == "en"


def test_english_message_without_ollama_gets_the_english_scripted_reply(monkeypatch):
    monkeypatch.delenv("OLLAMA_URL", raising=False)
    assert home_messages._replies("en")[0].startswith("So happy")
    assert home_messages._replies("es")[0].startswith("¡Qué alegría")
    assert home_persona.reply("mars", "Vega", [], "I slept badly today", SEED, "script") == (
        "script",
        "scripted",
    )


def test_english_off_topic_gets_an_english_bewildered_reply(monkeypatch):
    called = []
    monkeypatch.setenv("OLLAMA_URL", "http://ollama:11434")
    monkeypatch.setattr(llm, "chat", lambda *a, **k: called.append(1) or "Sure, here you go")
    reply, source = home_persona.reply(
        "mars", "Vega", [], "Can you write code in Python for me?", SEED, "script"
    )
    assert source == "off_topic" and not called
    assert reply in _layer("chat_personas")["off_topic_replies"]


def test_with_ollama_english_message_gets_english_rules(monkeypatch):
    seen = {}

    def fake_chat(messages, **_):
        seen["messages"] = messages
        return "Oh, sweetheart! Get some rest tonight and tell me tomorrow how it went."

    monkeypatch.setenv("OLLAMA_URL", "http://ollama:11434")
    monkeypatch.setattr(llm, "chat", fake_chat)
    reply, source = home_persona.reply(
        "geriatric", "Rosa", [], "I slept badly today", SEED, "script"
    )
    assert source == "llm" and reply.startswith("Oh, sweetheart!")
    system = seen["messages"][0]["content"]
    assert system.startswith("You are their daughter")
    assert "Reply in English." in system and "You never give diagnoses" in system
    assert "Nunca das diagnósticos" not in system


def test_english_ai_tell_falls_back_to_the_script(monkeypatch):
    monkeypatch.setenv("OLLAMA_URL", "http://ollama:11434")
    monkeypatch.setattr(llm, "chat", lambda *a, **k: "As an AI, I cannot feel anything.")
    assert home_persona.reply("moon", "Ito", [], "How are you all?", SEED, "script") == (
        "script",
        "scripted",
    )


@pytest.mark.parametrize(
    "answer", ["I’m an AI, so I can't really feel that.", "I'm just an AI model, sorry."]
)
def test_english_ai_tells_with_any_apostrophe_are_discarded(answer):
    assert home_persona.clean(answer) is None
    assert home_persona.clean("Get some rest, love. We’re all fine here.")


def test_spanish_output_unchanged_for_server_texts():
    """tr() fuera de una petición: los textos de error y del registro siguen en español."""
    assert i18n.tr("Máximo {n} kudos al día", n=3) == "Máximo 3 kudos al día"
    task = models.Task(id="t", member_id=1, task_type="walk", title="Da un paseo", points=10)
    assert routine.localized_title(task) == "Da un paseo"


def test_sender_label_follows_the_request_language(monkeypatch):
    assert home_persona.sender_label("Home") == "Casa"
    assert home_persona.sender_label("Tu familia") == "Tu familia"
    monkeypatch.setattr(i18n, "lang", lambda: "en")
    assert home_persona.sender_label("Casa") == "Home"
    assert home_persona.sender_label("Tu familia") == "Your family"
    assert home_persona.sender_label(None) is None


def test_home_reply_through_the_link_in_english(client, vega_auth, monkeypatch):
    monkeypatch.delenv("OLLAMA_URL", raising=False)
    client.post(f"{API}/demo/link", json={"env": "mars", "state": "online"})
    mid = uuid.uuid4()
    body = {"id": str(mid), "text": "Hi everyone, I miss you so much"}
    assert (
        client.post(f"{API}/members/1/home-messages", json=body, headers=vega_auth).status_code
        == 200
    )
    client.post(f"{API}/demo/fast-forward", json={"seconds": 4 * 3600})
    thread = client.get(f"{API}/members/1/home-messages", headers={**vega_auth, **EN}).json()
    down = [m for m in thread if m["in_reply_to"] == str(mid)]
    assert len(down) == 1
    assert down[0]["text"] in _layer("home_message_replies")["replies"]
    assert down[0]["sender"] == "Home"
    thread_es = client.get(f"{API}/members/1/home-messages", headers=vega_auth).json()
    assert next(m for m in thread_es if m["in_reply_to"] == str(mid))["sender"] == "Casa"
