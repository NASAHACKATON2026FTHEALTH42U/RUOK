import { useCallback, useEffect, useState } from 'react'
import { api, unwrap, type Schema } from './client'
import type { Loadable } from './useEnvironments'

export type MemberSummary = Schema<'MemberSummary'>

/** Members de un entorno (`GET /environments/{env_id}/members`). Con `envId` null no pide nada. */
export function useMembers(
  envId: string | null,
): Loadable<MemberSummary[]> & { retry: () => void } {
  const [status, setStatus] = useState<Loadable<MemberSummary[]>>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!envId) return
    let cancelled = false
    setStatus({ state: 'loading' })
    unwrap(
      api.GET('/api/v1/environments/{env_id}/members', { params: { path: { env_id: envId } } }),
    ).then(
      (data) => !cancelled && setStatus({ state: 'ready', data }),
      (err: unknown) => !cancelled && setStatus({ state: 'error', error: String(err) }),
    )
    return () => {
      cancelled = true
    }
  }, [envId, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { ...status, retry }
}
