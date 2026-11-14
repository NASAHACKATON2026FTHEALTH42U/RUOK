import { useLiveRefresh } from '../realtime/events'
import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getOverview = () => unwrap(api.GET('/api/v1/control/overview'))
const getDevices = () => unwrap(api.GET('/api/v1/devices'))
const getEvents = () => unwrap(api.GET('/api/v1/events', { params: { query: { limit: 100 } } }))

export type ControlOverview = Awaited<ReturnType<typeof getOverview>>
export type Device = Awaited<ReturnType<typeof getDevices>>[number]

/** Panorama de todos los entornos (`GET /control/overview`, admin), al instante con cualquier evento. */
export function useControlOverview() {
  const r = useLoad(getOverview, [], { refreshMs: 15_000 })
  useLiveRefresh(
    { types: ['measurement.*', 'liveness.*', 'alert.*', 'link.*', 'sync.*', 'heartbeat'] },
    r.refresh,
  )
  return r
}

/** Dispositivos registrados (`GET /devices`, admin): pendientes en el outbox, última sincronización… */
export function useDevices() {
  const r = useLoad(getDevices, [], { refreshMs: 15_000 })
  useLiveRefresh({ types: ['device.*', 'sync.*', 'heartbeat', 'auth.login'] }, r.refresh)
  return r
}

/** Historial reciente de eventos (`GET /events`, admin) para arrancar el feed. */
export function useRecentEvents() {
  return useLoad(getEvents, [])
}
