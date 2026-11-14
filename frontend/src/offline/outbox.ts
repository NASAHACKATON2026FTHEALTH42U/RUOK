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

/** Alerta creada (SOS / Pedir ayuda): estado, destino, modo de entrega y ETA. */
export type AlertResult = NonNullable<Awaited<ReturnType<typeof postAlert>>['data']>

function postAlert(memberId: number, alert: AlertIn) {
  return api.POST('/api/v1/members/{member_id}/alerts', {
    params: { path: { member_id: memberId } },
    body: alert,
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
  const db = await getDb()
  const now = serverNow().toISOString()
  await local(db)
  await db.put('outbox', {
    id,
    kind,
    method: 'POST',
    path,
    body,
    member_id: memberId,
    created_at: now,
    attempts: 0,
    next_retry_at: now,
    status: 'pending',
    last_error: null,
  })
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
