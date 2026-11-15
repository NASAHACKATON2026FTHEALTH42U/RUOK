/**
 * Lógica pura de la voz guía (FE-37), sin DOM ni audio: preferencia del dispositivo, lectura en
 * secuencia y énfasis de los textos. El audio está en `voiceGuide.ts`.
 */

/** Aviso de transparencia: la voz es sintética (clave en español: se pinta con `t(VOICE_NOTE)`). */
export const VOICE_NOTE = 'La voz guía está generada con IA (ElevenLabs).'

/** Preferencia «Voz guía» del dispositivo (vale para todas las partes guiadas). */
export const VOICE_KEY = 'ruok.voice'
/** Clave antigua, de cuando solo había voz en las meditaciones. */
export const LEGACY_VOICE_KEY = 'ruok.meditation.voice'

/** Lee la preferencia: la clave nueva, si no la antigua; por defecto, sí. */
export function prefFromStorage(get: (key: string) => string | null): boolean {
  const value = get(VOICE_KEY) ?? get(LEGACY_VOICE_KEY)
  return value !== 'off'
}

/** Resultado de decir una frase: terminó (true), se cortó (false) o no tiene audio. */
export type ClipResult = boolean | 'missing'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Dice las frases una detrás de otra, con una pausa entre ellas. Se salta las que no tienen
 * audio y para si se corta (otra voz, «Parar» o salir). true si llegó al final diciendo algo.
 */
export async function runSequence(
  texts: readonly string[],
  play: (text: string) => Promise<ClipResult>,
  {
    cancelled,
    gapMs = 500,
    sleep = wait,
  }: { cancelled: () => boolean; gapMs?: number; sleep?: (ms: number) => Promise<void> },
): Promise<boolean> {
  let spoke = false
  for (const [i, text] of texts.entries()) {
    if (cancelled()) return false
    const result = await play(text)
    if (result === 'missing') continue
    if (!result || cancelled()) return false
    spoke = true
    if (i < texts.length - 1) await sleep(gapMs)
  }
  return spoke && !cancelled()
}

/** Trozos de un texto con «…» resaltado (en pantalla, sin las comillas). */
export function emphasize(text: string): { text: string; strong: boolean }[] {
  return text
    .split(/«([^»]+)»/)
    .map((part, i) => ({ text: part, strong: i % 2 === 1 }))
    .filter((part) => part.text !== '')
}
