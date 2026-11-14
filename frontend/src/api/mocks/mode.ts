/**
 * Conmutador mock/real (FS-04).
 *
 * Modo mock (todo el front funciona sin backend):
 *   - `VITE_USE_MOCKS=true npm run dev`, o
 *   - en el navegador: `?mocks=1` en la URL (se recuerda en localStorage; `?mocks=0` lo quita).
 *
 * Fallback (plan B de la demo): `VITE_MOCK_FALLBACK=true`. Si el servidor no responde, las
 * LECTURAS (GET) se sirven con datos de ejemplo y se muestra el banner "Datos de ejemplo".
 * Las ESCRITURAS nunca se simulan en fallback: fallan con NetworkError y el outbox las guarda.
 * Por defecto está desactivado: sin servidor, el front muestra "sin conexión", nunca datos
 * falsos como si fueran reales (principio "sin datos = desconocido").
 */

const STORAGE_KEY = 'ruok:mocks'

type Listener = () => void
const listeners = new Set<Listener>()
let fallbackActive = false

function notify() {
  for (const l of listeners) l()
}

export function subscribeMockStatus(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isMockMode(): boolean {
  if (import.meta.env.VITE_USE_MOCKS === 'true') return true
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

export function setMockMode(on: boolean): void {
  try {
    if (on) globalThis.localStorage?.setItem(STORAGE_KEY, 'on')
    else globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    // localStorage no disponible (modo privado): solo queda VITE_USE_MOCKS
  }
  notify()
}

/** Lee `?mocks=1` / `?mocks=0` de la URL al arrancar. */
export function initMockModeFromUrl(search = globalThis.location?.search ?? ''): void {
  const value = new URLSearchParams(search).get('mocks')
  if (value !== null) setMockMode(value !== '0' && value !== 'false')
}

export function isMockFallbackEnabled(): boolean {
  return import.meta.env.VITE_MOCK_FALLBACK === 'true'
}

/** true si alguna lectura se ha servido con datos de ejemplo porque el servidor no respondía. */
export function isFallbackActive(): boolean {
  return fallbackActive
}

export function setFallbackActive(active: boolean): void {
  if (fallbackActive !== active) {
    fallbackActive = active
    notify()
  }
}
