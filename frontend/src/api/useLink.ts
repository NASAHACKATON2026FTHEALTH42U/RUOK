import { api, unwrap } from './client'
import { useLiveRefresh } from '../realtime/events'
import { useLoad } from './useLoad'

const getLink = (envId: string) =>
  unwrap(api.GET('/api/v1/link', { params: { query: { env: envId } } }))
export type LinkStatus = Awaited<ReturnType<typeof getLink>>

/** Estado del enlace simulado con tierra / control externo (`GET /link?env=`). */
export function useLink(envId: string | null, refreshMs?: number) {
  const r = useLoad(() => getLink(envId!), [envId], { enabled: envId !== null, refreshMs })
  // Al instante con los eventos del enlace (FE-29).
  useLiveRefresh({ types: ['link.*'], envId }, r.refresh)
  return r
}
