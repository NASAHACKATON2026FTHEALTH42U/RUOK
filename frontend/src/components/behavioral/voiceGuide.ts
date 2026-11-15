/**
 * Voz guía (FE-37): frases generadas antes con ElevenLabs (`scripts/voice/generate_voice.py`) y
 * empaquetadas en `public/voice/`. Sin internet: el manifiesto y los audios los sirve la propia
 * app. Suena por Web Audio y baja el paisaje sonoro mientras habla. Si una frase no tiene audio,
 * no suena nada: queda el texto en pantalla.
 *
 * Solo hay una voz a la vez: decir algo nuevo (o `stopSpeaking`) corta lo que sonaba, también una
 * lectura en secuencia.
 */
import { runSequence, type ClipResult } from './voice'
import { duckSoundscape, voiceOutput } from './soundscapes'

const BASE = `${import.meta.env.BASE_URL}voice/`

let manifest: Promise<Record<string, string>> | null = null
const decoded = new Map<string, Promise<AudioBuffer | null>>()
let speaking: AudioBufferSourceNode | null = null
/** Sube con cada frase o lectura nueva y con cada parada: lo anterior deja de sonar. */
let generation = 0

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

/** Número de la voz actual: sirve para no cortar la de otro al desmontar. */
export function voiceGeneration(): number {
  return generation
}

function stopCurrent(): void {
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

/** Una frase lanzada: si ha empezado a sonar y cuándo acaba (true), se corta (false) o falta. */
interface Clip {
  state: 'playing' | 'missing' | 'superseded'
  ended: Promise<ClipResult>
}

/** Reproduce una frase si sigue siendo la voz actual (`gen`). */
async function playClip(text: string, gen: number): Promise<Clip> {
  const file = (await voiceManifest())[text]
  const out = voiceOutput()
  if (!file || !out) return { state: 'missing', ended: Promise.resolve('missing') }
  let buffer = decoded.get(file)
  if (!buffer) {
    buffer = fetch(`${BASE}${file}`)
      .then((r) => r.arrayBuffer())
      .then((b) => out.ctx.decodeAudioData(b))
      .catch(() => null)
    decoded.set(file, buffer)
  }
  const audio = await buffer
  if (!audio) return { state: 'missing', ended: Promise.resolve('missing') }
  if (gen !== generation) return { state: 'superseded', ended: Promise.resolve(false) }
  stopCurrent()
  const src = out.ctx.createBufferSource()
  src.buffer = audio
  src.connect(out.out)
  const ended = new Promise<ClipResult>((resolve) => {
    src.onended = () => {
      const natural = speaking === src
      if (natural) {
        speaking = null
        duckSoundscape(false)
      }
      resolve(natural)
    }
  })
  duckSoundscape(true)
  src.start()
  speaking = src
  return { state: 'playing', ended }
}

/**
 * Dice una frase (corta la anterior). false si no tiene audio o no hay audio en el navegador; si
 * otra voz la adelanta antes de sonar, true (no hay nada que sustituir).
 */
export async function speak(text: string): Promise<boolean> {
  const gen = ++generation
  return (await playClip(text, gen)).state !== 'missing'
}

/** Lee varias frases seguidas (p. ej. los pasos de un protocolo). true si llegó al final. */
export function speakSequence(texts: readonly string[], gapMs = 500): Promise<boolean> {
  const gen = ++generation
  stopCurrent()
  return runSequence(texts, async (t) => (await playClip(t, gen)).ended, {
    cancelled: () => gen !== generation,
    gapMs,
  })
}

/** Calla la voz (al cambiar de paso, terminar o salir). */
export function stopSpeaking(): void {
  generation++
  stopCurrent()
}
