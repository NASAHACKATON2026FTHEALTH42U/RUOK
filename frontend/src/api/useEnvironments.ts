import { useCallback, useEffect, useState } from 'react'
import { withCatalogCache } from '../offline/cache'
import { api, unwrap } from './client'

const getEnvironments = () => unwrap(api.GET('/api/v1/environments'))

/**
 * Entorno tal como lo devuelve el cliente. Se toma de la respuesta y no de `Schema<'Environment'>`
 * porque openapi-fetch infiere los rangos de umbral como `number[]` en lugar de tuplas.
 */
export type Environment = Awaited<ReturnType<typeof getEnvironments>>[number]

export type Loadable<T> =
  { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error'; error: string }

// Una sola petición compartida por todos los componentes (selector de la cabecera y página).
// Si falla, se descarta para que el siguiente intento vuelva a pedirla.
let cache: Promise<Environment[]> | null = null

function fetchEnvironments(): Promise<Environment[]> {
  cache ??= withCatalogCache('environments', getEnvironments)().catch((err: unknown) => {
    cache = null
    throw err
  })
  return cache
}

/** Catálogo de entornos (`GET /environments`). */
export function useEnvironments(): Loadable<Environment[]> & { retry: () => void } {
  const [status, setStatus] = useState<Loadable<Environment[]>>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchEnvironments().then(
      (data) => !cancelled && setStatus({ state: 'ready', data }),
      (err: unknown) => !cancelled && setStatus({ state: 'error', error: String(err) }),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setStatus({ state: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { ...status, retry }
}
