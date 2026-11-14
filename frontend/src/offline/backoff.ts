/** Lógica pura del sincronizador (fácil de testear). */

const BASE_MS = 2_000
const MAX_MS = 60_000

/** Espera antes del intento `attempts` (1, 2, 3…): 2 s, 4 s, 8 s… con tope de 60 s. */
export function backoffMs(attempts: number): number {
  return Math.min(MAX_MS, BASE_MS * 2 ** Math.max(0, attempts - 1))
}

export type SyncOutcome = 'done' | 'retry' | 'failed' | 'pause'

/**
 * Qué hacer con una entrada según la respuesta:
 * - 2xx (incluido "duplicado") → `done`: se borra del outbox.
 * - sin red (status 0), 408, 429 o 5xx → `retry` con backoff.
 * - 401 → `pause`: se pide login y se reanuda; el outbox NUNCA se borra por un 401.
 * - resto de 4xx → `failed`: se conserva para revisarlo, sin reintentar en bucle.
 */
export function classify(status: number): SyncOutcome {
  if (status >= 200 && status < 300) return 'done'
  if (status === 401) return 'pause'
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'retry'
  return 'failed'
}

/** ¿Toca enviar ya esta entrada? */
export function isDue(entry: { status: string; next_retry_at: string }, nowMs: number): boolean {
  return entry.status === 'pending' && Date.parse(entry.next_retry_at) <= nowMs
}
