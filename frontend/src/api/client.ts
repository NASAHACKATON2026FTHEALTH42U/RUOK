/**
 * Cliente tipado de la API de RUOK (FS-03).
 *
 * - Tipos generados desde el OpenAPI: `npm run gen:api` → ./types.gen.ts (no editar a mano).
 * - Cliente `openapi-fetch`: ruta, método, parámetros, cuerpo y respuesta tipados.
 * - Base: mismo origen por defecto (`/api/v1/...`). En desarrollo, Vite hace de proxy de `/api`
 *   al backend (vite.config.ts), así que funciona igual desde un móvil en la red local.
 *
 * Uso:
 *   const assessment = await unwrap(
 *     api.GET('/api/v1/members/{member_id}/assessment', { params: { path: { member_id: 1 } } }),
 *   )
 *
 * Toda ESCRITURA de datos del member debe pasar por el outbox (src/offline/, FE-11),
 * que usa este cliente por debajo.
 *
 * Mocks (FS-04, ver ./mocks/mode.ts): con `VITE_USE_MOCKS=true` o `?mocks=1` todas las
 * peticiones se resuelven en memoria. Con `VITE_MOCK_FALLBACK=true`, solo las lecturas (GET)
 * caen a mocks si el servidor no responde; las escrituras siempre lanzan NetworkError.
 */
import createClient, { type Middleware } from 'openapi-fetch'
import { currentLang } from '../i18n/lang'
import { mockFetch } from './mocks/mockFetch'
import { isMockFallbackEnabled, isMockMode, setFallbackActive } from './mocks/mode'
import type { components, paths } from './types.gen'
import { translate } from '../i18n/t'

export type { components, paths }
/** Atajo para los schemas del contrato: `Schema<'Assessment'>`. */
export type Schema<K extends keyof components['schemas']> = components['schemas'][K]

// ── Errores ──────────────────────────────────────────────────

/** El servidor respondió con un error HTTP (4xx/5xx). `detail` viene de FastAPI. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  readonly body: unknown

  constructor(status: number, body: unknown) {
    const detail = extractDetail(body) ?? `HTTP ${status}`
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.body = body
  }
}

/** No se pudo contactar con el servidor de a bordo. El outbox reintenta más tarde. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(translate('Sin conexión con el servidor de a bordo'), { cause })
    this.name = 'NetworkError'
  }
}

function extractDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('detail' in body)) return null
  const { detail } = body as { detail: unknown }
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    // Errores de validación 422: [{loc, msg, type}, ...]
    return detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : String(d)))
      .join('; ')
  }
  return null
}

// ── Configuración que inyectan otras piezas ─────────────────

interface ApiHooks {
  /** Token JWT de la sesión (FE-27). */
  getToken: () => string | null | undefined
  /** `device_id` del dispositivo o pestaña (FE-30). */
  getDeviceId: () => string | null | undefined
  /** Se llama con un 401: FE-27 muestra el login SIN borrar el outbox. */
  onUnauthorized: () => void
}

const hooks: ApiHooks = {
  getToken: () => null,
  getDeviceId: () => null,
  onUnauthorized: () => {},
}

export function configureApi(partial: Partial<ApiHooks>): void {
  Object.assign(hooks, partial)
}

// ── Reloj del servidor (la demo puede acelerarlo) ───────────

let serverOffsetMs = 0

/**
 * Hora según el servidor de a bordo, a partir de la cabecera `X-Server-Time`.
 * Úsala para "hace X min", las ETA, etc.: con fast-forward, el reloj del dispositivo no vale.
 */
export function serverNow(): Date {
  return new Date(Date.now() + serverOffsetMs)
}

// ── Cliente ──────────────────────────────────────────────────

const ruokMiddleware: Middleware = {
  onRequest({ request }) {
    const token = hooks.getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    const deviceId = hooks.getDeviceId()
    if (deviceId) request.headers.set('X-Device-Id', deviceId)
    // Idioma de los catálogos y textos del servidor (FE-38).
    request.headers.set('Accept-Language', currentLang())
    return request
  },
  onResponse({ response }) {
    const serverTime = response.headers.get('X-Server-Time')
    if (serverTime) {
      const parsed = Date.parse(serverTime)
      if (!Number.isNaN(parsed)) serverOffsetMs = parsed - Date.now()
    }
    if (response.status === 401) hooks.onUnauthorized()
    return response
  },
}

/**
 * fetch de la app:
 * - modo mock → API simulada en memoria;
 * - modo real → fetch; los fallos de red pasan a NetworkError (distinto de un 4xx/5xx);
 * - fallback (opt-in) → si falla la red en un GET, se sirve el mock y se activa el banner.
 */
async function ruokFetch(input: Request): Promise<Response> {
  if (isMockMode()) return mockFetch(input)
  try {
    const response = await globalThis.fetch(input)
    setFallbackActive(false)
    return response
  } catch (err) {
    if (isMockFallbackEnabled() && input.method === 'GET') {
      setFallbackActive(true)
      return mockFetch(input)
    }
    throw new NetworkError(err)
  }
}

export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_ORIGIN ?? '',
  fetch: ruokFetch,
})
api.use(ruokMiddleware)

/**
 * Devuelve `data` o lanza ApiError. Los fallos de red llegan ya como NetworkError.
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await call
  if (!response.ok) throw new ApiError(response.status, error)
  return data as T
}
