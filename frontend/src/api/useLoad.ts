import { useCallback, useEffect, useState } from 'react'
import type { Loadable } from './useEnvironments'

/**
 * Carga genérica: ejecuta `load` cuando cambian `deps` y expone loading / ready / error + retry.
 * Con `enabled` a false no pide nada (p. ej. sin member elegido).
 */
export function useLoad<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  enabled = true,
): Loadable<T> & { retry: () => void } {
  const [status, setStatus] = useState<Loadable<T>>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setStatus({ state: 'loading' })
    load().then(
      (data) => !cancelled && setStatus({ state: 'ready', data }),
      (err: unknown) => !cancelled && setStatus({ state: 'error', error: String(err) }),
    )
    return () => {
      cancelled = true
    }
    // `load` se recrea en cada render; las dependencias reales son `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...status, retry }
}
