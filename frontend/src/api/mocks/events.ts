/**
 * Generador de eventos falsos para el feed del centro de control (FS-04).
 *
 * `EventSource` no pasa por fetch, así que en modo mock el cliente SSE (FE-29) usa esto
 * en lugar de conectarse a /events/stream:
 *
 *   const stop = createMockEventStream((ev) => console.log(ev), { intervalMs: 3000 })
 */
import type { Schema } from '../client'
import * as fx from './fixtures.gen'
import { mockNow } from './handlers'

type Event = Schema<'Event'>

/** Plantillas variadas a partir de los fixtures y de los members de ejemplo. */
function templates(): Omit<Event, 'id' | 'at'>[] {
  const members = Object.values(fx.membersByEnv).flat()
  const base = fx.events.map((e) => {
    const rest: Partial<Event> = { ...e }
    delete rest.id
    delete rest.at
    return rest as Omit<Event, 'id' | 'at'>
  })
  const heartbeats = members.map((m) => ({
    type: 'heartbeat' as const,
    env_id: m.env_id,
    member_id: m.id,
    user_id: null,
    device_id: null,
    ref_id: null,
    summary: `Heartbeat de ${m.name}`,
    payload: {},
  }))
  const tasks = members.slice(0, 2).map((m) => ({
    type: 'task.completed' as const,
    env_id: m.env_id,
    member_id: m.id,
    user_id: null,
    device_id: null,
    ref_id: null,
    summary: `${m.name} completó una misión diaria`,
    payload: {},
  }))
  return [...base, ...heartbeats, ...tasks]
}

export function createMockEventStream(
  onEvent: (event: Event) => void,
  { intervalMs = 3000, startId = 1000 }: { intervalMs?: number; startId?: number } = {},
): () => void {
  const pool = templates()
  let next = startId
  let i = 0
  const timer = setInterval(() => {
    const t = pool[i++ % pool.length]
    onEvent({ ...t, id: next++, at: mockNow().toISOString() })
  }, intervalMs)
  return () => clearInterval(timer)
}
