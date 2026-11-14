import { ApiError, NetworkError } from '../api/client'
import { getDb } from './db'

/**
 * Caché local en IndexedDB para seguir funcionando sin conexión (FE-11, data-model.md §2).
 * Es una réplica: el servidor manda. Solo se usa si el servidor no está disponible.
 */

/** Sin red, o el servidor no responde (502/503/504 de un proxy o pasarela). */
export function isUnavailable(err: unknown): boolean {
  return (
    err instanceof NetworkError || (err instanceof ApiError && [502, 503, 504].includes(err.status))
  )
}

export type CatalogKey = 'environments' | 'indicators' | 'systems' | 'interventions' | 'protocols'

/** Envuelve la carga de un catálogo: guarda cada respuesta y, sin red, devuelve la última. */
export function withCatalogCache<T>(key: CatalogKey, load: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      const value = await load()
      void getDb().then((db) =>
        db.put('catalog', { key, value, fetched_at: new Date().toISOString() }),
      )
      return value
    } catch (err) {
      if (!isUnavailable(err)) throw err
      const cached = await (await getDb()).get('catalog', key)
      if (cached) return cached.value as T
      throw err
    }
  }
}

/** Guarda la última evaluación recibida del servidor. */
export async function saveAssessment(memberId: number, assessment: unknown): Promise<void> {
  const db = await getDb()
  await db.put('assessments', {
    member_id: memberId,
    assessment,
    received_at: new Date().toISOString(),
    provisional: false,
  })
}

/** Última evaluación guardada en el dispositivo (o undefined). */
export async function loadCachedAssessment<T>(memberId: number): Promise<T | undefined> {
  const row = await (await getDb()).get('assessments', memberId)
  return row?.assessment as T | undefined
}
