import { useLiveRefresh } from '../realtime/events'
import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getHomeMessages = (memberId: number) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/home-messages', {
      params: { path: { member_id: memberId } },
    }),
  )

/** Cada cuánto se vuelve a pedir el hilo: los estados cambian solos con el reloj del enlace. */
const REFRESH_MS = 5_000

/**
 * Hilo de "Mensaje a casa" de un member (`GET /members/{id}/home-messages`, BE-22): lo enviado
 * con su estado en el enlace y las respuestas ya entregadas a bordo. Se refresca cada 5 s (el
 * fast-forward de la demo mueve las ETA) y al instante con los eventos del enlace.
 */
export function useHomeMessages(memberId: number | null, envId: string | null) {
  const r = useLoad(() => getHomeMessages(memberId!), [memberId], {
    enabled: memberId !== null,
    refreshMs: REFRESH_MS,
  })
  useLiveRefresh({ types: ['link.*'], envId }, r.refresh)
  return r
}
