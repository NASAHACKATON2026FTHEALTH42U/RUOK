import { create } from 'zustand'
import { api, NetworkError, serverNow, unwrap, type Schema } from '../api/client'
import { newId } from '../api/newId'
import { backoffMs, classify, isDue } from './backoff'
import { getDb, type OutboxEntry } from './db'
import { getDevice } from './device'

/**
 * Outbox offline (FE-11, docs/data-model.md §2). TODA escritura de la app pasa por aquí:
 * 1. Se guarda primero en IndexedDB (`outbox`, y las mediciones en `measurements` con
 *    `synced=false`): aunque se cierre la app o no haya red, no se pierde.
 * 2. El sincronizador la envía: 2xx (incluido "duplicado") → se borra; sin red / 5xx →
 *    reintento con backoff; 401 → pausa sin borrar nada (FE-27 pide login y llama a
 *    `resumeSync()`); otros 4xx → queda como `failed` para revisarla.
 * 3. Se sincroniza al encolar, con el evento `online`, al volver a la pestaña y cada pocos
 *    segundos si hay algo pendiente. Un cerrojo evita envíos simultáneos desde dos pestañas
 *    del mismo dispositivo.
 * Los ids son los UUID del cliente: reenviar nunca duplica en el servidor.
 */

export type MeasurementIn = Schema<'MeasurementIn'>
export type AlertIn = Schema<'AlertIn'>
export type TaskCompleteIn = Schema<'TaskCompleteIn'>
export type GameState = Schema<'GameState'>
export type HomeMessageIn = Schema<'HomeMessageIn'>
export type HomeMessage = Schema<'HomeMessage'>
export type KudosIn = Schema<'KudosIn'>
export type Kudos = Schema<'Kudos'>
export type CrewMission = Schema<'CrewMission'>

// ── Estado visible (contador de la cabecera) ─────────────────

interface OutboxState {
  /** Entradas pendientes de enviar (incluye las que esperan un reintento). */
  pending: number
  /** Entradas rechazadas por el servidor (4xx): se conservan, no se reintentan solas. */
  failed: number
  syncing: boolean
  /** Sincronización pausada por un 401 (hasta que haya sesión, FE-27). */
  paused: boolean
  lastSyncAt: string | null
}

export const useOutboxStore = create<OutboxState>(() => ({
  pending: 0,
  failed: 0,
  syncing: false,
  paused: false,
  lastSyncAt: null,
}))

async function refreshCounts() {
  const db = await getDb()
  const all = await db.getAll('outbox')
  useOutboxStore.setState({
    pending: all.filter((e) => e.status !== 'failed').length,
    failed: all.filter((e) => e.status === 'failed').length,
  })
}

// ── Envío de cada tipo de entrada ───────────────────────────

/** Respuesta del lote de mediciones: aceptadas, duplicadas y la evaluación actualizada. */
export type MeasurementBatchResult = NonNullable<
  Awaited<ReturnType<typeof postMeasurements>>['data']
>

/** Alerta creada (SOS o aviso a control): estado, destino, modo de entrega y ETA. */
export type AlertResult = NonNullable<Awaited<ReturnType<typeof postAlert>>['data']>

function postAlert(memberId: number, alert: AlertIn) {
  return api.POST('/api/v1/members/{member_id}/alerts', {
    params: { path: { member_id: memberId } },
    body: alert,
  })
}

function postTaskComplete(memberId: number, taskId: string, body: TaskCompleteIn) {
  return api.POST('/api/v1/members/{member_id}/tasks/{task_id}/complete', {
    params: { path: { member_id: memberId, task_id: taskId } },
    body,
  })
}

function postHomeMessage(memberId: number, message: HomeMessageIn) {
  return api.POST('/api/v1/members/{member_id}/home-messages', {
    params: { path: { member_id: memberId } },
    body: message,
  })
}

function postKudos(memberId: number, kudos: KudosIn) {
  return api.POST('/api/v1/members/{member_id}/kudos', {
    params: { path: { member_id: memberId } },
    body: kudos,
  })
}

function postMissionJoin(memberId: number, missionId: string, id: string) {
  return api.POST('/api/v1/members/{member_id}/missions/{mission_id}/join', {
    params: { path: { member_id: memberId, mission_id: missionId } },
    body: { id },
  })
}

function postMeasurements(memberId: number, measurements: MeasurementIn[]) {
  return api.POST('/api/v1/members/{member_id}/measurements', {
    params: { path: { member_id: memberId } },
    body: { measurements },
  })
}

/** Envía una entrada; devuelve el status HTTP (0 = sin red) y los datos. */
async function send(
  entry: OutboxEntry,
): Promise<{ status: number; data?: unknown; error?: string }> {
  try {
    switch (entry.kind) {
      case 'measurement_batch': {
        const body = entry.body as { measurements: MeasurementIn[] }
        const r = await postMeasurements(entry.member_id, body.measurements)
        return {
          status: r.response.status,
          data: r.data,
          error: r.error ? JSON.stringify(r.error) : undefined,
        }
      }
      case 'alert': {
        const r = await postAlert(entry.member_id, entry.body as AlertIn)
        return {
          status: r.response.status,
          data: r.data,
          error: r.error ? JSON.stringify(r.error) : undefined,
        }
      }
      case 'task_completion': {
        const body = entry.body as { task_id: string; completion: TaskCompleteIn }
        const r = await postTaskComplete(entry.member_id, body.task_id, body.completion)
        return {
          status: r.response.status,
          data: r.data,
          error: r.error ? JSON.stringify(r.error) : undefined,
        }
      }
      case 'home_message': {
        const r = await postHomeMessage(entry.member_id, entry.body as HomeMessageIn)
        return {
          status: r.response.status,
          data: r.data,
          error: r.error ? JSON.stringify(r.error) : undefined,
        }
      }
      case 'kudos': {
        const r = await postKudos(entry.member_id, entry.body as KudosIn)
        return {
          status: r.response.status,
          data: r.data,
          error: r.error ? JSON.stringify(r.error) : undefined,
        }
      }
      case 'mission_join': {
        const body = entry.body as { mission_id: string; id: string }
        const r = await postMissionJoin(entry.member_id, body.mission_id, body.id)
        return {
          status: r.response.status,
          data: r.data,
          error: r.error ? JSON.stringify(r.error) : undefined,
        }
      }
      default:
        return { status: 400, error: `Tipo de entrada sin envío implementado: ${entry.kind}` }
    }
  } catch (err) {
    if (err instanceof NetworkError) return { status: 0, error: 'Sin conexión' }
    return { status: 0, error: String(err) }
  }
}

/** Efectos locales al confirmarse una entrada (mediciones sincronizadas, última evaluación). */
async function onDone(entry: OutboxEntry, data: unknown) {
  const db = await getDb()
  const tx = db.transaction(['outbox', 'measurements', 'assessments', 'alerts'], 'readwrite')
  if (entry.kind === 'measurement_batch') {
    for (const m of (entry.body as { measurements: MeasurementIn[] }).measurements) {
      const local = await tx.objectStore('measurements').get(m.id)
      if (local) await tx.objectStore('measurements').put({ ...local, synced: true })
    }
    const assessment = (data as MeasurementBatchResult | undefined)?.assessment
    if (assessment) {
      await tx.objectStore('assessments').put({
        member_id: entry.member_id,
        assessment,
        received_at: new Date().toISOString(),
        provisional: false,
      })
    }
  }
  if (entry.kind === 'alert' && data) {
    await tx.objectStore('alerts').put({
      id: entry.id,
      member_id: entry.member_id,
      alert: data,
      pending: false,
    })
  }
  await tx.objectStore('outbox').delete(entry.id)
  await tx.done
}

// ── Sincronizador ───────────────────────────────────────────

/** Resultados recientes por id de entrada, para que quien encola sepa cómo acabó. */
const results = new Map<string, unknown>()

/** `force`: ignora la espera del backoff (vuelve la red, se vuelve a la pestaña, arranque). */
async function runSync(force: boolean): Promise<void> {
  if (useOutboxStore.getState().paused) return
  const db = await getDb()
  useOutboxStore.setState({ syncing: true })
  try {
    const entries = (await db.getAll('outbox')).sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )
    for (const entry of entries) {
      const due = isDue(entry, Date.now()) || (force && entry.status === 'pending')
      if (!due) continue
      await db.put('outbox', { ...entry, status: 'sending' })
      const r = await send(entry)
      const outcome = classify(r.status)
      if (outcome === 'done') {
        await onDone(entry, r.data)
        results.set(entry.id, r.data)
      } else if (outcome === 'pause') {
        await db.put('outbox', { ...entry, status: 'pending', last_error: 'Sesión caducada (401)' })
        useOutboxStore.setState({ paused: true })
        break
      } else {
        const attempts = entry.attempts + 1
        await db.put('outbox', {
          ...entry,
          attempts,
          status: outcome === 'failed' ? 'failed' : 'pending',
          next_retry_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
          last_error: r.error ?? `HTTP ${r.status}`,
        })
        // Sin red: no tiene sentido intentar el resto ahora.
        if (r.status === 0) break
      }
    }
    useOutboxStore.setState({ lastSyncAt: new Date().toISOString() })
  } finally {
    useOutboxStore.setState({ syncing: false })
    await refreshCounts()
  }
}

let running: Promise<void> | null = null

/** Sincroniza ahora (una sola ejecución a la vez, también entre pestañas del mismo dispositivo). */
export function syncNow(force = false): Promise<void> {
  running ??= (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        await navigator.locks.request(`ruok-sync-${getDevice().id}`, () => runSync(force))
      } else {
        await runSync(force)
      }
    } catch {
      // Sin IndexedDB (modo privado) no hay outbox: no hay nada pendiente que sincronizar.
      useOutboxStore.setState({ syncing: false })
    } finally {
      running = null
    }
  })()
  return running
}

/** Reanuda tras un 401 (lo llama el login de FE-27). */
export function resumeSync(): Promise<void> {
  useOutboxStore.setState({ paused: false })
  return syncNow(true)
}

// ── Escritura ───────────────────────────────────────────────

export type SubmitResult<T> = { status: 'sent'; result: T } | { status: 'queued' }

type RuokDb = Awaited<ReturnType<typeof getDb>>

/**
 * Guarda una entrada en el outbox junto con sus escrituras locales (`local`, en la misma
 * transacción), intenta enviarla y dice si ya llegó (`sent`) o queda pendiente (`queued`).
 */
async function submit<T>(
  kind: OutboxEntry['kind'],
  id: string,
  memberId: number,
  path: string,
  body: unknown,
  local: (db: RuokDb) => Promise<void>,
): Promise<SubmitResult<T>> {
  const now = serverNow().toISOString()
  const entry: OutboxEntry = {
    id,
    kind,
    method: 'POST',
    path,
    body,
    member_id: memberId,
    created_at: now,
    attempts: 0,
    // Reloj del DISPOSITIVO, no el del servidor: `isDue()` y el backoff comparan con Date.now().
    // Con la hora del servidor, un fast-forward de la demo dejaba cada escritura "en cola"
    // (sin enviar) hasta que la hora real alcanzara a la adelantada.
    next_retry_at: new Date().toISOString(),
    status: 'pending',
    last_error: null,
  }
  let db: RuokDb
  try {
    db = await getDb()
  } catch {
    // Sin IndexedDB (modo privado): no hay outbox, se envía directamente (mismo UUID).
    const r = await send(entry)
    if (classify(r.status) === 'done') return { status: 'sent', result: r.data as T }
    throw new Error(
      'Este navegador no permite guardar datos en el dispositivo (¿modo privado?) y no hay conexión con el servidor: no se ha podido guardar. Avisa de viva voz si es urgente.',
    )
  }
  await local(db)
  await db.put('outbox', entry)
  await refreshCounts()

  await syncNow()
  if (results.has(id)) {
    const result = results.get(id) as T
    results.delete(id)
    return { status: 'sent', result }
  }
  return { status: 'queued' }
}

/**
 * Registra un lote de mediciones: se guarda en el dispositivo (también en `measurements` con
 * `synced=false`), se intenta enviar y, si no hay servidor, se envía solo después.
 */
export function sendMeasurements(
  memberId: number,
  measurements: MeasurementIn[],
): Promise<SubmitResult<MeasurementBatchResult>> {
  return submit<MeasurementBatchResult>(
    'measurement_batch',
    newId(),
    memberId,
    `/members/${memberId}/measurements`,
    { measurements },
    async (db) => {
      const tx = db.transaction('measurements', 'readwrite')
      for (const m of measurements) {
        await tx.store.put({
          id: m.id,
          member_id: memberId,
          indicator_id: m.indicator_id,
          value: m.value,
          taken_at: m.taken_at,
          source: m.source ?? 'manual',
          synced: false,
        })
      }
      await tx.done
    },
  )
}

/**
 * Pide ayuda (SOS): la alerta se guarda en el dispositivo (`alerts` con `pending=true`) con el
 * mismo UUID que en el servidor, se intenta enviar y, sin conexión, queda en el outbox.
 */
export function sendAlert(memberId: number, alert: AlertIn): Promise<SubmitResult<AlertResult>> {
  return submit<AlertResult>(
    'alert',
    alert.id,
    memberId,
    `/members/${memberId}/alerts`,
    alert,
    async (db) => {
      await db.put('alerts', { id: alert.id, member_id: memberId, alert, pending: true })
    },
  )
}

/**
 * Completa una tarea de la rutina (FE-18): el completado lleva su UUID de cliente (idempotente),
 * la tarea queda marcada en el dispositivo (`tasks`, `completed_local`) y, sin conexión, se
 * envía después. Si llega, devuelve el `GameState` actualizado (puntos, racha, insignias).
 */
export function completeTask(
  memberId: number,
  task: { id: string },
  date: string,
): Promise<SubmitResult<GameState>> {
  const completion: TaskCompleteIn = { id: newId(), completed_at: serverNow().toISOString() }
  return submit<GameState>(
    'task_completion',
    completion.id,
    memberId,
    `/members/${memberId}/tasks/${task.id}/complete`,
    { task_id: task.id, completion },
    async (db) => {
      await db.put('tasks', {
        id: task.id,
        member_id: memberId,
        date,
        task: { ...task, completed: true },
        completed_local: true,
      })
    },
  )
}

/** Tareas completadas en este dispositivo para un member y día (también las aún sin enviar). */
export async function locallyCompletedTasks(memberId: number, date: string): Promise<Set<string>> {
  const rows = await (await getDb()).getAllFromIndex('tasks', 'by_member_date', [memberId, date])
  return new Set(rows.filter((r) => r.completed_local).map((r) => r.id))
}

/**
 * "Mensaje a casa" (FE-23): el mensaje lleva su UUID de cliente (idempotente). Sin conexión
 * con el servidor de a bordo se queda en el outbox y sale solo después; el viaje por el enlace
 * con la Tierra (cola en LOS, retardo) lo lleva el servidor.
 */
export function sendHomeMessage(
  memberId: number,
  text: string,
): Promise<SubmitResult<HomeMessage>> {
  const message: HomeMessageIn = { id: newId(), text }
  return submit<HomeMessage>(
    'home_message',
    message.id,
    memberId,
    `/members/${memberId}/home-messages`,
    message,
    async () => {},
  )
}

/** Mensajes a casa de un member que siguen en este dispositivo (sin enviar o rechazados). */
export async function pendingHomeMessages(
  memberId: number,
): Promise<{ id: string; text: string; created_at: string; failed: boolean }[]> {
  const entries = await (await getDb()).getAll('outbox')
  return entries
    .filter((e) => e.kind === 'home_message' && e.member_id === memberId)
    .map((e) => ({
      id: e.id,
      text: (e.body as HomeMessageIn).text,
      created_at: e.created_at,
      failed: e.status === 'failed',
    }))
}

/**
 * Si el servidor ha rechazado la entrada (4xx), la quita del outbox y lanza el motivo: un
 * kudos o un «me apunto» rechazado no se reintenta ni se queda como pendiente para siempre.
 */
async function throwIfRejected(id: string): Promise<void> {
  const db = await getDb()
  const entry = await db.get('outbox', id)
  if (entry?.status !== 'failed') return
  await db.delete('outbox', id)
  await refreshCounts()
  let detail = entry.last_error ?? 'El servidor lo ha rechazado'
  try {
    const parsed = JSON.parse(detail) as { detail?: unknown }
    if (typeof parsed.detail === 'string') detail = parsed.detail
  } catch {
    // no era JSON: se muestra tal cual
  }
  throw new Error(detail)
}

/**
 * Da kudos a un compañero (FE-24): UUID de cliente (idempotente). Sin conexión queda en el
 * outbox y sale después. Si el servidor lo rechaza (a uno mismo, límite diario…), lanza el
 * motivo.
 */
export async function sendKudos(
  memberId: number,
  toMemberId: number,
  message: string,
): Promise<SubmitResult<Kudos>> {
  const kudos: KudosIn = { id: newId(), to_member_id: toMemberId, message }
  const r = await submit<Kudos>(
    'kudos',
    kudos.id,
    memberId,
    `/members/${memberId}/kudos`,
    kudos,
    async () => {},
  )
  if (r.status === 'queued') await throwIfRejected(kudos.id)
  return r
}

/** Se apunta a una misión de tripulación de hoy (FE-24). Apuntarse dos veces no duplica. */
export async function joinMission(
  memberId: number,
  missionId: string,
): Promise<SubmitResult<CrewMission>> {
  const id = newId()
  const r = await submit<CrewMission>(
    'mission_join',
    id,
    memberId,
    `/members/${memberId}/missions/${missionId}/join`,
    { mission_id: missionId, id },
    async () => {},
  )
  if (r.status === 'queued') await throwIfRejected(id)
  return r
}

// ── Arranque ────────────────────────────────────────────────

const TICK_MS = 5_000

/**
 * Arranca el sincronizador: recupera entradas que se quedaron "enviando" (la app se cerró a
 * mitad), y sincroniza al arrancar, con `online`, al volver a la pestaña y cada 5 s si hay
 * algo pendiente.
 */
export async function initOutbox() {
  const db = await getDb()
  for (const e of await db.getAll('outbox')) {
    if (e.status === 'sending') await db.put('outbox', { ...e, status: 'pending' })
  }
  await refreshCounts()
  const force = () => void syncNow(true)
  window.addEventListener('online', force)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') force()
  })
  setInterval(() => {
    if (useOutboxStore.getState().pending > 0) void syncNow()
  }, TICK_MS)
  force()
}

// ── Acciones sobre alertas (FE-14) ──────────────────────────
//
// Escalar, reconocer y resolver pasan por este módulo (punto único de escritura) pero NO se
// encolan: no son idempotentes (encolar dos "escalar" subiría dos niveles). Sin servidor
// lanzan NetworkError y la UI dice "sin conexión: avisa de viva voz".

export function escalateAlert(alertId: string, targetRole: string | null, message?: string) {
  return unwrap(
    api.POST('/api/v1/alerts/{alert_id}/escalate', {
      params: { path: { alert_id: alertId } },
      body: { target_role: targetRole, message: message ?? null },
    }),
  )
}

export function ackAlert(alertId: string, actor: Schema<'Actor'>) {
  return unwrap(
    api.POST('/api/v1/alerts/{alert_id}/ack', {
      params: { path: { alert_id: alertId } },
      body: { actor },
    }),
  )
}

export function resolveAlert(alertId: string, actor: Schema<'Actor'>, note?: string) {
  return unwrap(
    api.POST('/api/v1/alerts/{alert_id}/resolve', {
      params: { path: { alert_id: alertId } },
      body: { actor, note: note ?? null },
    }),
  )
}

/** Respuesta a una alerta (viaja por el enlace con su retardo si va a tierra). No se encola. */
export function sendAlertMessage(alertId: string, actor: Schema<'Actor'>, text: string) {
  return unwrap(
    api.POST('/api/v1/alerts/{alert_id}/messages', {
      params: { path: { alert_id: alertId } },
      body: { actor, text },
    }),
  )
}

// ── Controles de demo y gestión del centro de control (FE-32, solo admin) ──
//
// Acciones de operación: van directas (no se encolan). Sin servidor lanzan NetworkError.

export function demoReset() {
  return unwrap(api.POST('/api/v1/demo/reset'))
}

export function demoScenario(name: string) {
  return unwrap(api.POST('/api/v1/demo/scenarios/{name}', { params: { path: { name } } }))
}

export function demoLink(env: string, state: Schema<'LinkState'>) {
  return unwrap(api.POST('/api/v1/demo/link', { body: { env, state } }))
}

export function demoFastForward(seconds: number) {
  return unwrap(api.POST('/api/v1/demo/fast-forward', { body: { seconds } }))
}

export function pauseLiveness(envId: string, paused: boolean) {
  return unwrap(api.POST('/api/v1/control/liveness/pause', { body: { env_id: envId, paused } }))
}

// ── Señales en tiempo real (FE-15): NO se encolan ────────────
// El heartbeat y la respuesta al "R U OK?" solo tienen sentido en el momento: un heartbeat
// guardado y enviado más tarde haría creer al servidor que el member seguía vivo. Si no hay
// conexión, se pierden a propósito (el servidor marcará `stale`, que es lo correcto) y lanzan
// NetworkError. Lo que el member necesite pedir sin conexión va por el SOS, que sí se encola.

/** `POST /members/{id}/heartbeat`: señal de vida del dispositivo. */
export function sendHeartbeat(memberId: number, body: Schema<'HeartbeatIn'>) {
  return unwrap(
    api.POST('/api/v1/members/{member_id}/heartbeat', {
      params: { path: { member_id: memberId } },
      body,
    }),
  )
}

/** `POST /members/{id}/ruok`: respuesta al check-in "R U OK?". Con `ok: false` el servidor crea la alerta. */
export function answerRuok(memberId: number, ok: boolean, note?: string) {
  return unwrap(
    api.POST('/api/v1/members/{member_id}/ruok', {
      params: { path: { member_id: memberId } },
      body: { ok, note: note ?? null },
    }),
  )
}
