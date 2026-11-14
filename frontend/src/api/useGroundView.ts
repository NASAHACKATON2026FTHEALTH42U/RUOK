import { useLiveRefresh } from '../realtime/events'
import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getGround = (envId: string) =>
  unwrap(
    api.GET('/api/v1/environments/{env_id}/alerts', {
      params: { path: { env_id: envId }, query: { view: 'ground' } },
    }),
  )
export type GroundView = Awaited<ReturnType<typeof getGround>>

/**
 * Vista de tierra (`GET /environments/{env}/alerts?view=ground`): solo lo ENTREGADO por el
 * enlace, filtrado por privacidad en el servidor. Al instante con los eventos (FE-29) que el
 * servidor ya filtra a "entregados" para responder/psych; y cada 15 s por si acaso.
 */
export function useGroundView(envId: string | null) {
  const r = useLoad(() => getGround(envId!), [envId], {
    enabled: envId !== null,
    refreshMs: 15_000,
  })
  useLiveRefresh({ types: ['alert.*', 'link.*', 'liveness.changed'], envId }, r.refresh)
  return r
}
