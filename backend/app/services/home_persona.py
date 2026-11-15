"""Quién responde en «Mensaje a casa» y cómo (personaje por entorno y barreras).

- El personaje (familiar, pareja, amigo…) sale de ``data/chat_personas.json`` según el entorno.
- Barreras para no salirse del contexto del proyecto:
  1. Antes del modelo: si el mensaje trae marcas de algo ajeno (código, datos generales, intentos
     de cambiar las normas…), no se consulta al modelo y se responde con desconcierto.
  2. El modelo recibe las normas del personaje como mensaje de sistema.
  3. Después: si la respuesta se delata como IA, trae código o es demasiado larga, se descarta.
  Si el modelo no está (o falla), responde la frase guionizada de siempre.
- No se le pasa ningún dato de salud: solo el hilo de la conversación.
- Idioma (FE-38): la respuesta se genera más tarde, al llegar el mensaje a la Tierra (fuera de
  una petición), así que no sale de ``Accept-Language``: el personaje contesta en el idioma en
  que escribió el member (``detect_language``). En inglés usa la capa
  ``data/i18n/en/chat_personas.json``; las marcas de tema ajeno y de IA de las dos lenguas se
  aplican siempre.
"""

from __future__ import annotations

import json
import re
import unicodedata
import uuid
from collections.abc import Iterable
from functools import lru_cache
from pathlib import Path
from typing import Any

from app import i18n
from app.services import llm

PERSONAS_FILE = Path(__file__).resolve().parent.parent / "data" / "chat_personas.json"
PERSONAS_EN_FILE = i18n.I18N_DIR / "en" / "chat_personas.json"
MAX_REPLY_CHARS = 420
_AI_TELLS = (
    "como modelo",
    "modelo de lenguaje",
    "inteligencia artificial",
    "soy una ia",
    "asistente",
)

# Palabras frecuentes (sin tildes) para adivinar el idioma del member. Las que valen en las dos
# lenguas ("a", "me", "no", "he", "son", "ok", "mama", "papa"…) no están en ninguna lista.
_EN_WORDS = frozenset(
    """the and is are was were i i'm im i've you you're your my mine how what who why when
    where it it's to of in on at am be been being do did does don't can can't will would
    got get have has had hi hello hey love miss missing today tonight good well we we're our
    us they their there here this that with for from about doing feel feeling felt sleep
    slept sleeping thanks thank mom mum dad everyone everything guys hope really very much
    so but not just all fine great bad tired day night week see soon please yes yeah
    okay""".split()
)
_ES_WORDS = frozenset(
    """el la los las lo del al de que y o en un una unos unas por para con sin mi mis tu tus
    te se nos os es esta estas estoy estamos estais estan soy eres somos hola gracias bien
    muy pero hoy ayer manana mucho mucha muchos todo todos todas aqui alli ya tambien ti
    hay mas cuando donde porque como que tal echo menos casa dia noche semana bueno buena
    buenas buenos quiero tengo tienes siento cansado cansada dormido dormir beso besos
    abrazo abrazos vale si vosotros sois carino""".split()
)


@lru_cache(maxsize=1)
def _config() -> dict[str, Any]:
    return json.loads(PERSONAS_FILE.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _config_en() -> dict[str, Any]:
    if not PERSONAS_EN_FILE.exists():
        return {}
    return json.loads(PERSONAS_EN_FILE.read_text(encoding="utf-8"))


def _cfg(language: str) -> dict[str, Any]:
    """Configuración del personaje en ``language`` (lo que falte en inglés, en español)."""
    base = _config()
    if language != "en" or not _config_en():
        return base
    return i18n._merge(base, _config_en())


def _norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", text.lower().replace("’", "'"))
    return "".join(c for c in t if not unicodedata.combining(c))


def _guess(text: str) -> str | None:
    words = re.findall(r"[a-z']+", _norm(text))
    en = sum(w in _EN_WORDS for w in words)
    es = sum(w in _ES_WORDS for w in words)
    if "¿" in text or "¡" in text or "ñ" in text.lower():
        es += 2
    if en > es:
        return "en"
    if es > en:
        return "es"
    return None


def detect_language(text: str, history: Iterable[tuple[str, str]] = ()) -> str:
    """'en' o 'es' según cómo escribe el member: su último mensaje y, si no se sabe, los
    anteriores. Por defecto, español."""
    previous = [content for role, content in history if role == "user"]
    for candidate in [text, *reversed(previous)]:
        guess = _guess(candidate or "")
        if guess:
            return guess
    return "es"


def persona(env_id: str, language: str = "es") -> dict[str, str]:
    cfg = _cfg(language)
    return {**cfg["default"], **cfg["environments"].get(env_id, {})}


def sender_label(sender: str | None) -> str | None:
    """El remitente guardado («Casa», «Home»…) en el idioma de la petición en curso."""
    if not sender:
        return sender
    es, en = _config(), _cfg("en")
    pairs = [(es["default"]["sender"], en["default"]["sender"])]
    for env_id in es["environments"]:
        pairs.append((persona(env_id, "es")["sender"], persona(env_id, "en")["sender"]))
    target = i18n.lang()
    for es_sender, en_sender in pairs:
        if sender in (es_sender, en_sender):
            return en_sender if target == "en" else es_sender
    return sender


def is_off_topic(text: str) -> bool:
    t = _norm(text)
    markers = [*_config()["off_topic_markers"], *_config_en().get("off_topic_markers", [])]
    return any(_norm(m) in t for m in markers)


def bewildered(seed: str, language: str = "es") -> str:
    replies = _cfg(language)["off_topic_replies"]
    return replies[uuid.UUID(seed).int % len(replies)]


def build_messages(
    env_id: str,
    member_name: str,
    history: list[tuple[str, str]],
    text: str,
    language: str = "es",
) -> list[dict[str, str]]:
    """Conversación para el modelo: normas del personaje + últimos mensajes + el nuevo."""
    p = persona(env_id, language)
    rules = "\n".join(f"- {r}" for r in _cfg(language)["rules"])
    if language == "en":
        system = (
            f"You are {p['who']}. You are chatting with {member_name}, {p['relation']}.\n"
            f"Rules you never break:\n{rules}"
        )
    else:
        system = (
            f"Eres {p['who']}. Hablas por chat con {member_name}, {p['relation']}.\n"
            f"Normas que nunca rompes:\n{rules}"
        )
    msgs = [{"role": "system", "content": system}]
    for role, content in history[-6:]:
        msgs.append({"role": role, "content": content})
    msgs.append({"role": "user", "content": text})
    return msgs


def clean(reply: str | None) -> str | None:
    """Respuesta del modelo aceptable para el personaje, o ``None`` para usar la guionizada."""
    if not reply:
        return None
    r = reply.strip().strip('"').strip()
    tells = (*_AI_TELLS, *_config_en().get("ai_tells", []))
    if "```" in r or any(t in _norm(r) for t in map(_norm, tells)):
        return None
    r = re.sub(r"\s+", " ", r)
    if len(r) > MAX_REPLY_CHARS:
        cut = r[:MAX_REPLY_CHARS]
        r = cut[: max(cut.rfind("."), cut.rfind("!"), cut.rfind("?")) + 1] or cut
    return r or None


def reply(
    env_id: str,
    member_name: str,
    history: list[tuple[str, str]],
    text: str,
    seed: str,
    scripted: str,
    language: str | None = None,
) -> tuple[str, str]:
    """(texto, origen) de la respuesta: ``off_topic``, ``llm`` o ``scripted``.

    ``language`` es el idioma de la respuesta; si no se da, el del member (``detect_language``).
    ``scripted`` ya tiene que venir en ese idioma.
    """
    language = language or detect_language(text, history)
    if is_off_topic(text):
        return bewildered(seed, language), "off_topic"
    if llm.enabled():
        answer = clean(llm.chat(build_messages(env_id, member_name, history, text, language)))
        if answer:
            return answer, "llm"
    return scripted, "scripted"
