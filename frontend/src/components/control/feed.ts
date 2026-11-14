/** Lógica pura del feed de eventos del centro de control (FE-31). */
import type { RealtimeEvent } from '../../realtime/match'

export interface FeedFilters {
  envId: string
  userId: string
  deviceId: string
  /** Grupo de tipos: 'alert', 'measurement', 'link'… o '' para todos. */
  group: string
}

export const EMPTY_FILTERS: FeedFilters = { envId: '', userId: '', deviceId: '', group: '' }

/** Grupos de tipos para el filtro y el icono del feed. */
export const GROUPS: Record<string, { label: string; icon: string }> = {
  measurement: { label: 'Mediciones', icon: '📝' },
  heartbeat: { label: 'Heartbeats', icon: '💓' },
  liveness: { label: 'Liveness', icon: '📶' },
  alert: { label: 'Alertas', icon: '🚨' },
  link: { label: 'Enlace', icon: '📡' },
  sync: { label: 'Sincronización', icon: '⇡' },
  auth: { label: 'Accesos', icon: '🔐' },
  task: { label: 'Misiones', icon: '🎯' },
  device: { label: 'Dispositivos', icon: '📱' },
}

export function groupOf(type: string): string {
  return type.split('.')[0]
}

/** Añade eventos nuevos sin duplicar (por id), del más reciente al más antiguo, con tope. */
export function mergeEvents(
  current: RealtimeEvent[],
  incoming: RealtimeEvent[],
  max = 300,
): RealtimeEvent[] {
  const byId = new Map(current.map((e) => [e.id, e]))
  for (const e of incoming) byId.set(e.id, e)
  return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, max)
}

export function filterEvents(events: RealtimeEvent[], f: FeedFilters): RealtimeEvent[] {
  return events.filter(
    (e) =>
      (!f.envId || e.env_id === f.envId) &&
      (!f.userId || String(e.user_id) === f.userId) &&
      (!f.deviceId || e.device_id === f.deviceId) &&
      (!f.group || groupOf(e.type) === f.group),
  )
}

/** Tiempo medio de respuesta legible: "3 min 20 s", "—". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`
}
