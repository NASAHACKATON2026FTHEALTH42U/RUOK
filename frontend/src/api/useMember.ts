import { api, unwrap, type Schema } from './client'
import { useLoad } from './useLoad'

export type Member = Schema<'Member'>

/** Un member (`GET /members/{id}`; el propio member puede leer el suyo). Con null no pide nada. */
export function useMember(memberId: number | null) {
  return useLoad(
    () =>
      unwrap(
        api.GET('/api/v1/members/{member_id}', { params: { path: { member_id: memberId! } } }),
      ),
    [memberId],
    { enabled: memberId !== null },
  )
}
