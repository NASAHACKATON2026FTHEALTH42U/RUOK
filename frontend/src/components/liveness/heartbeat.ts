import type { Schema } from '../../api/client'
import { formatDelay } from '../ui/link'

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
export type LivenessThresholds = Schema<'LivenessThresholds'>

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

/**
 * Qué cambia al elegir cada actividad, en una frase para el selector. Los tiempos salen del
 * perfil del entorno (`environment.liveness`); sin perfil cargado, la frase va sin números.
 * Al pasar a "sin señal" (stale) el sistema pregunta «R U OK?»; si nadie responde o se pierde
 * la señal (lost), salta la alerta de "sin contacto" (docs/offline-and-liveness.md).
 * `short`: versión de una o dos líneas para la barra lateral (la completa va en el `title`).
 */
export function activityHint(
  activity: Activity,
  isSpace: boolean,
  liveness?: LivenessThresholds,
  { short = false }: { short?: boolean } = {},
): string {
  const t = (s: number) => formatDelay(s)
  switch (activity) {
    case 'normal':
      if (short)
        return liveness
          ? `Sin señal ${t(liveness.stale_after_s)}: «R U OK?». Sin respuesta: alerta.`
          : 'Sin señal: «R U OK?». Sin respuesta: alerta.'
      return liveness
        ? `Si tu dispositivo pasa ${t(liveness.stale_after_s)} sin dar señal, te preguntamos «R U OK?». Si no respondes, salta una alerta.`
        : 'Si tu dispositivo deja de dar señal, te preguntamos «R U OK?». Si no respondes, salta una alerta.'
    case 'eva': {
      if (short) {
        const who = isSpace ? 'EVA' : 'Riesgo'
        return liveness
          ? `${who}: «R U OK?» a los ${t(liveness.eva_stale_after_s)} sin señal y alerta a los ${t(liveness.eva_lost_after_s)}.`
          : `${who}: los avisos llegan mucho antes.`
      }
      const what = isSpace ? 'Salida al exterior (EVA)' : 'Actividad de riesgo'
      return liveness
        ? `${what}: se vigila más de cerca. La pregunta llega a los ${t(liveness.eva_stale_after_s)} sin señal y la alerta, a los ${t(liveness.eva_lost_after_s)}.`
        : `${what}: se vigila más de cerca y los avisos llegan mucho antes.`
    }
    case 'sleep':
      if (short)
        return liveness
          ? `Sueño: se espera ×${liveness.sleep_factor} (${t(liveness.stale_after_s * liveness.sleep_factor)}) para no despertarte.`
          : 'Sueño: se espera más para no despertarte.'
      return liveness
        ? `Para dormir: se espera ×${liveness.sleep_factor} (${t(liveness.stale_after_s * liveness.sleep_factor)} sin señal) antes de preguntar, para no despertarte.`
        : 'Para dormir: se espera más antes de preguntar, para no despertarte.'
  }
}
