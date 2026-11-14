import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getMemberAlerts = (memberId: number) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/alerts', { params: { path: { member_id: memberId } } }),
  )
export type Alert = Awaited<ReturnType<typeof getMemberAlerts>>[number]

/**
 * Alertas del member (`GET /members/{id}/alerts`), refrescadas cada `refreshMs`.
 * TODO(FE-29): actualizar por eventos SSE (alert.created / alert.updated) en lugar de consultar.
 */
export function useMemberAlerts(memberId: number | null, refreshMs = 10_000) {
  return useLoad(() => getMemberAlerts(memberId!), [memberId], {
    enabled: memberId !== null,
    refreshMs,
  })
}
