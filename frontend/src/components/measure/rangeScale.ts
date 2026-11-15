import type { Schema } from '../../api/client'
import { classify, type Ranges } from '../../offline/provisional'

type Status = Schema<'Status'>

const SAMPLES = 240

export interface Segment {
  status: Status
  from: number
  to: number
}

/** Dominio de la escala: los límites del campo o, si no, los umbrales con margen. */
export function domain(r: Ranges, min?: number | null, max?: number | null): [number, number] {
  const points = [
    ...(r.normal ?? []),
    ...(r.warning ?? []),
    r.critical_low ?? undefined,
    r.critical_high ?? undefined,
  ].filter((v): v is number => typeof v === 'number')
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const pad = (hi - lo) * 0.25 || 1
  const from = min ?? lo - pad
  const to = max ?? hi + pad
  // Si el campo admite valores muy lejanos (p. ej. 20–250 lpm), se recorta con margen.
  return [Math.max(from, lo - pad), Math.min(to, hi + pad)]
}

/** Tramos consecutivos con el mismo estado, clasificados con la misma regla que el motor. */
export function segments(r: Ranges, [from, to]: [number, number]): Segment[] {
  const out: Segment[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const a = from + ((to - from) * i) / SAMPLES
    const b = from + ((to - from) * (i + 1)) / SAMPLES
    const status = classify((a + b) / 2, r)
    const last = out[out.length - 1]
    if (last && last.status === status) last.to = b
    else out.push({ status, from: a, to: b })
  }
  return out
}
