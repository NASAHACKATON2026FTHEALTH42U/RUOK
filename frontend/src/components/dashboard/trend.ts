/** Lógica pura de TrendChart (fácil de testear). */

/** Periodos disponibles en días. */
export const PERIODS = [7, 30] as const
export type Period = (typeof PERIODS)[number]

export interface TrendPoint {
  /** Milisegundos (eje X temporal). */
  t: number
  value: number
}

/** `IndicatorAssessment.range` (openapi-fetch tipa las tuplas `[min, max]` como `number[]`). */
export type Ranges = Record<string, number[]>

/** Mediciones → puntos ordenados por fecha. */
export function toPoints(ms: { taken_at: string; value: number }[]): TrendPoint[] {
  return ms.map((m) => ({ t: Date.parse(m.taken_at), value: m.value })).sort((a, b) => a.t - b.t)
}

/** Bandas sombreadas: normal y atención (las que existan en el rango del entorno). */
export function bands(range: Ranges): { kind: 'normal' | 'warning'; y1: number; y2: number }[] {
  return (['normal', 'warning'] as const)
    .filter((k) => Array.isArray(range[k]) && range[k].length >= 2)
    .map((k) => ({ kind: k, y1: range[k][0], y2: range[k][1] }))
}

/**
 * Dominio del eje Y: cubre los datos y las bandas, con un 8 % de margen y redondeado a números
 * limpios, para que las bandas y la línea siempre se vean enteras.
 */
export function yDomain(points: TrendPoint[], range: Ranges): [number, number] {
  const values = [...points.map((p) => p.value), ...bands(range).flatMap((b) => [b.y1, b.y2])]
  if (values.length === 0) return [0, 1]
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const pad = (hi - lo) * 0.08
  const step = niceStep(hi - lo)
  return [Math.floor((lo - pad) / step) * step, Math.ceil((hi + pad) / step) * step]
}

/** Marcas del eje Y: múltiplos del mismo paso redondo que usa `yDomain` (p. ej. 40, 60, 80…). */
export function yTicks([lo, hi]: [number, number]): number[] {
  const step = niceStep(hi - lo)
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1e6; v += step) {
    ticks.push(Number(v.toFixed(6)))
  }
  return ticks
}

function niceStep(span: number): number {
  const raw = span / 5
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
}

/** Etiqueta corta de fecha para el eje: "14/11". */
export function formatDay(t: number): string {
  const d = new Date(t)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/** Fecha y hora para el tooltip y la tabla: "14/11 10:05". */
export function formatDateTime(t: number): string {
  const d = new Date(t)
  return `${formatDay(t)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
