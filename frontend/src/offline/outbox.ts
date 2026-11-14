import { api, unwrap, type Schema } from '../api/client'

export type MeasurementIn = Schema<'MeasurementIn'>

/**
 * Punto único de escritura de mediciones (CLAUDE.md: toda escritura pasa por el outbox).
 * Cada medición lleva su UUID de cliente: reintentar con los mismos ids es idempotente.
 *
 * TODO(FE-11): guardar primero en IndexedDB y sincronizar después; de momento envía directo
 * y, si falla la red, lanza NetworkError para que el formulario conserve los datos y reintente.
 */
export function sendMeasurements(memberId: number, measurements: MeasurementIn[]) {
  return unwrap(
    api.POST('/api/v1/members/{member_id}/measurements', {
      params: { path: { member_id: memberId } },
      body: { measurements },
    }),
  )
}

/** Respuesta del lote: aceptadas, duplicadas y la evaluación ya actualizada. */
export type MeasurementBatchResult = Awaited<ReturnType<typeof sendMeasurements>>
