import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, NetworkError, unwrap } from '../client'
import { newId } from '../newId'
import { createMockEventStream } from './events'
import { CONTRACT_OPERATIONS } from './fixtures.gen'
import { resetMockState } from './handlers'
import { matchRoute } from './mockFetch'
import { isFallbackActive, setFallbackActive } from './mode'

const NOW = '2026-11-14T10:00:00Z'

describe('cobertura del contrato', () => {
  it('cada operación del OpenAPI tiene un mock', () => {
    const missing = CONTRACT_OPERATIONS.filter(
      ([method, p]) => !matchRoute(method, p.replace(/\{\w+\}/g, 'x')),
    )
    expect(missing).toEqual([])
  })
})

describe('modo mock (VITE_USE_MOCKS=true)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no debería usarse la red')))
    resetMockState()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('no toca la red y sirve el catálogo', async () => {
    const envs = await unwrap(api.GET('/api/v1/environments'))
    expect(envs.map((e) => e.id)).toEqual(['iss', 'moon', 'mars', 'earth', 'hospital', 'geriatric'])
    expect(fetch).not.toHaveBeenCalled()
    const systems = await unwrap(api.GET('/api/v1/systems'))
    expect(systems).toHaveLength(7)
  })

  it('el assessment de ejemplo mezcla los 4 estados', async () => {
    const a = await unwrap(
      api.GET('/api/v1/members/{member_id}/assessment', { params: { path: { member_id: 1 } } }),
    )
    expect(new Set(a.systems.map((s) => s.status))).toEqual(
      new Set(['normal', 'warning', 'critical', 'unknown']),
    )
  })

  it('el modo de escalado depende del entorno', async () => {
    const get = (env: string) =>
      unwrap(
        api.GET('/api/v1/members/{member_id}/assessment', {
          params: { path: { member_id: 1 }, query: { env } },
        }),
      )
    expect((await get('mars')).systems[0].escalation.mode).toBe('autonomous')
    expect((await get('iss')).systems[0].escalation.mode).toBe('realtime')
  })

  it('login / me con usuarios demo; usuario desconocido → 401', async () => {
    const tok = await unwrap(
      api.POST('/api/v1/auth/login', { body: { username: 'vega', password: 'x' } }),
    )
    expect(tok.user.role).toBe('member')
    const me = await unwrap(api.GET('/api/v1/auth/me'))
    expect(me.username).toBe('vega')
    const err = await unwrap(
      api.POST('/api/v1/auth/login', { body: { username: 'nadie', password: 'x' } }),
    ).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(401)
  })

  it('mediciones idempotentes: el mismo UUID no se duplica y aparece en el historial', async () => {
    const m = { id: newId(), indicator_id: 'bp_systolic', value: 150, taken_at: NOW }
    const post = () =>
      unwrap(
        api.POST('/api/v1/members/{member_id}/measurements', {
          params: { path: { member_id: 1 } },
          body: { measurements: [m] },
        }),
      )
    expect(await post()).toMatchObject({ accepted: 1, duplicates: 0 })
    expect(await post()).toMatchObject({ accepted: 0, duplicates: 1 })
    const history = await unwrap(
      api.GET('/api/v1/members/{member_id}/measurements', {
        params: { path: { member_id: 1 }, query: { indicator_id: 'bp_systolic' } },
      }),
    )
    expect(history.filter((h) => h.id === m.id)).toHaveLength(1)
  })

  it('SOS: crear (idempotente), escalar y resolver', async () => {
    const id = newId()
    const create = () =>
      unwrap(
        api.POST('/api/v1/members/{member_id}/alerts', {
          params: { path: { member_id: 1 } },
          body: { id, category: 'emergency', severity: 'emergency' },
        }),
      )
    const a = await create()
    expect(a.id).toBe(id)
    await create()
    const list = await unwrap(
      api.GET('/api/v1/members/{member_id}/alerts', { params: { path: { member_id: 1 } } }),
    )
    expect(list.filter((x) => x.id === id)).toHaveLength(1)
    const esc = await unwrap(
      api.POST('/api/v1/alerts/{alert_id}/escalate', {
        params: { path: { alert_id: id } },
        body: { target_role: 'ground' },
      }),
    )
    expect(esc).toMatchObject({ status: 'escalated', target_role: 'ground' })
    const res = await unwrap(
      api.POST('/api/v1/alerts/{alert_id}/resolve', {
        params: { path: { alert_id: id } },
        body: { actor: 'responder' },
      }),
    )
    expect(res.status).toBe('resolved')
    expect(res.events?.map((e) => e.type)).toEqual(['created', 'escalated', 'resolved'])
  })

  it('completar una tarea suma puntos una sola vez', async () => {
    const before = (
      await unwrap(
        api.GET('/api/v1/members/{member_id}/game', { params: { path: { member_id: 1 } } }),
      )
    ).points
    const complete = () =>
      unwrap(
        api.POST('/api/v1/members/{member_id}/tasks/{task_id}/complete', {
          params: { path: { member_id: 1, task_id: 't_2026-11-14_1_checkin' } },
          body: { id: newId(), completed_at: NOW },
        }),
      )
    expect((await complete()).points).toBe(before + 10)
    expect((await complete()).points).toBe(before + 10)
  })

  it('demo: enlace en LOS y fast-forward del reloj', async () => {
    const link = await unwrap(
      api.POST('/api/v1/demo/link', { body: { env: 'mars', state: 'los' } }),
    )
    expect(link.state).toBe('los')
    const overview = await unwrap(api.GET('/api/v1/control/overview'))
    expect(overview.environments.find((e) => e.environment.id === 'mars')?.link.state).toBe('los')
    const clock = await unwrap(api.POST('/api/v1/demo/fast-forward', { body: { seconds: 840 } }))
    expect(clock.offset_s).toBe(840)
  })

  it('recurso inexistente → 404 con detail', async () => {
    const err = await unwrap(
      api.GET('/api/v1/environments/{env_id}', { params: { path: { env_id: 'pluto' } } }),
    ).catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(404)
  })
})

describe('fallback (VITE_MOCK_FALLBACK=true) con el servidor caído', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    setFallbackActive(false)
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    setFallbackActive(false)
  })

  it('las lecturas usan mocks y activan el banner', async () => {
    vi.stubEnv('VITE_MOCK_FALLBACK', 'true')
    const envs = await unwrap(api.GET('/api/v1/environments'))
    expect(envs).toHaveLength(6)
    expect(isFallbackActive()).toBe(true)
  })

  it('las escrituras NUNCA se simulan: NetworkError para que el outbox las guarde', async () => {
    vi.stubEnv('VITE_MOCK_FALLBACK', 'true')
    const call = unwrap(
      api.POST('/api/v1/members/{member_id}/measurements', {
        params: { path: { member_id: 1 } },
        body: { measurements: [{ id: newId(), indicator_id: 'mood', value: 3, taken_at: NOW }] },
      }),
    )
    await expect(call).rejects.toBeInstanceOf(NetworkError)
  })

  it('sin fallback (por defecto): nada de datos de ejemplo, solo NetworkError', async () => {
    await expect(unwrap(api.GET('/api/v1/environments'))).rejects.toBeInstanceOf(NetworkError)
    expect(isFallbackActive()).toBe(false)
  })
})

describe('eventos falsos para el feed', () => {
  afterEach(() => vi.useRealTimers())

  it('emite eventos con id creciente', () => {
    vi.useFakeTimers()
    const seen: number[] = []
    const stop = createMockEventStream((e) => seen.push(e.id), { intervalMs: 1000, startId: 10 })
    vi.advanceTimersByTime(3500)
    stop()
    vi.advanceTimersByTime(5000)
    expect(seen).toEqual([10, 11, 12])
  })
})
