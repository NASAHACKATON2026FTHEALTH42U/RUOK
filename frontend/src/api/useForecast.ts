import { useRef } from 'react'
import { useLiveRefresh } from '../realtime/events'
import { api, ApiError, unwrap } from './client'
import { useLoad, type LoadResult } from './useLoad'

/** Cada cuánto se recalcula en segundo plano (además de al llegar una medición). */
const REFRESH_MS = 60_000

const getForecast = (memberId: number, indicatorId: string, horizonDays: number) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/forecast', {
      params: {
        path: { member_id: memberId },
        query: { indicator_id: indicatorId, horizon_days: horizonDays },
      },
    }),
  )
export type Forecast = Awaited<ReturnType<typeof getForecast>>

/**
 * Previsión estadística de un indicador (`GET /members/{id}/forecast`, FS-09). Es informativa:
 * una estimación, nunca un dato medido.
 * - `data` es `null` si quien consulta no puede verla (403: indicador conductual y privado).
 * - Se recalcula cada minuto y al instante con las mediciones nuevas del member (FE-29).
 * - Al cambiar de member, de indicador o de horizonte devuelve `loading` desde el primer
 *   render: la previsión anterior nunca se enseña como si fuera la del nuevo.
 */
export function useForecast(
  memberId: number | null,
  indicatorId: string | null,
  horizonDays = 7,
): LoadResult<Forecast | null> {
  const key = `${memberId}:${indicatorId}:${horizonDays}`
  // Clave de la última consulta lanzada: el estado de useLoad es el de esa consulta.
  const loadedKey = useRef<string | null>(null)
  const r = useLoad(
    async () => {
      loadedKey.current = key
      try {
        return await getForecast(memberId!, indicatorId!, horizonDays)
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return null
        throw err
      }
    },
    [memberId, indicatorId, horizonDays],
    { enabled: memberId !== null && indicatorId !== null, refreshMs: REFRESH_MS },
  )
  useLiveRefresh({ types: ['measurement.created', 'sync.batch'], memberId }, r.refresh)

  // useLoad pasa a `loading` en un efecto, después del primer render con la clave nueva: hasta
  // que lanza la consulta, su estado sigue siendo el de la anterior.
  if (loadedKey.current !== key) {
    return {
      state: 'loading',
      retry: r.retry,
      refresh: r.refresh,
      updatedAt: null,
      refreshFailed: false,
    }
  }
  return r
}
