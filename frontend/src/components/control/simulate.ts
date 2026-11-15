/**
 * Lógica pura de la simulación del centro de control: qué escenarios corresponden al entorno (y al
 * member elegido) y qué valor proponer para provocar una medición normal, de aviso o crítica a
 * partir de los rangos de la configuración (nunca valores clínicos fijos en el código).
 */

/** Escenarios guionizados del backend (`POST /demo/scenarios/{name}`, ver app/seed.py). */
export interface Scenario {
  id: string
  envId: string
  /** Member al que afecta (ids del seed). */
  memberId: number
  label: string
  detail: string
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'mars_sleep_bp',
    envId: 'mars',
    memberId: 1,
    label: 'Mal sueño y tensión al alza',
    detail: 'Cinco días durmiendo cada vez menos y con la tensión sistólica subiendo.',
  },
  {
    id: 'eva_no_contact',
    envId: 'mars',
    memberId: 1,
    label: 'EVA sin contacto',
    detail: 'Sale de EVA y deja de dar señales hace 3 min: «R U OK?» y alerta de sin contacto.',
  },
  {
    id: 'geriatric_fall_risk',
    envId: 'geriatric',
    memberId: 17,
    label: 'Riesgo de caída',
    detail: 'Bebe poco, duerme mal, pierde peso y tiene la tensión baja.',
  },
]

/** Escenarios del entorno; con un member elegido, solo los suyos. */
export function scenariosFor(envId: string | null, memberId: number | null): Scenario[] {
  return SCENARIOS.filter(
    (s) => s.envId === envId && (memberId === null || s.memberId === memberId),
  )
}

export interface Ranges {
  normal: [number, number]
  warning: [number, number] | null
  critical_low: number | null
  critical_high: number | null
}

/** Rangos del indicador con los del entorno encima (`threshold_overrides`). */
export function effectiveRanges(base: Ranges, override?: Partial<Ranges> | null): Ranges {
  if (!override) return base
  return {
    normal: override.normal ?? base.normal,
    warning: override.warning !== undefined ? override.warning : base.warning,
    critical_low: override.critical_low !== undefined ? override.critical_low : base.critical_low,
    critical_high:
      override.critical_high !== undefined ? override.critical_high : base.critical_high,
  }
}

export type PresetKind = 'normal' | 'warning' | 'critical'

/**
 * Valor de ejemplo para provocar una medición normal, de aviso o crítica. El lado malo es el alto
 * si `higherIsWorse` o si solo hay umbral crítico alto; si no, el bajo cuando solo hay crítico bajo.
 */
export function presetValue(
  ranges: Ranges,
  higherIsWorse: boolean,
  kind: PresetKind,
  input: { min: number | null; max: number | null; step: number | null } = {
    min: null,
    max: null,
    step: null,
  },
): number {
  const [n0, n1] = ranges.normal
  const high = higherIsWorse || ranges.critical_high !== null || ranges.critical_low === null
  const span = Math.max(Math.abs(n1 - n0), Math.abs(n1) * 0.1, 1)
  let v: number
  if (kind === 'normal') v = (n0 + n1) / 2
  else if (kind === 'warning') {
    v = high
      ? ranges.warning
        ? (n1 + ranges.warning[1]) / 2
        : n1 + span * 0.15
      : ranges.warning
        ? (ranges.warning[0] + n0) / 2
        : n0 - span * 0.15
  } else {
    v = high
      ? (ranges.critical_high ?? ranges.warning?.[1] ?? n1) + span * 0.1
      : (ranges.critical_low ?? ranges.warning?.[0] ?? n0) - span * 0.1
  }
  const step = input.step ?? (Math.abs(n1 - n0) < 10 ? 0.1 : 1)
  v = Math.round(v / step) * step
  if (input.min !== null) v = Math.max(input.min, v)
  if (input.max !== null) v = Math.min(input.max, v)
  return Number(v.toFixed(2))
}
