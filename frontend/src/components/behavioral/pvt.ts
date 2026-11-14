import type { MeasurementIn } from '../../offline/outbox'

/**
 * Lógica pura del test de vigilancia psicomotora (PVT, FE-22; docs/behavioral-health.md).
 * Definición del test según [S12] de docs/sources.md (Basner & Dinges; Reaction Self Test de
 * la ISS): estímulo tras un intervalo aleatorio de 2–10 s, lapso = respuesta de más de 500 ms
 * y falso inicio = pulsar antes del estímulo o en menos de 100 ms.
 * Los rangos normal/aviso de los resultados NO están aquí: los aplica el backend desde el catálogo.
 */

/** Intervalo aleatorio entre estímulos (ms). */
export const ISI_MIN_MS = 2_000
export const ISI_MAX_MS = 10_000
/** Respuesta más lenta que esto = lapso. */
export const LAPSE_MS = 500
/** Respuesta más rápida que esto = anticipación (falso inicio): nadie reacciona tan rápido. */
export const FALSE_START_MS = 100

/** Duraciones: el test completo y la versión corta de la demo (el juez desde su móvil). */
export const PVT_MODES = {
  full: { durationMs: 180_000, label: 'Test completo', short: '3 min' },
  demo: { durationMs: 30_000, label: 'Versión demo', short: '30 s' },
} as const
export type PvtMode = keyof typeof PVT_MODES

/** Indicadores que produce el test (catálogo). */
export const PVT_INDICATORS = ['pvt_mean_rt_ms', 'pvt_lapses'] as const

/** Siguiente intervalo de espera, uniforme en [2, 10] s. `rand` ∈ [0, 1) (inyectable en tests). */
export function randomIsi(rand: () => number = Math.random): number {
  return Math.round(ISI_MIN_MS + rand() * (ISI_MAX_MS - ISI_MIN_MS))
}

/** Qué fue una respuesta, a partir de su tiempo de reacción (ms). */
export function classifyResponse(rtMs: number): 'false_start' | 'lapse' | 'ok' {
  if (rtMs < FALSE_START_MS) return 'false_start'
  return rtMs > LAPSE_MS ? 'lapse' : 'ok'
}

export interface PvtSummary {
  /** Respuestas válidas (sin falsos inicios). */
  responses: number
  /** Media de las respuestas válidas, en ms enteros; `null` si no hubo ninguna. */
  meanRtMs: number | null
  lapses: number
  /** Pulsaciones antes del estímulo o de menos de 100 ms. */
  falseStarts: number
}

/**
 * Resumen del test. `rts` son los tiempos de reacción medidos tras cada estímulo;
 * `earlyTaps`, las pulsaciones durante la espera (antes de que apareciera el estímulo).
 */
export function summarize(rts: readonly number[], earlyTaps: number): PvtSummary {
  const valid = rts.filter((rt) => classifyResponse(rt) !== 'false_start')
  const anticipations = rts.length - valid.length
  const mean = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null
  return {
    responses: valid.length,
    meanRtMs: mean,
    lapses: valid.filter((rt) => classifyResponse(rt) === 'lapse').length,
    falseStarts: earlyTaps + anticipations,
  }
}

/** Límites de entrada del catálogo (`indicator.input`), para no mandar un valor que dé 422. */
export interface Bounds {
  min?: number | null
  max?: number | null
}

const clamp = (v: number, b?: Bounds) =>
  Math.min(Math.max(v, b?.min ?? -Infinity), b?.max ?? Infinity)

/**
 * Lote del PVT: `pvt_mean_rt_ms` y `pvt_lapses`, con `source: "pvt"`, la misma hora y una nota
 * que resume el test. Vacío si no hubo ninguna respuesta válida (no hay nada que medir).
 */
export function buildPvtBatch(
  summary: PvtSummary,
  mode: PvtMode,
  takenAt: string,
  makeId: () => string,
  bounds: Partial<Record<(typeof PVT_INDICATORS)[number], Bounds>> = {},
): MeasurementIn[] {
  if (summary.meanRtMs === null) return []
  const m = PVT_MODES[mode]
  const note = `${m.label} (${m.short}) · ${summary.responses} respuestas · ${summary.falseStarts} falsos inicios`
  const base = { taken_at: takenAt, source: 'pvt' as const, note }
  return [
    {
      ...base,
      id: makeId(),
      indicator_id: 'pvt_mean_rt_ms',
      value: clamp(summary.meanRtMs, bounds.pvt_mean_rt_ms),
    },
    {
      ...base,
      id: makeId(),
      indicator_id: 'pvt_lapses',
      value: clamp(summary.lapses, bounds.pvt_lapses),
    },
  ]
}
