/**
 * Lógica pura del test de orientación de líneas (FE-39), inspirado en el «Line Orientation Test»
 * de la batería Cognition de la NASA y en el abanico de Benton. Sin React, para poder testearla.
 */

export const LINE_TRIALS = 10
/** Tiempo de referencia para la parte de velocidad de la puntuación. */
export const LINE_SPEED_REF_MS = 5000

export interface LineLevel {
  /** Separación entre las líneas del abanico, en grados. */
  step: number
  /** Número de líneas del abanico (empiezan en `step` y no llegan a 180°: sin duplicados). */
  count: number
  /** Longitud de la línea objetivo respecto al radio del abanico (más corta = más difícil). */
  length: number
}

/** Dificultad creciente: más líneas, más juntas y un objetivo más corto. */
export function levelFor(trial: number): LineLevel {
  if (trial < 3) return { step: 18, count: 9, length: 0.9 }
  if (trial < 7) return { step: 16, count: 10, length: 0.6 }
  return { step: 15, count: 11, length: 0.35 }
}

/** Ángulos (grados, 0° = horizontal, sentido antihorario) de las líneas del abanico. */
export function fanAngles(level: LineLevel): number[] {
  return Array.from({ length: level.count }, (_, i) => level.step * (i + 1))
}

export interface LineTrial {
  level: LineLevel
  angles: number[]
  /** Índice de la línea correcta en `angles`. */
  answer: number
}

/** Genera un ensayo; evita repetir la respuesta del ensayo anterior. */
export function makeTrial(trial: number, prevAnswer: number | null, rng = Math.random): LineTrial {
  const level = levelFor(trial)
  const angles = fanAngles(level)
  let answer = Math.floor(rng() * angles.length)
  if (answer === prevAnswer)
    answer = (answer + 1 + Math.floor(rng() * (angles.length - 1))) % angles.length
  return { level, angles, answer }
}

export interface LineResponse {
  correct: boolean
  rtMs: number
}

export interface LineScore {
  score: number
  correct: number
  total: number
  meanRtMs: number
}

/** Puntuación 0–100: 85 % aciertos + 15 % velocidad (tiempo medio frente a 5 s). */
export function scoreLine(responses: LineResponse[]): LineScore {
  const total = responses.length
  if (total === 0) return { score: 0, correct: 0, total: 0, meanRtMs: 0 }
  const correct = responses.filter((r) => r.correct).length
  const meanRtMs = Math.round(responses.reduce((s, r) => s + r.rtMs, 0) / total)
  const speed = Math.min(1, Math.max(0, 1 - meanRtMs / LINE_SPEED_REF_MS))
  const score = Math.round(100 * (0.85 * (correct / total) + 0.15 * speed))
  return { score, correct, total, meanRtMs }
}
