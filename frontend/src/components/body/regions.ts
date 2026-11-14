import type { Liveness, Status } from '../ui/status'

/** Regiones que dibuja BodyFigure (`BodySystem.svg_region`). `halo` = radiación. */
export const BODY_REGIONS = [
  'brain',
  'eyes',
  'heart',
  'immune',
  'metabolic',
  'bones',
  'halo',
] as const
export type BodyRegion = (typeof BODY_REGIONS)[number]

export interface RegionState {
  region: BodyRegion
  systemId: string
  name: string
  /** Estado del sistema en la evaluación (`unknown` si no aparece). */
  status: Status
}

interface SystemLike {
  id: string
  name: string
  svg_region: string
}
interface SystemStatusLike {
  system_id: string
  status: Status
}

/**
 * Une el catálogo de sistemas (región del SVG) con la evaluación (estado).
 * Un sistema sin evaluación es `unknown`, nunca verde. Regiones sin sistema no se devuelven.
 */
export function buildRegions(systems: SystemLike[], assessed: SystemStatusLike[]): RegionState[] {
  const statusById = new Map(assessed.map((s) => [s.system_id, s.status]))
  return systems
    .filter((s): s is SystemLike & { svg_region: BodyRegion } =>
      (BODY_REGIONS as readonly string[]).includes(s.svg_region),
    )
    .map((s) => ({
      region: s.svg_region,
      systemId: s.id,
      name: s.name,
      status: statusById.get(s.id) ?? 'unknown',
    }))
}

/** Con liveness stale o lost, la figura entera se pinta en gris rayado. */
export function isFigureStale(liveness: Liveness): boolean {
  return liveness !== 'active'
}

/** "Sin datos desde hace 12 min" a partir de `last_seen_at` y la hora del servidor. */
export function formatSinceLabel(lastSeenAt: string | null | undefined, now: Date): string {
  if (!lastSeenAt) return 'Sin datos'
  const min = Math.max(0, Math.floor((now.getTime() - Date.parse(lastSeenAt)) / 60_000))
  if (min < 1) return 'Sin datos desde hace menos de 1 min'
  if (min < 60) return `Sin datos desde hace ${min} min`
  const h = Math.floor(min / 60)
  return `Sin datos desde hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`
}
