import { api, unwrap } from './client'
import { loadCachedAssessment, saveAssessment } from '../offline/cache'
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
  return useLoad(
    async () => {
      const a = await getAssessment(memberId!)
      void saveAssessment(memberId!, a) // última evaluación, para verla sin conexión (FE-11)
      return a
    },
    [memberId],
    {
      enabled: memberId !== null,
      refreshMs,
      fallback: () => loadCachedAssessment<Assessment>(memberId!),
    },
  )
}
