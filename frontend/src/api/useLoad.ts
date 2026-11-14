import { useCallback, useEffect, useRef, useState } from 'react'
import { isUnavailable } from '../offline/cache'
import type { Loadable } from './useEnvironments'

interface LoadOptions<T> {
  /** Con false no pide nada (p. ej. sin member elegido). */
  enabled?: boolean
  /** Si se indica, recarga en segundo plano cada `refreshMs` sin volver a "loading". */
  refreshMs?: number
  /**
   * Sin red, datos guardados en el dispositivo (FE-11). Si devuelve algo, se muestran y
   * `refreshFailed` queda a true: la UI avisa de que pueden estar desfasados.
   */
  fallback?: () => Promise<T | undefined>
}

export type LoadResult<T> = Loadable<T> & {
  retry: () => void
  /** Recarga en segundo plano, sin volver a "loading" (p. ej. al llegar un evento, FE-29). */
  refresh: () => void
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
  { enabled = true, refreshMs, fallback }: LoadOptions<T> = {},
): LoadResult<T> {
  const [status, setStatus] = useState<Loadable<T>>({ state: 'loading' })
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load
  const fallbackRef = useRef(fallback)
  fallbackRef.current = fallback
  const runRef = useRef<((background: boolean) => void) | null>(null)

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
        async (err: unknown) => {
          if (cancelled) return
          const cached =
            isUnavailable(err) && fallbackRef.current
              ? await fallbackRef.current().catch(() => undefined)
              : undefined
          if (cancelled) return
          if (cached !== undefined) {
            setStatus({ state: 'ready', data: cached })
            setRefreshFailed(true)
          } else if (background) setRefreshFailed(true)
          else setStatus({ state: 'error', error: String(err) })
        },
      )
    }
    runRef.current = run
    run(false)
    const id = refreshMs ? setInterval(() => run(true), refreshMs) : undefined
    return () => {
      cancelled = true
      runRef.current = null
      clearInterval(id)
    }
    // Las dependencias reales son `deps`; `load` se lee siempre de la ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled, refreshMs])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  const refresh = useCallback(() => runRef.current?.(true), [])
  return { ...status, retry, refresh, updatedAt, refreshFailed }
}
