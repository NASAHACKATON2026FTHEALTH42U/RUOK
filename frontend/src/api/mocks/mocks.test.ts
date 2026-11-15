import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, NetworkError, unwrap } from '../client'
import { newId } from '../newId'
import { createMockEventStream } from './events'
import { CONTRACT_OPERATIONS } from './fixtures.gen'
import { resetMockState } from './handlers'
import { matchRoute, mockFetch } from './mockFetch'
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
    // BE-31: un critical escala a la tripulación, que es de a bordo → tiempo real y sin
    // retardo también en Marte. El modo `autonomous` (840 s) es solo para niveles externos.
    const mars = (await get('mars')).systems[0].escalation
    expect([mars.target_role, mars.mode, mars.delay_s]).toEqual(['crew', 'realtime', 0])
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

  it('todos los perfiles del selector del login entran, y un member con su ficha', async () => {
    const demo = await unwrap(api.GET('/api/v1/auth/demo-users'))
    expect(demo.length).toBeGreaterThan(4)
    for (const d of demo) {
      const tok = await unwrap(
        api.POST('/api/v1/auth/login', { body: { username: d.username, password: 'demo' } }),
      )
      expect(tok.user).toMatchObject({ username: d.username, role: d.role, env_id: d.env_id })
      if (d.role === 'member') expect(tok.user.member_id).not.toBeNull()
    }
  })

  it('lee el cuerpo aunque el navegador no exponga Request.body (Firefox)', async () => {
    const real = new Request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'vega', password: 'demo' }),
    })
    // Como en Firefox: `body` es undefined, pero `clone().text()` funciona.
    const firefoxLike = new Proxy(real, {
      get(target, key) {
        if (key === 'body') return undefined
        const value = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const res = await mockFetch(firefoxLike)
    expect(res.status).toBe(200)
    expect((await res.json()).user.username).toBe('vega')
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

  it('previsión: la del modelo real para el member de ejemplo; indicador desconocido → 404', async () => {
    const get = (indicatorId: string) =>
      unwrap(
        api.GET('/api/v1/members/{member_id}/forecast', {
          params: { path: { member_id: 1 }, query: { indicator_id: indicatorId } },
        }),
      )
    const forecast = await get('bp_systolic')
    expect(forecast).toMatchObject({
      member_id: 1,
      indicator_id: 'bp_systolic',
      unit: 'mmHg',
      status: 'ok',
    })
    expect(forecast.points.length).toBeGreaterThan(0)
    for (const p of forecast.points) {
      expect(p.low).toBeLessThanOrEqual(p.value)
      expect(p.high).toBeGreaterThanOrEqual(p.value)
    }
    // Cada punto es posterior al anterior: un paso de la serie por punto.
    const times = forecast.points.map((p) => Date.parse(p.at))
    expect(times).toEqual([...times].sort((a, b) => a - b))

    const err = await get('no_existe').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(404)
  })

  it('previsión: el horizonte recorta los puntos y uno fuera de 1–14 da 422', async () => {
    const get = (horizonDays: number) =>
      unwrap(
        api.GET('/api/v1/members/{member_id}/forecast', {
          params: {
            path: { member_id: 1 },
            query: { indicator_id: 'bp_systolic', horizon_days: horizonDays },
          },
        }),
      )
    const short = await get(3)
    expect(short.horizon_days).toBe(3)
    expect(short.points).toHaveLength(3)
    expect((await get(14)).points).toHaveLength(7) // el ejemplo solo tiene 7 días calculados

    for (const bad of [0, 15, 2.5]) {
      const err = await get(bad).catch((e) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect(err.status).toBe(422)
    }
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
          params: { path: { member_id: 1, task_id: 't_2026-11-14_1_resistive_exercise' } },
          body: { id: newId(), completed_at: NOW },
        }),
      )
    expect((await complete()).points).toBe(before + 20)
    expect((await complete()).points).toBe(before + 20)
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
