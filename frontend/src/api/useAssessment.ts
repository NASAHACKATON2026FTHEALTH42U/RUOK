import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getAssessment = (memberId: number) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/assessment', {
      params: { path: { member_id: memberId } },
    }),
  )
export type Assessment = Awaited<ReturnType<typeof getAssessment>>

/**
 * Evaluación del member (`GET /members/{id}/assessment`). Con `memberId` null no pide nada.
 * Con `refreshMs` se refresca en segundo plano (el dashboard usa 15 s).
 */
export function useAssessment(memberId: number | null, refreshMs?: number) {
  return useLoad(() => getAssessment(memberId!), [memberId], {
    enabled: memberId !== null,
    refreshMs,
  })
}
