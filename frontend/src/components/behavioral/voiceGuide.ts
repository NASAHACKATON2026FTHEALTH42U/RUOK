/**
 * Voz guía de las meditaciones (FE-37): frases generadas antes con ElevenLabs
 * (`scripts/voice/generate_voice.py`) y empaquetadas en `public/voice/`. Sin internet: el
 * manifiesto y los audios los sirve la propia app. Suena por Web Audio (el contexto ya está
 * desbloqueado al empezar la meditación) y baja el paisaje sonoro mientras habla. Si una frase no
 * tiene audio, no suena nada: queda el texto en pantalla.
 */
import { duckSoundscape, voiceOutput } from './soundscapes'

const BASE = `${import.meta.env.BASE_URL}voice/`

let manifest: Promise<Record<string, string>> | null = null
const decoded = new Map<string, Promise<AudioBuffer | null>>()
let speaking: AudioBufferSourceNode | null = null

/** Texto → archivo de audio (vacío si no se han generado). */
export function voiceManifest(): Promise<Record<string, string>> {
  manifest ??= fetch(`${BASE}manifest.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: { texts?: Record<string, string> }) => m.texts ?? {})
    .catch(() => ({}))
  return manifest
}

/** ¿Hay voz para alguna de estas frases? */
export async function hasVoiceFor(texts: readonly string[]): Promise<boolean> {
  const m = await voiceManifest()
  return texts.some((t) => t in m)
}

/** Dice una frase; false si no tiene audio o no hay audio en el navegador. */
export async function speak(text: string): Promise<boolean> {
  const file = (await voiceManifest())[text]
  const out = voiceOutput()
  if (!file || !out) return false
  let buffer = decoded.get(file)
  if (!buffer) {
    buffer = fetch(`${BASE}${file}`)
      .then((r) => r.arrayBuffer())
      .then((b) => out.ctx.decodeAudioData(b))
      .catch(() => null)
    decoded.set(file, buffer)
  }
  const audio = await buffer
  if (!audio) return false
  stopSpeaking()
  const src = out.ctx.createBufferSource()
  src.buffer = audio
  src.connect(out.out)
  src.onended = () => {
    if (speaking === src) {
      speaking = null
      duckSoundscape(false)
    }
  }
  duckSoundscape(true)
  src.start()
  speaking = src
  return true
}

/** Calla la voz (al cambiar de paso o terminar). */
export function stopSpeaking(): void {
  const src = speaking
  speaking = null
  if (!src) return
  try {
    src.stop()
  } catch {
    // ya había terminado
  }
  duckSoundscape(false)
}
