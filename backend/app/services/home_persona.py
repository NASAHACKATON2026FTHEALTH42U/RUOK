"""Quién responde en «Mensaje a casa» y cómo (personaje por entorno y barreras).

- El personaje (familiar, pareja, amigo…) sale de ``data/chat_personas.json`` según el entorno.
- Barreras para no salirse del contexto del proyecto:
  1. Antes del modelo: si el mensaje trae marcas de algo ajeno (código, datos generales, intentos
     de cambiar las normas…), no se consulta al modelo y se responde con desconcierto.
  2. El modelo recibe las normas del personaje como mensaje de sistema.
  3. Después: si la respuesta se delata como IA, trae código o es demasiado larga, se descarta.
  Si el modelo no está (o falla), responde la frase guionizada de siempre.
- No se le pasa ningún dato de salud: solo el hilo de la conversación.
"""

from __future__ import annotations

import json
import re
import unicodedata
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.services import llm

PERSONAS_FILE = Path(__file__).resolve().parent.parent / "data" / "chat_personas.json"
MAX_REPLY_CHARS = 420
_AI_TELLS = (
    "como modelo",
    "modelo de lenguaje",
    "inteligencia artificial",
    "soy una ia",
    "asistente",
)


@lru_cache(maxsize=1)
def _config() -> dict[str, Any]:
    return json.loads(PERSONAS_FILE.read_text(encoding="utf-8"))


def _norm(text: str) -> str:
    t = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in t if not unicodedata.combining(c))


def persona(env_id: str) -> dict[str, str]:
    cfg = _config()
    return {**cfg["default"], **cfg["environments"].get(env_id, {})}


def is_off_topic(text: str) -> bool:
    t = _norm(text)
    return any(_norm(m) in t for m in _config()["off_topic_markers"])


def bewildered(seed: str) -> str:
    replies = _config()["off_topic_replies"]
    return replies[uuid.UUID(seed).int % len(replies)]


def build_messages(
    env_id: str, member_name: str, history: list[tuple[str, str]], text: str
) -> list[dict[str, str]]:
    """Conversación para el modelo: normas del personaje + últimos mensajes + el nuevo."""
    p = persona(env_id)
    rules = "\n".join(f"- {r}" for r in _config()["rules"])
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
    if "```" in r or any(t in _norm(r) for t in map(_norm, _AI_TELLS)):
        return None
    r = re.sub(r"\s+", " ", r)
    if len(r) > MAX_REPLY_CHARS:
        cut = r[:MAX_REPLY_CHARS]
        r = cut[: max(cut.rfind("."), cut.rfind("!"), cut.rfind("?")) + 1] or cut
    return r or None


def reply(
    env_id: str, member_name: str, history: list[tuple[str, str]], text: str, seed: str,
    scripted: str,
) -> tuple[str, str]:
    """(texto, origen) de la respuesta: ``off_topic``, ``llm`` o ``scripted``."""
    if is_off_topic(text):
        return bewildered(seed), "off_topic"
    if llm.enabled():
        answer = clean(llm.chat(build_messages(env_id, member_name, history, text)))
        if answer:
            return answer, "llm"
    return scripted, "scripted"
