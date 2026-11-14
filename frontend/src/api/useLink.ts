import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getLink = (envId: string) =>
  unwrap(api.GET('/api/v1/link', { params: { query: { env: envId } } }))
export type LinkStatus = Awaited<ReturnType<typeof getLink>>

/** Estado del enlace simulado con tierra / control externo (`GET /link?env=`). */
export function useLink(envId: string | null, refreshMs?: number) {
  return useLoad(() => getLink(envId!), [envId], { enabled: envId !== null, refreshMs })
}
