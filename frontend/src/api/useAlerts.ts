import { mergeMemberAlerts } from '../components/alerts/alertFormat'
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

/**
 * Alertas a bordo de todo el entorno (FE-35), para quien supervisa (admin, medic, commander):
 * las de cada member con su nombre, agregadas en el cliente con el mismo endpoint por member.
 * No es la vista de `/ground` (solo lo entregado por el enlace): aquí está todo lo de a bordo.
 */
export function useEnvironmentAlerts(
  envId: string | null,
  members: readonly { id: number; name: string }[] | null,
  refreshMs = 30_000,
) {
  const ids = members?.map((m) => m.id).join(',') ?? null
  const r = useLoad(
    async () =>
      mergeMemberAlerts(
        await Promise.all(
          members!.map(async (m) => ({
            memberId: m.id,
            memberName: m.name,
            alerts: await getMemberAlerts(m.id),
          })),
        ),
      ),
    [envId, ids],
    { enabled: envId !== null && members !== null, refreshMs },
  )
  useLiveRefresh({ types: ['alert.*'], envId }, r.refresh)
  return r
}

const getNotifications = (memberId: number) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/notifications', {
      params: { path: { member_id: memberId } },
    }),
  )

/** Notificaciones recibidas por el member (las más recientes primero), al instante con cada una. */
export function useNotifications(memberId: number | null) {
  const r = useLoad(() => getNotifications(memberId!), [memberId], { enabled: memberId !== null })
  useLiveRefresh({ types: ['notification.sent'], memberId }, r.refresh)
  return r
}
