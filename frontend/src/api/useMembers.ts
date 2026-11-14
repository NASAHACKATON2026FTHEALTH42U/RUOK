import { api, unwrap, type Schema } from './client'
import { useLiveRefresh } from '../realtime/events'
import { useLoad } from './useLoad'

export type MemberSummary = Schema<'MemberSummary'>

/** Members de un entorno (`GET /environments/{env_id}/members`). Con `envId` null no pide nada. */
export function useMembers(envId: string | null) {
  const r = useLoad(
    () =>
      unwrap(
        api.GET('/api/v1/environments/{env_id}/members', { params: { path: { env_id: envId! } } }),
      ),
    [envId],
    { enabled: envId !== null },
  )
  // Estado y alertas de la tripulación al instante (FE-29).
  useLiveRefresh(
    { types: ['liveness.changed', 'alert.*', 'measurement.created'], envId },
    r.refresh,
  )
  return r
}
