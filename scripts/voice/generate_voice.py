#!/usr/bin/env python3
"""Genera la voz guía de las meditaciones (FE-37) con ElevenLabs, ANTES de usar la app.

La app no llama a ningún servicio en la nube (principio local-first): este script se ejecuta una
vez, en un ordenador con internet, y deja los audios en frontend/public/voice/ para que vayan
empaquetados con la app.

Uso:
  1. Crea un .env en la raíz del repo (está en .gitignore; nunca subas la clave) con:
       ELEVENLABS_API_KEY=...
       ELEVENLABS_VOICE_ID=...        # una voz española tranquila de tu cuenta
  2. python3 scripts/voice/generate_voice.py --list-voices   # para elegir la voz
  3. python3 scripts/voice/generate_voice.py --dry-run       # qué falta y cuántos caracteres
  4. python3 scripts/voice/generate_voice.py                 # genera lo que falta o cambió

Lee las meditaciones de backend/app/data/interventions.json (category "meditation") y genera un
MP3 por frase distinta. El manifiesto (frontend/public/voice/manifest.json) relaciona cada texto
con su audio, que se llama como un hash del texto, la voz y los ajustes: si cambias una frase,
solo se regenera esa, y los audios que ya no se usan se borran.

Solo se envían a ElevenLabs los textos de las meditaciones: ningún dato de salud.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "backend" / "app" / "data" / "interventions.json"
OUT = ROOT / "frontend" / "public" / "voice"
MANIFEST = OUT / "manifest.json"
API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
FORMAT = "mp3_44100_64"
# Voz tranquila: estable y poco teatral.
SETTINGS = {"stability": 0.7, "similarity_boost": 0.75, "style": 0.1, "use_speaker_boost": True}


def load_env() -> None:
    """Variables del .env de la raíz (sin pisar las que ya haya en el entorno)."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def call(path: str, key: str, body: dict | None = None, accept: str = "application/json") -> bytes:
    """Petición a la API de ElevenLabs, con reintentos si limita la frecuencia (429)."""
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        f"{API}{path}",
        data=data,
        method="POST" if data is not None else "GET",
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": accept},
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except urllib.error.HTTPError as err:
            if err.code == 429 and attempt < 4:
                time.sleep(2 * 2**attempt)
                continue
            detail = err.read().decode(errors="replace")[:400]
            raise SystemExit(f"ElevenLabs respondió {err.code}: {detail}") from err
    raise SystemExit("ElevenLabs no responde: inténtalo más tarde")


def meditation_phrases() -> dict[str, list[str]]:
    """Pasos de cada meditación del catálogo."""
    items = json.loads(CATALOG.read_text(encoding="utf-8"))
    return {i["id"]: i["steps"] for i in items if i.get("category") == "meditation"}


def clip_name(text: str, voice: str, speed: float) -> str:
    raw = json.dumps([text, voice, MODEL, FORMAT, SETTINGS, speed], ensure_ascii=False)
    return hashlib.sha1(raw.encode()).hexdigest()[:16] + ".mp3"


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--list-voices", action="store_true", help="lista las voces de tu cuenta")
    parser.add_argument("--dry-run", action="store_true", help="solo dice qué falta (sin gastar)")
    parser.add_argument("--voice", help="id de la voz (si no, ELEVENLABS_VOICE_ID)")
    parser.add_argument(
        "--speed", type=float, default=0.9, help="ritmo (0.7–1.2; 1 = normal). Por defecto, 0.9"
    )
    args = parser.parse_args()
    load_env()
    key = os.environ.get("ELEVENLABS_API_KEY", "")
    voice = args.voice or os.environ.get("ELEVENLABS_VOICE_ID", "")

    if args.list_voices:
        if not key:
            raise SystemExit("Falta ELEVENLABS_API_KEY (en .env o en el entorno)")
        for v in json.loads(call("/voices", key))["voices"]:
            labels = ", ".join(f"{k}: {val}" for k, val in (v.get("labels") or {}).items())
            print(f"{v['voice_id']}  {v['name']}  ({labels})")
        return

    phrases = meditation_phrases()
    texts = sorted({t for steps in phrases.values() for t in steps})
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    known: dict[str, str] = previous.get("texts", {})
    todo = [
        t
        for t in texts
        if known.get(t) != clip_name(t, voice, args.speed) or not (OUT / known[t]).exists()
    ]
    chars = sum(len(t) for t in todo)
    print(
        f"{len(texts)} frases en {len(phrases)} meditaciones; "
        f"faltan {len(todo)} ({chars} caracteres)"
    )
    if args.dry_run:
        for t in todo:
            print(f"  - {t}")
        return
    if not key or not voice:
        raise SystemExit("Falta ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID (en .env o en el entorno)")

    OUT.mkdir(parents=True, exist_ok=True)
    settings = {**SETTINGS, **({"speed": args.speed} if args.speed != 1 else {})}
    for n, text in enumerate(todo, 1):
        name = clip_name(text, voice, args.speed)
        audio = call(
            f"/text-to-speech/{voice}?output_format={FORMAT}",
            key,
            {"text": text, "model_id": MODEL, "voice_settings": settings},
            accept="audio/mpeg",
        )
        (OUT / name).write_bytes(audio)
        known[text] = name
        print(f"[{n}/{len(todo)}] {text}")
        time.sleep(0.3)

    current = {t: known[t] for t in texts if t in known}
    for f in OUT.glob("*.mp3"):  # audios de frases que ya no existen
        if f.name not in current.values():
            f.unlink()
    MANIFEST.write_text(
        json.dumps(
            {
                "voice_id": voice,
                "model": MODEL,
                "format": FORMAT,
                "speed": args.speed,
                "texts": current,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Listo: {len(current)} audios en {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
