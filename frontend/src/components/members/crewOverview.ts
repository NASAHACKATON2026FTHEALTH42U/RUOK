/**
 * Lógica pura de la vista «Estado de {crew}» (/members, FE-35): orden por urgencia, recuento del
 * conjunto, densidad de las tarjetas según cuántos members hay y resumen de sistemas.
 */
import type { MemberSummary } from '../../api/useMembers'
import { translate } from '../../i18n/t'
import type { DisplayState, Status } from '../ui/status'

/** Cómo se pintan las tarjetas del conjunto: ricas (pocos), compactas o en filas (muchos). */
export type CrewDensity = 'rich' | 'compact' | 'rows'

/** Hasta 4, tarjetas ricas que llenan el hueco; hasta 12, compactas; más, una fila por member. */
export function densityFor(count: number): CrewDensity {
  if (count <= 4) return 'rich'
  if (count <= 12) return 'compact'
  return 'rows'
}

type Health = Pick<MemberSummary, 'overall_status' | 'liveness'>

/**
 * Estado que resume al member. Con el liveness degradado (`stale` o `lost`) y todo "normal", "Sin
 * datos": nunca verde sin datos frescos (CLAUDE.md, principio 2). El liveness se señala aparte.
 */
export function memberDisplayState({ overall_status, liveness }: Health): Status {
  return liveness !== 'active' && overall_status === 'normal' ? 'unknown' : overall_status
}

/** Urgencia para ordenar: crítico o sin contacto primero; luego atención, sin datos y normal. */
export function urgencyRank(m: Health): number {
  if (m.liveness === 'lost') return 0
  const rank: Record<Status, number> = { critical: 0, warning: 1, unknown: 2, normal: 3 }
  return rank[memberDisplayState(m)]
}

/** Lo más urgente primero; a igual urgencia, más alertas abiertas y después por nombre. */
export function sortByUrgency<T extends Health & Pick<MemberSummary, 'open_alerts' | 'name'>>(
  members: readonly T[],
): T[] {
  return [...members].sort(
    (a, b) =>
      urgencyRank(a) - urgencyRank(b) ||
      b.open_alerts - a.open_alerts ||
      a.name.localeCompare(b.name, 'es'),
  )
}

export interface CrewCounts {
  total: number
  /** Por estado resumido (el de `memberDisplayState`). */
  byState: Record<Status, number>
  /** Sin contacto (liveness `lost`), aparte: cuenta también en su estado de salud. */
  lost: number
  openAlerts: number
}

/** Recuento del conjunto para la franja de resumen. */
export function crewCounts(members: readonly (Health & Pick<MemberSummary, 'open_alerts'>)[]) {
  const counts: CrewCounts = {
    total: members.length,
    byState: { critical: 0, warning: 0, unknown: 0, normal: 0 },
    lost: 0,
    openAlerts: 0,
  }
  for (const m of members) {
    counts.byState[memberDisplayState(m)] += 1
    if (m.liveness === 'lost') counts.lost += 1
    counts.openAlerts += m.open_alerts
  }
  return counts
}

interface AssessedIndicator {
  indicator_id: string
  status: Status
  last_value: number | null
  unit: string
}

interface AssessedSystem {
  system_id: string
  status: Status
  indicators: readonly AssessedIndicator[]
}

export interface FlaggedSystem {
  systemId: string
  status: 'critical' | 'warning'
  /** El indicador que peor está del sistema (el que explica el estado), si lo hay. */
  indicator: { id: string; value: number | null; unit: string } | null
  /** Otros indicadores fuera de rango del mismo sistema. */
  more: number
}

export interface SystemsDigest {
  /** Sistemas en crítico o atención, lo peor primero. */
  flagged: FlaggedSystem[]
  /** Sistemas en rango según el último dato. */
  inRange: string[]
  /** Sistemas sin datos. */
  noData: string[]
}

const RANK: Record<Status, number> = { critical: 0, warning: 1, unknown: 2, normal: 3 }

/**
 * Resumen de los sistemas de una evaluación para la tarjeta del conjunto: los que hay que mirar
 * (con el indicador que lo explica), los que están en rango y los que no tienen datos.
 */
export function systemsDigest(systems: readonly AssessedSystem[]): SystemsDigest {
  const digest: SystemsDigest = { flagged: [], inRange: [], noData: [] }
  for (const s of systems) {
    if (s.status === 'normal') digest.inRange.push(s.system_id)
    else if (s.status === 'unknown') digest.noData.push(s.system_id)
    else {
      const out = s.indicators
        .filter((i) => i.status === 'critical' || i.status === 'warning')
        .sort((a, b) => RANK[a.status] - RANK[b.status])
      const worst = out[0]
      digest.flagged.push({
        systemId: s.system_id,
        status: s.status,
        indicator: worst
          ? { id: worst.indicator_id, value: worst.last_value, unit: worst.unit }
          : null,
        more: Math.max(0, out.length - 1),
      })
    }
  }
  digest.flagged.sort((a, b) => RANK[a.status] - RANK[b.status])
  return digest
}

/**
 * Member que se ve en la vista individual: el activo (el del selector global) si es de este
 * entorno; si no, el más urgente. `null` si no hay members.
 */
export function pickIndividual<
  T extends Health & Pick<MemberSummary, 'id' | 'open_alerts' | 'name'>,
>(members: readonly T[], activeId: number | null): number | null {
  if (activeId !== null && members.some((m) => m.id === activeId)) return activeId
  return sortByUrgency(members)[0]?.id ?? null
}

/** Etiqueta de los recuentos («1 crítico», «2 en atención»…), en singular o plural. */
export function countLabel(state: DisplayState, n: number): string {
  const one: Record<string, string> = {
    critical: '{n} crítico',
    warning: '{n} en atención',
    unknown: '{n} sin datos',
    normal: '{n} normal',
    lost: '{n} sin contacto',
  }
  const many: Record<string, string> = {
    critical: '{n} críticos',
    warning: '{n} en atención',
    unknown: '{n} sin datos',
    normal: '{n} normales',
    lost: '{n} sin contacto',
  }
  const key = (n === 1 ? one : many)[state]
  return key ? translate(key, { n }) : `${n} ${state}`
}
