/**
 * Registro del centro de control: incidencias resueltas y eventos importantes de la app (alertas,
 * notificaciones, usuarios, accesos, logros, dispositivos, contacto y enlace). Lo ruidoso
 * (heartbeats, cada medición, la cola del enlace, la sincronización) se queda fuera.
 */
import type { Schema } from '../../api/client'
import type { RealtimeEvent } from '../../realtime/match'

type EventType = Schema<'EventType'>

export interface LogGroup {
  label: string
  types: EventType[]
}

export const LOG_GROUPS: Record<string, LogGroup> = {
  resolved: { label: 'Incidencias resueltas', types: ['alert.resolved'] },
  alerts: {
    label: 'Alertas',
    types: ['alert.created', 'alert.escalated', 'alert.acknowledged', 'alert.resolved'],
  },
  notifications: { label: 'Notificaciones', types: ['notification.sent'] },
  users: { label: 'Usuarios y accesos', types: ['user.created', 'auth.login', 'auth.failed'] },
  achievements: { label: 'Misiones y logros', types: ['task.completed'] },
  devices: { label: 'Dispositivos', types: ['device.registered'] },
  contact: { label: 'Contacto y enlace', types: ['liveness.changed', 'link.state_changed'] },
}

/** Todos los tipos que entran en el registro. */
export const LOG_TYPES: EventType[] = [
  ...new Set(Object.values(LOG_GROUPS).flatMap((g) => g.types)),
]

export const TYPE_LABEL: Partial<Record<EventType, string>> = {
  'alert.created': 'Alerta creada',
  'alert.escalated': 'Alerta escalada',
  'alert.acknowledged': 'Alerta recibida',
  'alert.resolved': 'Incidencia resuelta',
  'notification.sent': 'Notificación',
  'user.created': 'Usuario creado',
  'auth.login': 'Inicio de sesión',
  'auth.failed': 'Acceso fallido',
  'task.completed': 'Misión cumplida',
  'device.registered': 'Dispositivo conectado',
  'liveness.changed': 'Contacto',
  'link.state_changed': 'Enlace',
}

/** Tono de la fila: lo resuelto en verde, lo que pide atención en ámbar/rojo, el resto neutro. */
export function toneOf(e: RealtimeEvent): 'resolved' | 'attention' | 'neutral' {
  if (e.type === 'alert.resolved') return 'resolved'
  if (e.type === 'alert.created' || e.type === 'alert.escalated' || e.type === 'auth.failed')
    return 'attention'
  return 'neutral'
}

/** Filtra por grupo ('' = todos) y por member (null = todo el entorno). */
export function filterLog(
  events: RealtimeEvent[],
  group: string,
  memberId: number | null,
): RealtimeEvent[] {
  const types = group ? LOG_GROUPS[group]?.types : LOG_TYPES
  return events.filter(
    (e) => (types ?? LOG_TYPES).includes(e.type) && (memberId === null || e.member_id === memberId),
  )
}
