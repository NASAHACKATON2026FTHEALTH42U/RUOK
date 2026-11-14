/**
 * Handlers de la API simulada (FS-04): un handler por operación del contrato.
 *
 * Datos base: fixtures.gen.ts (generado desde el backend con `npm run gen:mocks`).
 * Estado en memoria para que el front funcione entero sin back: las mediciones que se envían
 * aparecen en el historial, las alertas se crean y escalan, las tareas suman puntos, etc.
 * `resetMockState()` (o `POST /demo/reset`) vuelve al estado inicial.
 */
import type { Schema } from '../client'
import * as fx from './fixtures.gen'

export interface MockRequest {
  params: Record<string, string>
  query: URLSearchParams
  body: unknown
}

/** Respuesta con código distinto de 200. */
export class MockResponse {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown) {
    this.status = status
    this.body = body
  }
}

const notFound = (what: string) => new MockResponse(404, { detail: `${what} (mock)` })

// ── Estado ───────────────────────────────────────────────────

type Alert = Schema<'Alert'>
type Measurement = Schema<'Measurement'>
type LinkStatus = Schema<'LinkStatus'>

interface MockState {
  clockOffsetMs: number
  currentUser: Schema<'User'> | null
  measurements: Measurement[]
  alerts: Alert[]
  completedTasks: Set<string>
  points: number
  links: Record<string, LinkStatus>
  privacy: Map<number, boolean>
  homeMessages: Schema<'HomeMessage'>[]
  kudos: Schema<'Kudos'>[]
  missions: Map<string, number[]> // `${env}:${mission}` → member_id apuntados
}

const clone = <T>(v: T): T => structuredClone(v)

function initialState(): MockState {
  return {
    clockOffsetMs: 0,
    currentUser: null,
    measurements: clone(fx.measurements),
    alerts: clone(fx.alerts),
    completedTasks: new Set(fx.tasks.filter((t) => t.completed).map((t) => t.id)),
    points: fx.game.points,
    links: clone(fx.linkByEnv),
    privacy: new Map(),
    homeMessages: [],
    kudos: [],
    missions: new Map(),
  }
}

let state = initialState()

export function resetMockState(): void {
  state = initialState()
}

/** Reloj de la API simulada (admite fast-forward). */
export function mockNow(): Date {
  return new Date(Date.now() + state.clockOffsetMs)
}
const nowIso = () => mockNow().toISOString()

// ── Utilidades ───────────────────────────────────────────────

const allMembers = (): Schema<'MemberSummary'>[] => Object.values(fx.membersByEnv).flat()

function findMember(id: string) {
  const m = allMembers().find((x) => x.id === Number(id))
  if (!m) return null
  const share = state.privacy.get(m.id)
  return share === undefined ? m : { ...m, share_behavioral_details: share }
}

function assessmentFor(memberId: number, envId: string): Schema<'Assessment'> {
  const base = fx.assessmentByEnv[envId] ?? fx.assessmentByEnv.mars
  return { ...clone(base), member_id: memberId, generated_at: nowIso() }
}

function toMemberFields(m: Schema<'MemberSummary'>): Schema<'Member'> {
  const { id, env_id, name, position, share_behavioral_details, last_seen_at, liveness } = m
  return { id, env_id, name, position, share_behavioral_details, last_seen_at, liveness }
}

function findAlert(id: string) {
  return state.alerts.find((a) => a.id === id) ?? null
}

function addAlertEvent(
  alert: Alert,
  type: Schema<'AlertEventType'>,
  actor: Schema<'Actor'>,
  payload: Record<string, unknown> = {},
): Alert {
  const at = nowIso()
  alert.events = [...(alert.events ?? []), { type, actor, at, payload }]
  alert.updated_at = at
  return alert
}

/**
 * Usuario del login simulado: los de `fx.users` y, si no está, el perfil demo del selector
 * (`fx.demoUsers`). Así todos los perfiles que muestra el login entran en modo demo; un member
 * se enlaza con su ficha del entorno por el nombre (`membersByEnv`).
 */
function mockUser(username: string): Schema<'User'> | undefined {
  const known = fx.users.find((u) => u.username === username)
  if (known) return known
  const i = fx.demoUsers.findIndex((d) => d.username === username)
  if (i < 0) return undefined
  const d = fx.demoUsers[i]
  const member =
    d.role === 'member'
      ? (fx.membersByEnv[d.env_id ?? ''] ?? []).find((m) => m.name === d.display_name)
      : undefined
  return {
    id: 1000 + i,
    username: d.username,
    display_name: d.display_name,
    role: d.role,
    env_id: d.env_id ?? null,
    member_id: member?.id ?? null,
    role_label: d.role_label,
    active: true,
  }
}

function tokenFor(username: string) {
  const user = mockUser(username)
  if (!user) return new MockResponse(401, { detail: 'Usuario o contraseña incorrectos (mock)' })
  state.currentUser = user
  const expires = new Date(mockNow().getTime() + 12 * 3600_000).toISOString()
  return { ...fx.tokenTemplate, access_token: `mock-token-${user.id}`, expires_at: expires, user }
}

const body = <T>(req: MockRequest) => (req.body ?? {}) as T
const env = (req: MockRequest) => req.params.env_id ?? req.query.get('env') ?? 'mars'

const MOCK_MISSIONS = [
  { id: 'eat_together', title: 'Comer juntos', points: 30, min_participants: 2 },
  { id: 'group_game', title: 'Juego de grupo', points: 40, min_participants: 3 },
  { id: 'tend_plants', title: 'Cuidar las plantas', points: 25, min_participants: 2 },
]

function mockMissions(envId: string): Schema<'CrewMission'>[] {
  const date = nowIso().slice(0, 10)
  return MOCK_MISSIONS.map((m) => {
    const participants = state.missions.get(`${envId}:${m.id}`) ?? []
    return { ...m, date, participants, completed: participants.length >= m.min_participants }
  })
}

// ── Handlers ─────────────────────────────────────────────────

type Handler = (req: MockRequest) => unknown

export const handlers: Record<string, Handler> = {
  // Sistema y auth
  'GET /health': () => ({ status: 'ok', server_time: nowIso() }),
  'POST /auth/login': (req) => tokenFor(body<{ username: string }>(req).username),
  'POST /auth/pin': (req) => tokenFor(body<{ username: string }>(req).username),
  'GET /auth/me': () =>
    state.currentUser ?? new MockResponse(401, { detail: 'Sin sesión válida (mock)' }),
  'GET /auth/demo-users': () => fx.demoUsers,
  'GET /users': (req) => {
    const envId = req.query.get('env_id')
    return fx.users.filter((u) => !envId || u.env_id === envId)
  },
  'POST /users': (req) => {
    const b = body<Schema<'UserCreate'>>(req)
    return new MockResponse(201, {
      id: 1000 + fx.users.length,
      username: b.username,
      display_name: b.display_name,
      role: b.role,
      env_id: b.env_id ?? null,
      member_id: b.member_id ?? null,
      role_label: b.role,
      active: true,
    })
  },
  'PATCH /users/{user_id}': (req) => {
    const u = fx.users.find((x) => String(x.id) === req.params.user_id)
    if (!u) return notFound('Usuario inexistente')
    return { ...u, active: body<Schema<'UserUpdate'>>(req).active }
  },
  'PUT /users/{user_id}/pin': (req) =>
    fx.users.find((x) => String(x.id) === req.params.user_id) ?? notFound('Usuario inexistente'),

  // Configuración
  'GET /environments': () => fx.environments,
  'GET /environments/{env_id}': (req) =>
    fx.environments.find((e) => e.id === req.params.env_id) ?? notFound('Entorno desconocido'),
  'GET /indicators': () => fx.indicators,
  'GET /indicators/{indicator_id}': (req) =>
    fx.indicators.find((i) => i.id === req.params.indicator_id) ??
    notFound('Indicador desconocido'),
  'GET /systems': () => fx.systems,
  'GET /interventions': (req) => {
    const sys = req.query.get('system_id')
    const cat = req.query.get('category')
    return fx.interventions.filter(
      (i) => (!sys || i.system_id === sys) && (!cat || i.category === cat),
    )
  },

  // Members
  'GET /environments/{env_id}/members': (req) =>
    fx.membersByEnv[req.params.env_id] ?? notFound('Entorno desconocido'),
  'GET /members/{member_id}': (req) => {
    const m = findMember(req.params.member_id)
    return m ? toMemberFields(m) : notFound('Member desconocido')
  },
  'PATCH /members/{member_id}/privacy': (req) => {
    const m = findMember(req.params.member_id)
    if (!m) return notFound('Member desconocido')
    const share = body<Schema<'PrivacyIn'>>(req).share_behavioral_details
    state.privacy.set(m.id, share)
    return { ...toMemberFields(m), share_behavioral_details: share }
  },

  // Mediciones (idempotentes por UUID)
  'POST /members/{member_id}/measurements': (req) => {
    const m = findMember(req.params.member_id)
    if (!m) return notFound('Member desconocido')
    let accepted = 0
    let duplicates = 0
    for (const item of body<Schema<'MeasurementBatchIn'>>(req).measurements ?? []) {
      if (state.measurements.some((x) => x.id === item.id)) {
        duplicates++
        continue
      }
      const unit = fx.indicators.find((i) => i.id === item.indicator_id)?.unit ?? ''
      state.measurements.push({
        ...item,
        source: item.source ?? 'manual',
        note: item.note ?? null,
        member_id: m.id,
        unit,
        received_at: nowIso(),
      })
      accepted++
    }
    return { accepted, duplicates, assessment: assessmentFor(m.id, m.env_id) }
  },
  'GET /members/{member_id}/measurements': (req) => {
    const id = Number(req.params.member_id)
    const ind = req.query.get('indicator_id')
    const from = req.query.get('from')
    const to = req.query.get('to')
    return state.measurements
      .filter(
        (x) =>
          x.member_id === id &&
          (!ind || x.indicator_id === ind) &&
          (!from || x.taken_at >= from) &&
          (!to || x.taken_at <= to),
      )
      .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
  },

  // Evaluación y liveness
  'GET /members/{member_id}/assessment': (req) => {
    const m = findMember(req.params.member_id)
    if (!m) return notFound('Member desconocido')
    return assessmentFor(m.id, req.query.get('env') ?? m.env_id)
  },
  'POST /members/{member_id}/heartbeat': () => fx.heartbeatResult,
  'POST /members/{member_id}/ruok': (req) => ({
    liveness: 'active',
    alert_id: body<Schema<'RuokIn'>>(req).ok ? null : fx.alerts[0].id,
  }),

  // Alertas
  'GET /members/{member_id}/alerts': (req) => {
    const id = Number(req.params.member_id)
    const status = req.query.get('status')
    return state.alerts.filter((a) => a.member_id === id && (!status || a.status === status))
  },
  'POST /members/{member_id}/alerts': (req) => {
    const b = body<Schema<'AlertIn'>>(req)
    const existing = findAlert(b.id)
    if (existing) return existing // idempotente
    const m = findMember(req.params.member_id)
    if (!m) return notFound('Member desconocido')
    const at = nowIso()
    const alert: Alert = {
      ...clone(fx.alerts[0]),
      id: b.id,
      member_id: m.id,
      env_id: m.env_id,
      origin: 'manual',
      authenticated: state.currentUser !== null,
      category: b.category,
      severity: b.severity,
      message: b.message ?? '',
      system_id: b.system_id ?? null,
      target_role: b.target_role ?? 'crew',
      status: 'open',
      created_at: at,
      updated_at: at,
      events: [{ type: 'created', actor: 'member', at, payload: {} }],
    }
    state.alerts.push(alert)
    return alert
  },
  'POST /alerts/{alert_id}/escalate': (req) => {
    const a = findAlert(req.params.alert_id)
    if (!a) return notFound('Alerta desconocida')
    const b = body<Schema<'EscalateIn'>>(req)
    a.level += 1
    if (b.target_role) a.target_role = b.target_role
    a.status = 'escalated'
    return addAlertEvent(a, 'escalated', 'member', { message: b.message ?? null })
  },
  'POST /alerts/{alert_id}/ack': (req) => {
    const a = findAlert(req.params.alert_id)
    if (!a) return notFound('Alerta desconocida')
    a.status = 'acknowledged'
    return addAlertEvent(a, 'acknowledged', body<Schema<'AckIn'>>(req).actor)
  },
  'POST /alerts/{alert_id}/resolve': (req) => {
    const a = findAlert(req.params.alert_id)
    if (!a) return notFound('Alerta desconocida')
    const b = body<Schema<'ResolveIn'>>(req)
    a.status = 'resolved'
    return addAlertEvent(a, 'resolved', b.actor, { note: b.note ?? null })
  },
  'POST /alerts/{alert_id}/messages': (req) => {
    const a = findAlert(req.params.alert_id)
    if (!a) return notFound('Alerta desconocida')
    const b = body<Schema<'AlertMessageIn'>>(req)
    return addAlertEvent(a, 'message', b.actor, { text: b.text })
  },
  'GET /environments/{env_id}/alerts': (req) =>
    fx.groundByEnv[req.params.env_id] ?? notFound('Entorno desconocido'),

  // Rutina y juego
  'GET /members/{member_id}/tasks': () =>
    fx.tasks.map((t) => ({ ...t, completed: state.completedTasks.has(t.id) })),
  'POST /members/{member_id}/tasks/{task_id}/complete': (req) => {
    const task = fx.tasks.find((t) => t.id === req.params.task_id)
    if (!task) return notFound('Tarea desconocida')
    if (!state.completedTasks.has(task.id)) {
      state.completedTasks.add(task.id)
      state.points += task.points
    }
    return { ...fx.game, points: state.points }
  },
  'GET /members/{member_id}/game': () => ({ ...fx.game, points: state.points }),
  'GET /environments/{env_id}/leaderboard': (req) =>
    fx.leaderboardByEnv[req.params.env_id] ?? notFound('Entorno desconocido'),

  // Mensaje a casa (BE-22): en el mock el retardo es de 5 s y la respuesta llega 5 s después.
  'GET /members/{member_id}/home-messages': (req) => {
    const now = mockNow().getTime()
    return state.homeMessages
      .filter((m) => m.member_id === Number(req.params.member_id))
      .filter((m) => m.direction === 'up' || new Date(m.eta).getTime() <= now)
      .map((m) => {
        const arrived = new Date(m.eta).getTime() <= now
        return {
          ...m,
          state: arrived ? ('delivered' as const) : ('in_transit' as const),
          delivered_at: arrived ? m.eta : null,
        }
      })
  },
  'POST /members/{member_id}/home-messages': (req) => {
    const { id, text } = body<Schema<'HomeMessageIn'>>(req)
    const memberId = Number(req.params.member_id)
    const existing = state.homeMessages.find((m) => m.id === id)
    if (existing) {
      return existing.text === text
        ? existing
        : new MockResponse(409, { detail: 'Ese id ya se usó con otro mensaje (mock)' })
    }
    const sent = mockNow().getTime()
    const up: Schema<'HomeMessage'> = {
      id,
      member_id: memberId,
      direction: 'up',
      text,
      sender: null,
      in_reply_to: null,
      sent_at: new Date(sent).toISOString(),
      eta: new Date(sent + 5000).toISOString(),
      delivered_at: null,
      state: 'in_transit',
    }
    const reply: Schema<'HomeMessage'> = {
      id: crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, '0') + id.slice(8),
      member_id: memberId,
      direction: 'down',
      text: 'Gracias por escribir. Te mandamos un abrazo enorme desde casa.',
      sender: 'Casa',
      in_reply_to: id,
      sent_at: new Date(sent + 5000).toISOString(),
      eta: new Date(sent + 10000).toISOString(),
      delivered_at: null,
      state: 'in_transit',
    }
    state.homeMessages.push(up, reply)
    return up
  },

  // Kudos y misiones de tripulación (BE-23). Catálogo mínimo; en el backend va en crew_game.json.
  'POST /members/{member_id}/kudos': (req) => {
    const b = body<Schema<'KudosIn'>>(req)
    const from = findMember(req.params.member_id)
    const to = allMembers().find((m) => m.id === b.to_member_id)
    if (!from || !to || to.env_id !== from.env_id || to.id === from.id)
      return new MockResponse(422, { detail: 'Destinatario no válido (mock)' })
    const existing = state.kudos.find((k) => k.id === b.id)
    if (existing) return existing
    const k: Schema<'Kudos'> = {
      id: b.id,
      env_id: from.env_id,
      from_member_id: from.id,
      to_member_id: to.id,
      message: b.message,
      created_at: nowIso(),
    }
    state.kudos.push(k)
    return k
  },
  'GET /environments/{env_id}/kudos': (req) =>
    fx.environments.some((e) => e.id === req.params.env_id)
      ? state.kudos.filter((k) => k.env_id === req.params.env_id).reverse()
      : notFound('Entorno desconocido'),
  'GET /environments/{env_id}/missions': (req) =>
    fx.environments.some((e) => e.id === req.params.env_id)
      ? mockMissions(req.params.env_id)
      : notFound('Entorno desconocido'),
  'POST /members/{member_id}/missions/{mission_id}/join': (req) => {
    const m = findMember(req.params.member_id)
    if (!m) return notFound('Member desconocido')
    const mission = mockMissions(m.env_id).find((x) => x.id === req.params.mission_id)
    if (!mission) return notFound('Misión desconocida')
    const key = `${m.env_id}:${mission.id}`
    const list = state.missions.get(key) ?? []
    if (!list.includes(m.id)) state.missions.set(key, [...list, m.id])
    return mockMissions(m.env_id).find((x) => x.id === mission.id)
  },

  // Tiempo real, dispositivos y control
  'GET /events/stream': () => fx.events, // mockFetch lo serializa como text/event-stream
  'GET /events': (req) => {
    const since = Number(req.query.get('since_id') ?? 0)
    const envId = req.query.get('env_id')
    const type = req.query.get('type')
    const limit = Number(req.query.get('limit') ?? 100)
    return fx.events
      .filter((e) => e.id > since && (!envId || e.env_id === envId) && (!type || e.type === type))
      .slice(0, limit)
  },
  'GET /devices': () => fx.devices,
  'GET /control/overview': () => ({
    ...fx.controlOverview,
    generated_at: nowIso(),
    environments: fx.controlOverview.environments.map((e) => ({
      ...e,
      link: state.links[e.environment.id] ?? e.link,
    })),
  }),
  'POST /control/liveness/pause': (req) => {
    const b = body<Schema<'LivenessPauseIn'>>(req)
    return { ok: true, detail: `liveness ${b.paused ? 'pausado' : 'activo'} en ${b.env_id} (mock)` }
  },
  'GET /system/network-info': () => fx.networkInfo,

  // Enlace
  'GET /link': (req) => state.links[env(req)] ?? notFound('Entorno desconocido'),
  'GET /link/messages': () => [],

  // Demo
  'POST /demo/reset': () => {
    resetMockState()
    return { ok: true, detail: 'reset (mock)' }
  },
  'POST /demo/scenarios/{name}': (req) =>
    ['mars_sleep_bp', 'eva_no_contact', 'geriatric_fall_risk'].includes(req.params.name)
      ? { ok: true, detail: `escenario ${req.params.name} (mock)` }
      : notFound('Escenario desconocido'),
  'POST /demo/link': (req) => {
    const b = body<Schema<'DemoLinkIn'>>(req)
    const current = state.links[b.env]
    if (!current) return notFound('Entorno desconocido')
    state.links[b.env] = { ...current, state: b.state, since: nowIso() }
    return state.links[b.env]
  },
  'POST /demo/fast-forward': (req) => {
    state.clockOffsetMs += body<Schema<'FastForwardIn'>>(req).seconds * 1000
    return { server_time: nowIso(), offset_s: state.clockOffsetMs / 1000 }
  },
}
