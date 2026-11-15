/**
 * Lógica pura del test de dígitos al revés (backward digit span, FE-39): generación de series,
 * corrección de la respuesta y avance adaptativo de la longitud. Sin React, para poder testearla.
 */

export const START_LENGTH = 3
export const MAX_LENGTH = 10
export const TRIALS_PER_LENGTH = 2

/** Serie de `length` dígitos (0–9) sin dos iguales seguidos. */
export function generateSequence(length: number, rand: () => number = Math.random): number[] {
  const seq: number[] = []
  for (let i = 0; i < length; i++) {
    if (i === 0) {
      seq.push(Math.min(9, Math.floor(rand() * 10)))
      continue
    }
    // Se elige entre los 9 dígitos distintos del anterior (sin reintentos).
    const prev = seq[i - 1]
    const d = Math.min(8, Math.floor(rand() * 9))
    seq.push(d >= prev ? d + 1 : d)
  }
  return seq
}

/** ¿La respuesta es la serie en orden inverso? */
export function isReverse(sequence: number[], answer: number[]): boolean {
  if (sequence.length !== answer.length) return false
  return sequence.every((d, i) => answer[sequence.length - 1 - i] === d)
}

/** Ms que se ve cada dígito: 900 hasta 4 dígitos y algo más rápido en series largas (mín. 700). */
export function digitMs(length: number): number {
  return Math.max(700, 900 - Math.max(0, length - 4) * 40)
}

/** Pausa en blanco entre dígitos. */
export function gapMs(length: number): number {
  return length >= 7 ? 200 : 250
}

export interface SpanState {
  length: number
  /** Intento actual dentro de la longitud (0 o 1). */
  trial: number
  /** Aciertos en la longitud actual. */
  hitsAtLength: number
  /** Longitud más larga superada (0 si ninguna). */
  span: number
  trials: number
  correct: number
  done: boolean
}

export function initialState(): SpanState {
  return {
    length: START_LENGTH,
    trial: 0,
    hitsAtLength: 0,
    span: 0,
    trials: 0,
    correct: 0,
    done: false,
  }
}

/**
 * Aplica el resultado de un intento. Dos intentos por longitud: si al menos uno es correcto se
 * supera y se pasa a la siguiente; con los dos fallados (o tras la longitud máxima) se acaba.
 */
export function advance(state: SpanState, ok: boolean): SpanState {
  if (state.done) return state
  const hitsAtLength = state.hitsAtLength + (ok ? 1 : 0)
  const next: SpanState = {
    ...state,
    trials: state.trials + 1,
    correct: state.correct + (ok ? 1 : 0),
    hitsAtLength,
  }
  if (state.trial + 1 < TRIALS_PER_LENGTH) return { ...next, trial: state.trial + 1 }
  if (hitsAtLength === 0) return { ...next, done: true }
  const span = Math.max(state.span, state.length)
  if (state.length >= MAX_LENGTH) return { ...next, span, done: true }
  return { ...next, span, length: state.length + 1, trial: 0, hitsAtLength: 0 }
}

/** Puntuación 0–100 a partir del span: 3 → 20 … 9 o más → 100 (0 si no se supera ninguna). */
export function scoreFromSpan(span: number): number {
  if (span < START_LENGTH) return 0
  return Math.min(100, Math.round(20 + ((span - START_LENGTH) * 80) / 6))
}
