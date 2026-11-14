import type { Schema } from '../api/client'
import type { Assessment } from '../api/useAssessment'
import type { Environment } from '../api/useEnvironments'
import type { Indicator } from '../api/useIndicators'

/**
 * Semáforo provisional sin conexión (FE-12, docs/offline-and-liveness.md §1b).
 * Con las mediciones aún no sincronizadas y los rangos en caché (catálogo de indicadores +
 * `threshold_overrides` del entorno) se calcula un estado preliminar marcado como
 * "provisional". En cuanto el servidor devuelve su evaluación, esta lo sustituye.
 *
 * `classify()` y `mergeRanges()` son un ESPEJO de `backend/app/services/assessment.py`
 * (mismas reglas): si cambian allí, hay que cambiarlas aquí. Los umbrales no están en el
 * código: salen de los catálogos cacheados.
 */

type Status = Schema<'Status'>

export interface Ranges {
  normal?: readonly [number, number] | number[] | null
  warning?: readonly [number, number] | number[] | null
  critical_low?: number | null
  critical_high?: number | null
}

/** Rangos del catálogo con el override del entorno encima, clave a clave (como `merge_ranges`). */
export function mergeRanges(catalog: Ranges, override?: Ranges | null): Ranges {
  const out: Ranges = { ...catalog }
  if (override) {
    for (const [k, v] of Object.entries(override) as [keyof Ranges, never][]) {
      if (v !== null && v !== undefined) out[k] = v
    }
  }
  return out
}

const inBand = (v: number, band: Ranges['normal']) => band != null && band[0] <= v && v <= band[1]

/** Clasifica un valor contra unos rangos ya fusionados (mismas reglas que el backend). */
export function classify(value: number, r: Ranges): Status {
  if (
    (r.critical_low != null && value <= r.critical_low) ||
    (r.critical_high != null && value >= r.critical_high)
  ) {
    return 'critical'
  }
  if (inBand(value, r.normal)) return 'normal'
  if (inBand(value, r.warning)) return 'warning'
  if (r.normal != null && r.warning != null) {
    const highSide = r.warning[0] > r.normal[1]
    const lowSide = r.warning[1] < r.normal[0]
    if ((highSide && value > r.warning[1]) || (lowSide && value < r.warning[0])) return 'critical'
  }
  if (r.normal == null && r.warning == null) return 'unknown'
  return 'warning'
}

// `unknown` por encima de `normal`: sin datos nunca se resume como normal.
const SEVERITY: Record<Status, number> = { normal: 0, unknown: 1, warning: 2, critical: 3 }

export function worst(statuses: Status[]): Status {
  return statuses.reduce<Status>((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), 'normal')
}

/** Medición del dispositivo aún sin sincronizar (store `measurements`, `synced: false`). */
export interface LocalMeasurement {
  indicator_id: string
  value: number
  taken_at: string
}

export interface ProvisionalResult {
  assessment: Assessment
  /** Indicadores cuyo estado se ha calculado en el dispositivo. */
  provisionalIds: Set<string>
}

/**
 * Aplica sobre la última evaluación del servidor las mediciones locales más recientes que la
 * que ya conoce: valor, hora y estado provisional del indicador; el sistema y el estado general
 * se recalculan como "el peor". Sin mediciones nuevas, devuelve la evaluación tal cual.
 */
export function applyProvisional(
  assessment: Assessment,
  local: readonly LocalMeasurement[],
  indicators: readonly Indicator[],
  env: Pick<Environment, 'threshold_overrides'> | undefined,
): ProvisionalResult {
  const catalog = new Map(indicators.map((i) => [i.id, i]))
  // La más reciente de cada indicador.
  const latest = new Map<string, LocalMeasurement>()
  for (const m of local) {
    const prev = latest.get(m.indicator_id)
    if (!prev || m.taken_at > prev.taken_at) latest.set(m.indicator_id, m)
  }

  const provisionalIds = new Set<string>()
  const systems = assessment.systems.map((s) => {
    let changed = false
    const inds = s.indicators.map((ind) => {
      const m = latest.get(ind.indicator_id)
      const def = catalog.get(ind.indicator_id)
      if (!m || !def) return ind
      if (ind.taken_at && Date.parse(m.taken_at) <= Date.parse(ind.taken_at)) return ind
      const ranges = mergeRanges(
        def.ranges as Ranges,
        env?.threshold_overrides?.[ind.indicator_id] as Ranges | undefined,
      )
      provisionalIds.add(ind.indicator_id)
      changed = true
      return {
        ...ind,
        last_value: m.value,
        taken_at: m.taken_at,
        status: classify(m.value, ranges),
      }
    })
    return changed ? { ...s, indicators: inds, status: worst(inds.map((i) => i.status)) } : s
  })

  if (provisionalIds.size === 0) return { assessment, provisionalIds }

  let overall = worst(systems.map((s) => s.status))
  // El liveness también cuenta (overall = peor entre salud y liveness): sin contacto, se respeta
  // el estado general del servidor si es peor.
  if (assessment.liveness !== 'active') overall = worst([overall, assessment.overall_status])

  return {
    assessment: { ...assessment, systems, overall_status: overall, provisional: true },
    provisionalIds,
  }
}
