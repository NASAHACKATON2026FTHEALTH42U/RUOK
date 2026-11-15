#!/usr/bin/env python3
"""Genera la voz guía de la app (FE-37) con ElevenLabs, ANTES de usarla.

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
  5. python3 scripts/voice/generate_voice.py --lang en       # la versión en inglés (FE-38)

En inglés (`--lang en`), los textos salen de las capas de backend/app/data/i18n/en/ (lo que no
esté traducido no se genera) y los de la interfaz, del diccionario del front
(frontend/src/i18n/en/*.ts). Los audios van a frontend/public/voice/en/ con su propio
manifiesto. La voz es ELEVENLABS_VOICE_ID_EN si existe; si no, la misma (el modelo es
multilingüe).

Recoge todos los textos de guía estáticos y genera un MP3 por frase distinta, en este orden de
prioridad (si se acaba el saldo, lo primero ya está):
  1. pasos de las intervenciones (interventions.json, meditaciones incluidas);
  2. protocolos: mensaje y recomendaciones (protocols.json);
  3. instrucciones de medición de cada indicador (indicators.json; también son las preguntas del
     check-in);
  4. textos de guía de la interfaz (frontend/src/components/behavioral/voiceTexts.json, p. ej.
     las instrucciones del test PVT).
Los «Repite 4 ciclos» no se dicen (el reproductor los convierte en repeticiones). Para que se
pronuncien bien, las abreviaturas se envían enteras («60 s» → «60 segundos»).

El manifiesto (frontend/public/voice/manifest.json) relaciona cada texto con su audio, que se
llama como un hash del texto, la voz y los ajustes: si cambias una frase, solo se regenera esa, y
los audios que ya no se usan se borran. Se guarda tras cada audio: si el saldo se acaba a mitad,
lo generado no se pierde. `--max-chars` pone un tope de caracteres por ejecución.

Solo se envían a ElevenLabs textos de guía de la configuración: ningún dato de salud.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "backend" / "app" / "data"
UI_TEXTS = ROOT / "frontend" / "src" / "components" / "behavioral" / "voiceTexts.json"
OUT = ROOT / "frontend" / "public" / "voice"
MANIFEST = OUT / "manifest.json"
I18N_EN = DATA / "i18n" / "en"
FRONT_DICTS = ROOT / "frontend" / "src" / "i18n" / "en"
API = "https://api.elevenlabs.io/v1"
MODEL = "eleven_multilingual_v2"
FORMAT = "mp3_44100_64"
# Voz tranquila: estable y poco teatral.
SETTINGS = {"stability": 0.7, "similarity_boost": 0.75, "style": 0.1, "use_speaker_boost": True}
# Mismo patrón que `expandSteps` (frontend/src/components/behavioral/intervention.ts).
REPEAT = re.compile(
    r"^\s*(repite|repeat)\b.*?(\d+)\s*(ciclos?|veces|cycles?|times)", re.IGNORECASE
)
# Para que se pronuncie bien: abreviaturas enteras y escalas leídas como pausas. Solo cambia lo
# que se envía a ElevenLabs; el manifiesto sigue usando el texto tal como sale en pantalla.
SPOKEN = [
    (re.compile(r"(\d+)\s*ms\b"), r"\1 milisegundos"),
    (re.compile(r"\b1\s*min\b"), "1 minuto"),
    (re.compile(r"(\d+)\s*min\b"), r"\1 minutos"),
    (re.compile(r"\b1\s*s\b"), "1 segundo"),
    (re.compile(r"(\d+)\s*s\b"), r"\1 segundos"),
    (re.compile(r"\ben ml\b"), "en mililitros"),
    (re.compile(r"(\d)\s*=\s*"), r"\1: "),
    (re.compile(r"\bsolo/a\b"), "solo o sola"),
]


SPOKEN_EN = [
    (re.compile(r"(\d+)\s*ms\b"), r"\1 milliseconds"),
    (re.compile(r"\b1\s*min\b"), "1 minute"),
    (re.compile(r"(\d+)\s*min\b"), r"\1 minutes"),
    (re.compile(r"\b1\s*s\b"), "1 second"),
    (re.compile(r"(\d+)\s*s\b"), r"\1 seconds"),
    (re.compile(r"\bin ml\b"), "in millilitres"),
    (re.compile(r"(\d)\s*=\s*"), r"\1: "),
]
LANG = "es"


def spoken(text: str) -> str:
    """Texto que se envía a ElevenLabs ("Mide durante 60 s" → "Mide durante 60 segundos")."""
    for pattern, replacement in SPOKEN_EN if LANG == "en" else SPOKEN:
        text = pattern.sub(replacement, text)
    return text


class ApiError(Exception):
    """Error de la API de ElevenLabs (saldo agotado, clave sin permiso…)."""


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
            raise ApiError(f"ElevenLabs respondió {err.code}: {detail}") from err
    raise ApiError("ElevenLabs no responde: inténtalo más tarde")


def _load(name: str) -> list[dict]:
    """Catálogo en el idioma elegido: en inglés, con su capa (solo lo traducido)."""
    items = json.loads((DATA / name).read_text(encoding="utf-8"))
    if LANG == "es":
        return items
    layer_file = I18N_EN / name
    layer = json.loads(layer_file.read_text(encoding="utf-8")) if layer_file.exists() else {}
    out = []
    for item in items:
        override = layer.get(item.get("id"), {}) if isinstance(item, dict) else {}
        if not override:
            continue  # sin traducir: no se genera
        out.append({**item, **override})
    return out


def _front_dictionary() -> dict[str, str]:
    """Diccionario español → inglés del front (src/i18n/en/*.ts). Se evalúa con Node quitando
    el tipo (`Record<string, string>`): así valen las entradas en varias líneas y las claves sin
    comillas."""
    import subprocess

    out: dict[str, str] = {}
    for f in sorted(FRONT_DICTS.glob("*.ts")):
        if f.name == "index.ts":
            continue
        source = f.read_text(encoding="utf-8")
        body = re.sub(r"export const \w+\s*:\s*Record<string,\s*string>\s*=", "const d =", source)
        js = body + "\nprocess.stdout.write(JSON.stringify(d))"
        try:
            run = subprocess.run(
                ["node", "--input-type=module", "-e", js],
                capture_output=True, text=True, check=True,
            )
            out.update(json.loads(run.stdout))
        except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as err:
            print(f"  ! no se ha podido leer {f.name}: {err}")
    return out


def _strings(value: object) -> list[str]:
    """Todas las cadenas de un JSON (listas y objetos anidados), en orden."""
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [s for v in value for s in _strings(v)]
    if isinstance(value, dict):
        return [s for v in value.values() for s in _strings(v)]
    return []


def guidance_texts() -> dict[str, list[str]]:
    """Textos de guía por origen, en orden de prioridad."""
    interventions = [
        step for i in _load("interventions.json") for step in i["steps"] if not REPEAT.match(step)
    ]
    protocols = [
        text
        for p in _load("protocols.json")
        for text in [p.get("message"), *(r["text"] for r in p.get("recommendations", []))]
        if text
    ]
    measurement = [t for i in _load("indicators.json") for t in i["measurement_instructions"]]
    ui = _strings(json.loads(UI_TEXTS.read_text(encoding="utf-8"))) if UI_TEXTS.exists() else []
    if LANG == "en":
        words = _front_dictionary()
        ui = [words[t] for t in ui if t in words]
    return {
        "intervenciones": interventions,
        "protocolos": protocols,
        "medición": measurement,
        "interfaz": ui,
    }


def clip_name(text: str, voice: str, speed: float) -> str:
    raw = json.dumps([text, voice, MODEL, FORMAT, SETTINGS, speed], ensure_ascii=False)
    return hashlib.sha1(raw.encode()).hexdigest()[:16] + ".mp3"


def write_manifest(voice: str, speed: float, texts: list[str], known: dict[str, str]) -> dict:
    """Escribe el manifiesto con los textos actuales que ya tienen audio y lo devuelve."""
    current = {t: known[t] for t in texts if t in known and (OUT / known[t]).exists()}
    MANIFEST.write_text(
        json.dumps(
            {"voice_id": voice, "model": MODEL, "format": FORMAT, "speed": speed, "texts": current},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return current


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
    parser.add_argument(
        "--max-chars", type=int, help="tope de caracteres a generar en esta ejecución (por saldo)"
    )
    parser.add_argument("--lang", choices=["es", "en"], default="es", help="idioma (FE-38)")
    args = parser.parse_args()
    global LANG, OUT, MANIFEST
    LANG = args.lang
    if LANG == "en":
        OUT = OUT / "en"
        MANIFEST = OUT / "manifest.json"
    load_env()
    key = os.environ.get("ELEVENLABS_API_KEY", "")
    voice = args.voice or (
        os.environ.get("ELEVENLABS_VOICE_ID_EN") if LANG == "en" else None
    ) or os.environ.get("ELEVENLABS_VOICE_ID", "")

    if args.list_voices:
        if not key:
            raise SystemExit("Falta ELEVENLABS_API_KEY (en .env o en el entorno)")
        try:
            voices = json.loads(call("/voices", key))["voices"]
        except ApiError as err:
            raise SystemExit(str(err)) from err
        for v in voices:
            labels = ", ".join(f"{k}: {val}" for k, val in (v.get("labels") or {}).items())
            print(f"{v['voice_id']}  {v['name']}  ({labels})")
        return

    sources = guidance_texts()
    texts: list[str] = []  # sin repetir, en orden de prioridad
    for group in sources.values():
        texts += [t for t in dict.fromkeys(group) if t not in texts]
    previous = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    known: dict[str, str] = previous.get("texts", {})

    def missing(t: str) -> bool:
        return known.get(t) != clip_name(t, voice, args.speed) or not (OUT / known[t]).exists()

    todo = [t for t in texts if missing(t)]
    for name, group in sources.items():
        group_todo = [t for t in dict.fromkeys(group) if t in todo]
        print(
            f"  {name}: {len(set(group))} frases, faltan {len(group_todo)} "
            f"({sum(map(len, group_todo))} caracteres)"
        )
    print(f"{len(texts)} frases; faltan {len(todo)} ({sum(map(len, todo))} caracteres)")
    if args.max_chars is not None:
        budget, capped = args.max_chars, []
        for t in todo:
            if len(t) <= budget:
                capped.append(t)
                budget -= len(t)
        if len(capped) < len(todo):
            print(f"Con --max-chars {args.max_chars}: se generan {len(capped)} de {len(todo)}")
        todo = capped
    if args.dry_run:
        for t in todo:
            print(f"  - {t}")
        return
    if not key or not voice:
        raise SystemExit("Falta ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID (en .env o en el entorno)")

    OUT.mkdir(parents=True, exist_ok=True)
    settings = {**SETTINGS, **({"speed": args.speed} if args.speed != 1 else {})}
    spent = 0
    failure: ApiError | None = None
    for n, text in enumerate(todo, 1):
        name = clip_name(text, voice, args.speed)
        try:
            audio = call(
                f"/text-to-speech/{voice}?output_format={FORMAT}",
                key,
                {"text": spoken(text), "model_id": MODEL, "voice_settings": settings},
                accept="audio/mpeg",
            )
        except ApiError as err:  # p. ej. saldo agotado: se guarda lo generado hasta aquí
            failure = err
            break
        (OUT / name).write_bytes(audio)
        known[text] = name
        spent += len(text)
        write_manifest(voice, args.speed, texts, known)
        print(f"[{n}/{len(todo)}] {text}")
        time.sleep(0.3)

    current = write_manifest(voice, args.speed, texts, known)
    for f in OUT.glob("*.mp3"):  # audios de frases que ya no existen
        if f.name not in current.values():
            f.unlink()
    print(f"Listo: {len(current)} audios en {OUT.relative_to(ROOT)}; gastados {spent} caracteres")
    if failure is not None:
        raise SystemExit(f"Parado a mitad: {failure}")


if __name__ == "__main__":
    main()
