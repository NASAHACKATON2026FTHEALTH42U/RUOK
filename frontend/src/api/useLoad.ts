import { useCallback, useEffect, useRef, useState } from 'react'
import type { Loadable } from './useEnvironments'

interface LoadOptions {
  /** Con false no pide nada (p. ej. sin member elegido). */
  enabled?: boolean
  /** Si se indica, recarga en segundo plano cada `refreshMs` sin volver a "loading". */
  refreshMs?: number
}

export type LoadResult<T> = Loadable<T> & {
  retry: () => void
  /** Hora local de la última carga correcta. */
  updatedAt: Date | null
  /** La última recarga en segundo plano falló: los datos mostrados pueden estar desfasados. */
  refreshFailed: boolean
}

/**
 * Carga genérica: ejecuta `load` cuando cambian `deps` y expone loading / ready / error + retry.
 * Con `refreshMs`, refresca en segundo plano conservando los datos; si un refresco falla,
 * se mantiene lo último y `refreshFailed` lo indica (nunca se finge que está al día).
 */
export function useLoad<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
  { enabled = true, refreshMs }: LoadOptions = {},
): LoadResult<T> {
  const [status, setStatus] = useState<Loadable<T>>({ state: 'loading' })
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const run = (background: boolean) => {
      if (!background) setStatus({ state: 'loading' })
      loadRef.current().then(
        (data) => {
          if (cancelled) return
          setStatus({ state: 'ready', data })
          setUpdatedAt(new Date())
          setRefreshFailed(false)
        },
        (err: unknown) => {
          if (cancelled) return
          if (background) setRefreshFailed(true)
          else setStatus({ state: 'error', error: String(err) })
        },
      )
    }
    run(false)
    const id = refreshMs ? setInterval(() => run(true), refreshMs) : undefined
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // Las dependencias reales son `deps`; `load` se lee siempre de la ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled, refreshMs])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...status, retry, updatedAt, refreshFailed }
}
