import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getAssessment = (memberId: number) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/assessment', {
      params: { path: { member_id: memberId } },
    }),
  )
export type Assessment = Awaited<ReturnType<typeof getAssessment>>

/** Evaluación del member (`GET /members/{id}/assessment`). Con `memberId` null no pide nada. */
export function useAssessment(memberId: number | null) {
  return useLoad(() => getAssessment(memberId!), [memberId], memberId !== null)
}
