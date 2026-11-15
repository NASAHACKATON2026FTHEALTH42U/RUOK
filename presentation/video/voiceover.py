"""Locución del vídeo de 30 s (ElevenLabs, con marcas de tiempo por carácter).

Uso: python3 voiceover.py  → voiceover.mp3 y timing.json (inicio de cada frase en segundos).
La clave se lee del .env de la raíz del repo (nunca se imprime).
"""

import base64
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
VOICE = "TX3LPaxmHKxFdv7VOQHJ"  # Liam: joven, americano, enérgico
SENTENCES = [
    "Hi! Meet... Are You OK?",
    "Our idea is simple: care for astronauts millions of kilometres from home.",
    "Track health and environment metrics, and catch physical and mental changes early with smart alerts.",
    "Because a mission depends on every crew member, we help manage stress, live together and stay connected.",
    "From a NASA crew in deep space, to hospitals and care homes on Earth.",
    "Because exploring space matters... but caring for those who explore it matters even more.",
]


def env_key() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("ELEVENLABS_API_KEY="):
            return line.split("=", 1)[1].strip().strip("'\"")
    raise SystemExit("Falta ELEVENLABS_API_KEY en .env")


def main() -> None:
    text = " ".join(SENTENCES)
    body = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.38,
            "similarity_boost": 0.8,
            "style": 0.55,
            "use_speaker_boost": True,
            "speed": 1.15,
        },
    }
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(body).encode(),
        headers={"xi-api-key": env_key(), "Content-Type": "application/json"},
        method="POST",
    )
    data = json.loads(urllib.request.urlopen(req, timeout=120).read())
    out = pathlib.Path(__file__).parent
    (out / "voiceover.mp3").write_bytes(base64.b64decode(data["audio_base64"]))
    al = data["alignment"]
    chars, starts, ends = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    # Inicio de cada frase: posición de su primer carácter en el texto unido.
    timing, pos = [], 0
    for s in SENTENCES:
        i = text.index(s, pos)
        timing.append({"text": s, "start": round(starts[i], 3), "end": round(ends[i + len(s) - 1], 3)})
        pos = i + len(s)
    total = round(ends[-1], 3)
    (out / "timing.json").write_text(json.dumps({"total": total, "sentences": timing}, indent=2))
    print(f"duración {total} s")
    for t in timing:
        print(f"  {t['start']:6.2f}–{t['end']:6.2f}  {t['text'][:60]}")


if __name__ == "__main__":
    main()
