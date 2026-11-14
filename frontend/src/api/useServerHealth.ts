import { useEffect, useState } from 'react'
import { api, NetworkError, unwrap, type Schema } from './client'

export type ServerHealth =
  | { state: 'checking' }
  | { state: 'online'; health: Schema<'HealthResponse'> }
  | { state: 'offline'; error: string }

/** Comprueba periódicamente `GET /health` del servidor de a bordo. */
export function useServerHealth(intervalMs = 15_000): ServerHealth {
  const [status, setStatus] = useState<ServerHealth>({ state: 'checking' })

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const health = await unwrap(api.GET('/api/v1/health'))
        if (!cancelled) setStatus({ state: 'online', health })
      } catch (err) {
        if (cancelled) return
        const error = err instanceof NetworkError ? 'sin conexión' : String(err)
        setStatus({ state: 'offline', error })
      }
    }
    void check()
    const id = setInterval(check, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return status
}
