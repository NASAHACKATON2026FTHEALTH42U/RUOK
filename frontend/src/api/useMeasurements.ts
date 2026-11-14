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
 * Con `refreshMs` se refresca en segundo plano (el historial usa 15 s para ver lo nuevo).
 */
export function useMeasurements(
  memberId: number | null,
  indicatorId: string | null,
  days: number,
  refreshMs?: number,
) {
  return useLoad(
    () =>
      getMeasurements(
        memberId!,
        indicatorId!,
        new Date(serverNow().getTime() - days * DAY_MS).toISOString(),
      ),
    [memberId, indicatorId, days],
    { enabled: memberId !== null && indicatorId !== null, refreshMs },
  )
}

/**
 * Series de varios indicadores a la vez (una petición por indicador, en paralelo), para la
 * gráfica combinada de un sistema. Devuelve `{ indicador: mediciones }`.
 */
export function useMeasurementsMany(
  memberId: number | null,
  indicatorIds: readonly string[],
  days: number,
) {
  const key = indicatorIds.join(',')
  return useLoad(
    async () => {
      const from = new Date(serverNow().getTime() - days * DAY_MS).toISOString()
      const ids = key ? key.split(',') : []
      const all = await Promise.all(ids.map((id) => getMeasurements(memberId!, id, from)))
      return Object.fromEntries(ids.map((id, i) => [id, all[i]])) as Record<string, Measurement[]>
    },
    [memberId, key, days],
    { enabled: memberId !== null && key !== '' },
  )
}
