import { useLiveRefresh } from '../realtime/events'
import { api, unwrap, type Schema } from './client'
import { useLoad } from './useLoad'

type EventType = Schema<'EventType'>

const getOverview = (envId: string | null) =>
  unwrap(api.GET('/api/v1/control/overview', { params: { query: envId ? { env_id: envId } : {} } }))
const getDevices = (envId: string | null) =>
  unwrap(api.GET('/api/v1/devices', { params: { query: envId ? { env_id: envId } : {} } }))
const getEvents = (envId: string | null, types: EventType[] | undefined, limit: number) =>
  unwrap(
    api.GET('/api/v1/events', {
      params: {
        query: {
          limit,
          order: 'desc',
          ...(envId ? { env_id: envId } : {}),
          ...(types?.length ? { type: types } : {}),
        },
      },
    }),
  )

export type ControlOverview = Awaited<ReturnType<typeof getOverview>>
export type EnvironmentOverview = ControlOverview['environments'][number]
export type Device = Awaited<ReturnType<typeof getDevices>>[number]

/**
 * Panorama del centro de control (`GET /control/overview`, admin). Con `envId`, solo ese entorno
 * y sus métricas: el operador no ve datos de otros entornos. Al instante con cualquier evento.
 */
export function useControlOverview(envId: string | null) {
  const r = useLoad(() => getOverview(envId), [envId], { refreshMs: 15_000 })
  useLiveRefresh(
    {
      types: ['measurement.*', 'liveness.*', 'alert.*', 'link.*', 'sync.*', 'heartbeat'],
      envId,
    },
    r.refresh,
  )
  return r
}

/** Dispositivos (`GET /devices?env_id=`, admin): los del entorno por su último usuario. */
export function useDevices(envId: string | null) {
  const r = useLoad(() => getDevices(envId), [envId], { refreshMs: 15_000 })
  useLiveRefresh({ types: ['device.*', 'sync.*', 'heartbeat', 'auth.login'] }, r.refresh)
  return r
}

/** Últimos eventos (`GET /events?order=desc`, admin), opcionalmente de unos tipos. */
export function useRecentEvents(envId: string | null, types?: EventType[], limit = 100) {
  return useLoad(() => getEvents(envId, types, limit), [envId, types?.join(','), limit])
}
