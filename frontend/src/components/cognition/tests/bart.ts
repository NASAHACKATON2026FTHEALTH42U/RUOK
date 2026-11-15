/**
 * Lógica pura del BART (Balloon Analog Risk Task, Lejuez et al., 2002), FE-39.
 * Cada globo explota en un punto oculto, uniforme entre 1 y {@link MAX_PUMPS}: el bombeo que
 * alcanza ese punto lo revienta y se pierde lo acumulado en ese globo.
 */

/** Número de globos de la prueba. */
export const BALLOONS = 12
/** Punto de explosión máximo (uniforme 1–64). */
export const MAX_PUMPS = 64
/** Puntos por cada inflado. */
export const POINTS_PER_PUMP = 1

/** RNG determinista (mulberry32) para poder reproducir una prueba con su semilla. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = a
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** Puntos de explosión (1..max, uniformes) de `count` globos. */
export function explosionPoints(seed: number, count = BALLOONS, max = MAX_PUMPS): number[] {
  const rng = seededRng(seed)
  return Array.from({ length: count }, () => 1 + Math.floor(rng() * max))
}

/** ¿Revienta el globo al llegar a `pumps` inflados? */
export function pops(pumps: number, explosionPoint: number): boolean {
  return pumps >= explosionPoint
}

export interface BalloonOutcome {
  pumps: number
  popped: boolean
}

export interface BartScore {
  /** Puntos ganados (solo los globos cobrados). */
  total_points: number
  /** Media de inflados en los globos que no explotaron (0 si todos explotaron). */
  adjusted_pumps: number
  /** Globos explotados. */
  pops: number
  /** 0–100: ganancia frente a la esperada con la estrategia óptima. */
  score: number
}

/**
 * Ganancia esperada óptima por globo: con explosión uniforme 1..max, cobrar tras `n` inflados
 * da n·(max−n)/max, máxima en n = max/2.
 */
export function optimalExpectedPerBalloon(max = MAX_PUMPS): number {
  const n = Math.floor(max / 2)
  return (n * (max - n) * POINTS_PER_PUMP) / max
}

/**
 * Puntuación del BART. No premia «más riesgo»: arriesgar de más revienta globos y arriesgar de
 * menos gana poco. La nota es lo ganado frente a lo esperable con un riesgo equilibrado
 * (cobrar hacia la mitad), con tope en 100.
 */
export function scoreBart(outcomes: BalloonOutcome[], max = MAX_PUMPS): BartScore {
  const kept = outcomes.filter((o) => !o.popped)
  const total = kept.reduce((s, o) => s + o.pumps * POINTS_PER_PUMP, 0)
  const adjusted = kept.length ? kept.reduce((s, o) => s + o.pumps, 0) / kept.length : 0
  const reference = optimalExpectedPerBalloon(max) * Math.max(1, outcomes.length)
  return {
    total_points: total,
    adjusted_pumps: Math.round(adjusted * 10) / 10,
    pops: outcomes.length - kept.length,
    score: Math.max(0, Math.min(100, Math.round((100 * total) / reference))),
  }
}
