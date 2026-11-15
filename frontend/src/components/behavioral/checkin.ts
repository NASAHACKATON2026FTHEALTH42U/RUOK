import type { MeasurementIn } from '../../offline/outbox'

/**
 * Lógica pura del check-in diario "R U OK?" (FE-19, docs/behavioral-health.md).
 * Los textos, rangos y la polaridad (`higher_is_worse`) salen del catálogo de indicadores;
 * aquí solo está qué indicadores forman el check-in y cómo se pintan las caras.
 */

/** Indicadores del check-in, en el orden en que se preguntan (docs/behavioral-health.md). */
export const CHECKIN_INDICATORS = [
  'mood',
  'stress',
  'energy',
  'loneliness',
  'sleep_quality',
  'crew_relation',
] as const

/** Caras (iconos de línea) de peor a mejor bienestar. */
const FACES = ['mood-1', 'mood-2', 'mood-3', 'mood-4', 'mood-5'] as const
export type Face = (typeof FACES)[number]

/**
 * Cara para el valor `value` (1–5) de una escala. Si el indicador es "más es peor"
 * (estrés, soledad), la escala se invierte: 5 de estrés es la cara triste.
 */
export function faceFor(value: number, higherIsWorse: boolean): Face {
  const i = Math.min(Math.max(Math.round(value), 1), 5) - 1
  return FACES[higherIsWorse ? 4 - i : i]
}

/** Respuestas: indicador → valor 1–5 (sin entrada = sin responder). */
export type Answers = Partial<Record<string, number>>

/** Cuántas de las preguntas `ids` están respondidas. */
export function answeredCount(answers: Answers, ids: readonly string[]): number {
  return ids.filter((id) => answers[id] !== undefined).length
}

/**
 * Lote del check-in: una medición por respuesta, todas con `source: "checkin"`, la misma
 * hora y la nota (si la hay). Cada una con su UUID de cliente (idempotente al reintentar).
 */
export function buildCheckinBatch(
  answers: Answers,
  ids: readonly string[],
  note: string,
  takenAt: string,
  makeId: () => string,
): MeasurementIn[] {
  const n = note.trim() || null
  return ids
    .filter((id) => answers[id] !== undefined)
    .map((id) => ({
      id: makeId(),
      indicator_id: id,
      value: answers[id]!,
      taken_at: takenAt,
      source: 'checkin' as const,
      note: n,
    }))
}
