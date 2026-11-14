import { useLiveRefresh } from '../realtime/events'
import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getMemberAlerts = (memberId: number) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/alerts', { params: { path: { member_id: memberId } } }),
  )
export type Alert = Awaited<ReturnType<typeof getMemberAlerts>>[number]

/**
 * Alertas del member (`GET /members/{id}/alerts`): se refrescan al instante con los eventos
 * `alert.*` (FE-29) y, por si acaso, cada `refreshMs`.
 */
export function useMemberAlerts(memberId: number | null, refreshMs = 30_000) {
  const r = useLoad(() => getMemberAlerts(memberId!), [memberId], {
    enabled: memberId !== null,
    refreshMs,
  })
  useLiveRefresh({ types: ['alert.*'], memberId }, r.refresh)
  return r
}
