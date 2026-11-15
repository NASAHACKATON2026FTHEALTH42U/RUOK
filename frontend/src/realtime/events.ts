import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { api, unwrap } from '../api/client'
import { createMockEventStream } from '../api/mocks/events'
import { isMockMode } from '../api/mocks/mode'
import {
  isNew,
  matches,
  streamUrl,
  type EventFilter,
  type EventType,
  type RealtimeEvent,
} from './match'

/**
 * Tiempo real (FE-29, docs/control-center-and-devices.md §3):
 * - Una conexión `EventSource` a `/events/stream?token=` por sesión. El navegador reconecta
 *   solo y reenvía `Last-Event-ID`; además se descartan ids repetidos.
 * - Si el stream no llega a abrir tras varios intentos → polling cada 5 s: el admin lee
 *   `/events?since_id=`; el resto recibe un "tic" que refresca las vistas suscritas.
 * - En modo mock, el generador de eventos de FS-04.
 */

const POLL_MS = 5_000
const MAX_FAILURES = 3

type Listener = (event: RealtimeEvent | null) => void
const listeners = new Set<Listener>()

interface RealtimeState {
  mode: 'off' | 'sse' | 'polling' | 'mock'
  lastEventAt: string | null
}
export const useRealtimeStore = create<RealtimeState>(() => ({ mode: 'off', lastEventAt: null }))

let source: EventSource | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let stopMock: (() => void) | null = null
let lastId = 0
let failures = 0

function emit(event: RealtimeEvent | null) {
  if (event) {
    if (!isNew(event.id, lastId)) return
    lastId = event.id
    useRealtimeStore.setState({ lastEventAt: event.at })
  }
  for (const l of listeners) l(event)
}

function stop() {
  source?.close()
  source = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  stopMock?.()
  stopMock = null
  useRealtimeStore.setState({ mode: 'off' })
}

function startPolling(isAdmin: boolean) {
  useRealtimeStore.setState({ mode: 'polling' })
  pollTimer = setInterval(async () => {
    if (!isAdmin) return emit(null)
    try {
      const events = await unwrap(
        api.GET('/api/v1/events', { params: { query: { since_id: lastId } } }),
      )
      events.forEach(emit)
    } catch {
      emit(null)
    }
  }, POLL_MS)
}

/** (Re)abre la conexión para esta sesión y entorno. Sin token, la cierra. */
export function startRealtime(token: string | null, envId: string | null, isAdmin: boolean) {
  stop()
  failures = 0
  if (!token) return
  if (isMockMode()) {
    stopMock = createMockEventStream(emit, { intervalMs: 4000, startId: lastId + 1 })
    useRealtimeStore.setState({ mode: 'mock' })
    return
  }
  if (typeof EventSource === 'undefined') return startPolling(isAdmin)

  const es = new EventSource(streamUrl(import.meta.env.VITE_API_ORIGIN ?? '', token, envId))
  source = es
  const onData = (m: MessageEvent) => {
    try {
      emit(JSON.parse(m.data) as RealtimeEvent)
    } catch {
      // mensaje mal formado: se ignora
    }
  }
  es.onmessage = onData
  for (const type of EVENT_TYPES) es.addEventListener(type, onData as EventListener)
  es.onopen = () => {
    failures = 0
    useRealtimeStore.setState({ mode: 'sse' })
  }
  es.onerror = () => {
    // Un cierre tras abrir es normal (el navegador reconecta). Si nunca llega a abrir, polling.
    failures += 1
    if (es.readyState === EventSource.CLOSED || failures >= MAX_FAILURES) {
      es.close()
      source = null
      startPolling(isAdmin)
    }
  }
}

// Todos los tipos del contrato (EventType): si se añade uno al contrato y no aquí, no compila
// (un tipo sin escuchar no llegaría nunca: el stream los envía con nombre).
const EVENT_TYPE_SET: Record<EventType, true> = {
  'measurement.created': true,
  heartbeat: true,
  'liveness.changed': true,
  'alert.created': true,
  'alert.escalated': true,
  'alert.acknowledged': true,
  'alert.resolved': true,
  'link.queued': true,
  'link.delivered': true,
  'link.state_changed': true,
  'sync.batch': true,
  'auth.login': true,
  'auth.failed': true,
  'task.completed': true,
  'device.registered': true,
  'user.created': true,
  'notification.sent': true,
}
const EVENT_TYPES = Object.keys(EVENT_TYPE_SET) as EventType[]

/** Escucha eventos (o el tic del polling). El handler más reciente se usa siempre. */
export function useEvents(filter: EventFilter, handler: (event: RealtimeEvent | null) => void) {
  const ref = useRef({ filter, handler })
  ref.current = { filter, handler }
  useEffect(() => {
    const l: Listener = (e) => {
      if (matches(e, ref.current.filter)) ref.current.handler(e)
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
}

/** Refresca una vista (p. ej. `retry` de useLoad) cuando llega un evento que la afecta. */
export function useLiveRefresh(filter: EventFilter, refresh: () => void) {
  useEvents(filter, () => refresh())
}
