import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, configureApi, NetworkError, serverNow, unwrap } from './client'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

describe('cliente API', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    configureApi({ getToken: () => null, getDeviceId: () => null, onUnauthorized: () => {} })
  })

  it('devuelve los datos tipados de /health', async () => {
    fetchMock.mockResolvedValue(json({ status: 'ok', server_time: '2026-11-14T10:00:00Z' }))
    const health = await unwrap(api.GET('/api/v1/health'))
    expect(health.status).toBe('ok')
    const req: Request = fetchMock.mock.calls[0][0]
    expect(new URL(req.url).pathname).toBe('/api/v1/health')
  })

  it('añade Authorization y X-Device-Id con los hooks configurados', async () => {
    configureApi({ getToken: () => 'tok', getDeviceId: () => 'dev-1' })
    fetchMock.mockResolvedValue(json({ status: 'ok', server_time: '2026-11-14T10:00:00Z' }))
    await unwrap(api.GET('/api/v1/health'))
    const req: Request = fetchMock.mock.calls[0][0]
    expect(req.headers.get('Authorization')).toBe('Bearer tok')
    expect(req.headers.get('X-Device-Id')).toBe('dev-1')
  })

  it('lanza ApiError con el detail de FastAPI', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'Member desconocido: 999' }, 404))
    const err = await unwrap(
      api.GET('/api/v1/members/{member_id}', { params: { path: { member_id: 999 } } }),
    ).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(404)
    expect(err.detail).toBe('Member desconocido: 999')
  })

  it('resume los errores de validación 422', async () => {
    fetchMock.mockResolvedValue(json({ detail: [{ msg: 'campo obligatorio' }, { msg: 'x' }] }, 422))
    const err = await unwrap(api.GET('/api/v1/health')).catch((e) => e)
    expect(err.detail).toBe('campo obligatorio; x')
  })

  it('distingue los fallos de red (NetworkError) para el outbox', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(unwrap(api.GET('/api/v1/health'))).rejects.toBeInstanceOf(NetworkError)
  })

  it('avisa con un 401 (login sin borrar el outbox)', async () => {
    const onUnauthorized = vi.fn()
    configureApi({ onUnauthorized })
    fetchMock.mockResolvedValue(json({ detail: 'Sin sesión válida' }, 401))
    await unwrap(api.GET('/api/v1/auth/me')).catch(() => {})
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('sincroniza serverNow() con X-Server-Time (reloj de demo acelerado)', async () => {
    const ahead = new Date(Date.now() + 840_000).toISOString() // +14 min (fast-forward)
    fetchMock.mockResolvedValue(
      json({ status: 'ok', server_time: ahead }, 200, { 'X-Server-Time': ahead }),
    )
    await unwrap(api.GET('/api/v1/health'))
    const diff = serverNow().getTime() - Date.now()
    expect(diff).toBeGreaterThan(830_000)
    expect(diff).toBeLessThan(850_000)
  })
})
