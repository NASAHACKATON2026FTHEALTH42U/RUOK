"""Cliente mínimo de Ollama (LLM local) para las respuestas simuladas de «Mensaje a casa».

Local-first: el modelo corre en la misma red (``docker compose`` lo levanta como servicio y lo
descarga una vez, antes de la demo); en ejecución no se sale a internet. Desactivado salvo que
se defina ``OLLAMA_URL``: sin él (o si no responde a tiempo) se usan las frases guionizadas.
Sin dependencias nuevas: ``urllib`` de la biblioteca estándar.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.request

log = logging.getLogger(__name__)

DEFAULT_MODEL = "qwen2.5:3b"


def enabled() -> bool:
    return bool(os.environ.get("OLLAMA_URL"))


def chat(
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 160,
    temperature: float = 0.7,
) -> str | None:
    """Respuesta del modelo a una conversación (``[{role, content}]``) o ``None`` si falla."""
    url = os.environ.get("OLLAMA_URL", "").rstrip("/")
    if not url:
        return None
    body = {
        "model": os.environ.get("OLLAMA_MODEL", DEFAULT_MODEL),
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    request = urllib.request.Request(
        f"{url}/api/chat",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    timeout = float(os.environ.get("OLLAMA_TIMEOUT_S", "25"))
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        log.warning("Ollama no disponible (%s): se usa la respuesta guionizada", exc)
        return None
    content = (data.get("message") or {}).get("content")
    return content.strip() if isinstance(content, str) and content.strip() else None
