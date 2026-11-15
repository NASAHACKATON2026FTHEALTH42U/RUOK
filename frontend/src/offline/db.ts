import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { getDevice } from './device'

/**
 * Base IndexedDB del dispositivo: `ruok-<device_id>` (docs/data-model.md §2).
 * Cada dispositivo o pestaña tiene la suya: su propio outbox, caché y sesión.
 * Es una réplica parcial para no perder nada sin conexión; NO es fuente de verdad.
 */

export type OutboxStatus = 'pending' | 'sending' | 'failed'

export interface OutboxEntry {
  /** UUID del recurso (el mismo que va en el cuerpo y en la PK de SQLite). */
  id: string
  kind:
    | 'measurement_batch'
    | 'task_completion'
    | 'alert'
    | 'ruok'
    | 'privacy'
    | 'home_message'
    | 'kudos'
    | 'mission_join'
  method: 'POST' | 'PATCH'
  path: string
  body: unknown
  member_id: number
  created_at: string
  attempts: number
  /** Cuándo toca el siguiente intento, con el reloj del DISPOSITIVO (se compara con Date.now()). */
  next_retry_at: string
  status: OutboxStatus
  last_error: string | null
}

export interface RuokDB extends DBSchema {
  outbox: {
    key: string
    value: OutboxEntry
    indexes: { by_status_created: [OutboxStatus, string] }
  }
  measurements: {
    key: string
    value: {
      id: string
      member_id: number
      indicator_id: string
      value: number
      taken_at: string
      source: string
      synced: boolean
    }
    indexes: { by_series: [number, string, string] }
  }
  assessments: {
    key: number
    value: { member_id: number; assessment: unknown; received_at: string; provisional: boolean }
  }
  catalog: {
    key: string
    value: { key: string; value: unknown; fetched_at: string }
  }
  alerts: {
    key: string
    value: { id: string; member_id: number; alert: unknown; pending: boolean }
    indexes: { by_member: number }
  }
  tasks: {
    key: string
    value: { id: string; member_id: number; date: string; task: unknown; completed_local: boolean }
    indexes: { by_member_date: [number, string] }
  }
  kv: {
    key: string
    value: { key: string; value: unknown }
  }
}

export const DB_VERSION = 1

export function dbName(deviceId: string): string {
  return `ruok-${deviceId}`
}

let dbPromise: Promise<IDBPDatabase<RuokDB>> | null = null

/** Abre (una sola vez) la base del dispositivo actual y registra su identidad en `kv`. */
export function getDb(): Promise<IDBPDatabase<RuokDB>> {
  // async: si IndexedDB no existe (modo privado), openDB lanza de forma síncrona; así se
  // convierte en una promesa rechazada y quien llama decide qué hacer (FE-34).
  dbPromise ??= (async () =>
    openDB<RuokDB>(dbName(getDevice().id), DB_VERSION, {
      upgrade(db) {
        const outbox = db.createObjectStore('outbox', { keyPath: 'id' })
        outbox.createIndex('by_status_created', ['status', 'created_at'])
        const ms = db.createObjectStore('measurements', { keyPath: 'id' })
        ms.createIndex('by_series', ['member_id', 'indicator_id', 'taken_at'])
        db.createObjectStore('assessments', { keyPath: 'member_id' })
        db.createObjectStore('catalog', { keyPath: 'key' })
        const alerts = db.createObjectStore('alerts', { keyPath: 'id' })
        alerts.createIndex('by_member', 'member_id')
        const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
        tasks.createIndex('by_member_date', ['member_id', 'date'])
        db.createObjectStore('kv', { keyPath: 'key' })
      },
    }))().then(async (db) => {
    const d = getDevice()
    await db.put('kv', { key: 'device_id', value: d.id })
    await db.put('kv', { key: 'device_name', value: d.name })
    return db
  })
  return dbPromise
}
