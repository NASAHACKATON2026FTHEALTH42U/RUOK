import type { Schema } from '../../api/client'

/**
 * Lógica pura del heartbeat (FE-15, docs/offline-and-liveness.md §2). Los umbrales de
 * liveness (stale/lost, EVA, sueño) NO están aquí: los aplica el servidor con
 * `environment.liveness`. El front solo da señales de vida.
 */

/** Cada cuánto se envía el heartbeat (contrato: cada 15 s). */
export const HEARTBEAT_MS = 15_000

export type Activity = Schema<'Activity'>
export type DeviceKind = Schema<'DeviceKind'>
export type HeartbeatIn = Schema<'HeartbeatIn'>

/**
 * Tipo de dispositivo para el registro de dispositivos (`/control`): pantalla táctil
 * (puntero "coarse") estrecha → móvil, ancha → tablet; con ratón → ordenador.
 */
export function detectDeviceKind(coarsePointer: boolean, screenWidth: number): DeviceKind {
  if (!coarsePointer) return 'desktop'
  return screenWidth < 768 ? 'mobile' : 'tablet'
}

/** Tipo de este dispositivo según el navegador. */
export function currentDeviceKind(): DeviceKind {
  const coarse =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
  const width =
    typeof window !== 'undefined' ? Math.min(window.screen.width, window.screen.height) : 1024
  return detectDeviceKind(coarse, width)
}

/** Cuerpo del heartbeat con la actividad y el estado del outbox de este dispositivo. */
export function buildHeartbeat(opts: {
  deviceId: string
  activity: Activity
  pendingOutbox: number
  lastSyncAt: string | null
  deviceKind: DeviceKind
}): HeartbeatIn {
  return {
    device_id: opts.deviceId,
    activity: opts.activity,
    pending_outbox: Math.max(0, opts.pendingOutbox),
    last_sync_at: opts.lastSyncAt,
    device_kind: opts.deviceKind,
  }
}

/**
 * Etiquetas del selector de actividad. "EVA" solo tiene sentido en el espacio; en la Tierra
 * se habla de "actividad de riesgo" (mismos umbrales estrictos, docs/offline-and-liveness.md).
 */
export function activityOptions(isSpace: boolean): { id: Activity; label: string }[] {
  return [
    { id: 'normal', label: 'Normal' },
    { id: 'eva', label: isSpace ? 'EVA' : 'Actividad de riesgo' },
    { id: 'sleep', label: 'Sueño' },
  ]
}
