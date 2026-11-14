/** Lógica pura del tiempo real (FE-29): qué eventos interesan a cada vista. */
import type { Schema } from '../api/client'

export type RealtimeEvent = Schema<'Event'>
export type EventType = Schema<'EventType'>

export interface EventFilter {
  /** Tipos exactos o prefijos con comodín: `alert.*`, `link.*`. */
  types: (EventType | `${string}.*`)[]
  memberId?: number | null
  envId?: string | null
}

/** ¿Afecta este evento a la vista? `null` = "tic" del polling: refrescar siempre. */
export function matches(event: RealtimeEvent | null, f: EventFilter): boolean {
  if (event === null) return true
  const typeOk = f.types.some((t) =>
    t.endsWith('.*') ? event.type.startsWith(t.slice(0, -1)) : event.type === t,
  )
  if (!typeOk) return false
  if (f.memberId != null && event.member_id != null && event.member_id !== f.memberId) return false
  if (f.envId != null && event.env_id != null && event.env_id !== f.envId) return false
  return true
}

/** Descarta repetidos: el stream reenvía los mismos ids al reconectar. */
export function isNew(id: number, lastId: number): boolean {
  return id > lastId
}

/** URL del stream SSE. EventSource no admite cabeceras: el token va en `?token=`. */
export function streamUrl(origin: string, token: string, envId: string | null): string {
  const q = new URLSearchParams({ token })
  if (envId) q.set('env_id', envId)
  return `${origin}/api/v1/events/stream?${q}`
}
