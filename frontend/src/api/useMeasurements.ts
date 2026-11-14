import { api, serverNow, unwrap } from './client'
import { useLoad } from './useLoad'

const DAY_MS = 86_400_000

const getMeasurements = (memberId: number, indicatorId: string, from: string) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/measurements', {
      params: { path: { member_id: memberId }, query: { indicator_id: indicatorId, from } },
    }),
  )
export type Measurement = Awaited<ReturnType<typeof getMeasurements>>[number]

/**
 * Serie temporal de un indicador en los últimos `days` días
 * (`GET /members/{id}/measurements?indicator_id=&from=`), contados con la hora del servidor.
 */
export function useMeasurements(memberId: number | null, indicatorId: string, days: number) {
  return useLoad(
    () =>
      getMeasurements(
        memberId!,
        indicatorId,
        new Date(serverNow().getTime() - days * DAY_MS).toISOString(),
      ),
    [memberId, indicatorId, days],
    { enabled: memberId !== null },
  )
}
