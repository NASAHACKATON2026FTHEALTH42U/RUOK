/**
 * Lógica pura del modo guiado de las intervenciones (FE-20). Los pasos son texto del catálogo
 * (`interventions.json`, contenido en CNT-03): aquí solo se interpretan para el temporizador.
 * - "Inhala 4 s" / "Camina 2 min" → paso con cuenta atrás.
 * - "Repite 4 ciclos" → repite los pasos anteriores hasta completar 4 ciclos.
 * - Cualquier otro texto → paso manual ("Siguiente").
 */

export interface GuidedStep {
  text: string
  /** Duración del paso; `null` = paso manual. */
  seconds: number | null
  /** Ciclo actual y total, si el paso forma parte de una repetición. */
  cycle: { n: number; of: number } | null
}

const DURATION = /(\d+(?:[.,]\d+)?)\s*(s|seg|segundos?|min|minutos?)\b/i
const REPEAT = /^\s*repite\b.*?(\d+)\s*(ciclos?|veces)/i

/** Segundos que indica el texto de un paso ("Inhala 4 s" → 4, "Camina 2 min" → 120), o null. */
export function stepSeconds(text: string): number | null {
  const m = DURATION.exec(text)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  return Math.round(m[2].toLowerCase().startsWith('m') ? n * 60 : n)
}

/** Despliega los pasos del catálogo en la secuencia que sigue el temporizador. */
export function expandSteps(steps: readonly string[]): GuidedStep[] {
  const out: GuidedStep[] = []
  let block: string[] = []
  for (const text of steps) {
    const rep = REPEAT.exec(text)
    if (rep && block.length > 0) {
      const of = Math.max(1, Number(rep[1]))
      // El bloque ya se ha añadido una vez como ciclo 1: se marca y se añaden los demás.
      const start = out.length - block.length
      for (let i = start; i < out.length; i++) out[i] = { ...out[i], cycle: { n: 1, of } }
      for (let n = 2; n <= of; n++) {
        for (const t of block) out.push({ text: t, seconds: stepSeconds(t), cycle: { n, of } })
      }
      block = []
      continue
    }
    out.push({ text, seconds: stepSeconds(text), cycle: null })
    block.push(text)
  }
  return out
}

export type BreathPhase = 'in' | 'hold' | 'out'

/** Fase de respiración del paso, para animar el círculo (inhala → crece, exhala → encoge). */
export function breathPhase(text: string): BreathPhase | null {
  const t = text.trim().toLowerCase()
  if (/^(inhala|inspira)/.test(t)) return 'in'
  if (/^(exhala|espira|suelta el aire)/.test(t)) return 'out'
  if (/^(mantén|manten|aguanta|retén)/.test(t)) return 'hold'
  return null
}
