/**
 * Voz guía (FE-37): frases generadas antes con ElevenLabs (`scripts/voice/generate_voice.py`) y
 * empaquetadas en `public/voice/`. Sin internet: el manifiesto y los audios los sirve la propia
 * app. Suena por Web Audio y baja el paisaje sonoro mientras habla. Si una frase no tiene audio,
 * no suena nada: queda el texto en pantalla.
 *
 * Por idioma (FE-38): en español, `public/voice/manifest.json`; en inglés,
 * `public/voice/en/manifest.json` (mismas claves con el texto en inglés, audios en
 * `public/voice/en/`). Si un idioma no tiene manifiesto, no hay voz en ese idioma.
 *
 * Solo hay una voz a la vez: decir algo nuevo (o `stopSpeaking`) corta lo que sonaba, también una
 * lectura en secuencia.
 */
import { runSequence, type ClipResult } from './voice'
import { duckSoundscape, voiceOutput } from './soundscapes'
import { currentLang, type Lang } from '../../i18n/lang'

/** Carpeta de la voz del idioma activo (el español, en la raíz de `voice/`). */
function voiceBase(lang: Lang = currentLang()): string {
  return `${import.meta.env.BASE_URL}voice/${lang === 'es' ? '' : `${lang}/`}`
}

const manifests = new Map<Lang, Promise<Record<string, string>>>()
const decoded = new Map<string, Promise<AudioBuffer | null>>()
let speaking: AudioBufferSourceNode | null = null
/** Sube con cada frase o lectura nueva y con cada parada: lo anterior deja de sonar. */
let generation = 0

/** Texto → archivo de audio (vacío si no se han generado). */
export function voiceManifest(): Promise<Record<string, string>> {
  const lang = currentLang()
  let manifest = manifests.get(lang)
  if (!manifest) {
    // Si no hay manifiesto (aún sin audios en ese idioma) o falla la red, no se recuerda el
    // vacío: se vuelve a mirar la próxima vez (p. ej. tras generar las voces).
    manifest = fetch(`${voiceBase(lang)}manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((m: { texts?: Record<string, string> }) => m.texts ?? {})
      .catch(() => {
        manifests.delete(lang)
        return {}
      })
    manifests.set(lang, manifest)
  }
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
  const base = voiceBase()
  const file = (await voiceManifest())[text]
  const out = voiceOutput()
  if (!file || !out) return { state: 'missing', ended: Promise.resolve('missing') }
  const url = `${base}${file}`
  let buffer = decoded.get(url)
  if (!buffer) {
    buffer = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => out.ctx.decodeAudioData(b))
      .catch(() => null)
    decoded.set(url, buffer)
  }
  const audio = await buffer
  if (!audio) return { state: 'missing', ended: Promise.resolve('missing') }
  if (gen !== generation) return { state: 'superseded', ended: Promise.resolve(false) }
  // Si el navegador aún no deja sonar audio (contexto suspendido, sin un clic antes), no se
  // programa: quedaría en espera y sonaría de golpe al activarse el audio por otra cosa (p. ej.
  // al tocar un paisaje sonoro). Se intenta reanudar y, si no se puede, se trata como sin audio.
  if (out.ctx.state !== 'running') {
    await Promise.race([out.ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 300))])
    // (el estado puede haber cambiado tras `resume()`: se vuelve a leer)
    if ((out.ctx.state as AudioContextState) !== 'running' || gen !== generation) {
      return { state: 'missing', ended: Promise.resolve('missing') }
    }
  }
  stopCurrent()
  const src = out.ctx.createBufferSource()
  src.buffer = audio
  src.connect(out.out)
  // `onended` no llega si el navegador no deja sonar el audio (contexto suspendido): como mucho,
  // la duración del clip y un margen, para que nada se quede esperando para siempre.
  const ended = new Promise<ClipResult>((resolve) => {
    window.setTimeout(() => resolve(false), audio.duration * 1000 + 1500)
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

/**
 * Como `speak`, pero resuelve cuando la frase TERMINA de sonar (o enseguida si no tiene audio o
 * la corta otra). Para no pasar de paso mientras la voz sigue hablando.
 */
export async function speakToEnd(text: string): Promise<boolean> {
  const gen = ++generation
  const clip = await playClip(text, gen)
  if (clip.state === 'missing') return false
  await clip.ended
  return true
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
