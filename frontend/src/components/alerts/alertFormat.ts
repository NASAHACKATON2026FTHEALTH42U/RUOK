/** Formato y reglas puras del panel de alertas (FE-14, docs/alerts-and-escalation.md). */
import type { Schema } from '../../api/client'
import type { IconGlyph } from '../ui/Icon'
import type { Status } from '../ui/status'
import { EN } from '../../i18n/en'
import { translate } from '../../i18n/t'

const CATEGORY: Record<Schema<'AlertCategory'>, string> = {
  symptom: 'Síntoma',
  physical: 'Malestar físico',
  psychological: 'Necesito hablar',
  emergency: 'Emergencia',
  no_contact: 'Sin contacto',
  indicator: 'Indicador fuera de rango',
}
export const categoryLabel = (c: Schema<'AlertCategory'>) =>
  CATEGORY[c] ? translate(CATEGORY[c]) : c

/** ¿El mensaje es solo el nombre de la categoría (en cualquier idioma)? Entonces no se repite. */
export function isCategoryLabel(message: string, c: Schema<'AlertCategory'>): boolean {
  const es = CATEGORY[c]
  return message === es || message === EN[es] || message === categoryLabel(c)
}

const SEVERITY: Record<Schema<'AlertSeverity'>, { label: string; status: Status }> = {
  warning: { label: 'Atención', status: 'warning' },
  critical: { label: 'Urgente', status: 'critical' },
  emergency: { label: 'Emergencia', status: 'critical' },
}
/** Severidad → etiqueta + color del semáforo (emergency se pinta como crítico). */
export const severityStyle = (s: Schema<'AlertSeverity'>) =>
  SEVERITY[s] && { ...SEVERITY[s], label: translate(SEVERITY[s].label) }

const STATUS: Record<Schema<'AlertStatus'>, string> = {
  open: 'Abierta',
  escalated: 'Escalada',
  acknowledged: 'Recibida',
  resolved: 'Resuelta',
}
export const statusLabel = (s: Schema<'AlertStatus'>) => (STATUS[s] ? translate(STATUS[s]) : s)

const EVENT: Record<Schema<'AlertEventType'>, { icon: IconGlyph; label: string }> = {
  created: { icon: 'plus', label: 'Creada' },
  updated: { icon: 'refresh', label: 'Actualizada' },
  escalated: { icon: 'escalate', label: 'Escalada' },
  queued: { icon: 'hourglass', label: 'En cola del enlace' },
  delivered: { icon: 'check', label: 'Entregada' },
  acknowledged: { icon: 'eye', label: 'Recibida por el equipo' },
  message: { icon: 'message', label: 'Mensaje' },
  resolved: { icon: 'stop', label: 'Resuelta' },
}
export const eventStyle = (t: Schema<'AlertEventType'>): { icon: IconGlyph; label: string } =>
  EVENT[t] ? { ...EVENT[t], label: translate(EVENT[t].label) } : { icon: 'refresh', label: t }

const ACTOR: Record<Schema<'Actor'>, string> = {
  system: 'sistema',
  member: 'member',
  responder: 'equipo de respuesta',
}
export const actorLabel = (a: Schema<'Actor'>) => (ACTOR[a] ? translate(ACTOR[a]) : a)

/** Abiertas primero (las más graves y recientes arriba); las resueltas al final. */
export function sortAlerts<
  T extends { status: string; severity: Schema<'AlertSeverity'>; created_at: string },
>(alerts: T[]): T[] {
  const rank = { emergency: 0, critical: 1, warning: 2 } as const
  return [...alerts].sort(
    (a, b) =>
      Number(a.status === 'resolved') - Number(b.status === 'resolved') ||
      rank[a.severity] - rank[b.severity] ||
      b.created_at.localeCompare(a.created_at),
  )
}

/**
 * Alertas de todo el entorno (FE-35): las de cada member en una sola lista, con su nombre y
 * el mismo orden que `sortAlerts`.
 */
export function mergeMemberAlerts<
  T extends { status: string; severity: Schema<'AlertSeverity'>; created_at: string },
>(groups: { memberId: number; memberName: string; alerts: T[] }[]) {
  return sortAlerts(
    groups.flatMap((g) =>
      g.alerts.map((a) => ({ ...a, memberId: g.memberId, memberName: g.memberName })),
    ),
  )
}

/** Niveles a los que se puede escalar: los que están POR ENCIMA del destino actual. */
export function escalationTargets(ladder: string[], current: string): string[] {
  const i = ladder.indexOf(current)
  return ladder.slice(i < 0 ? 1 : i + 1).filter((r) => r !== 'self')
}

/** Cuenta atrás hasta la ETA ("12:34", "1:02:03") o null si ya pasó. */
export function countdown(etaIso: string, nowMs: number): string | null {
  const s = Math.ceil((Date.parse(etaIso) - nowMs) / 1000)
  if (s <= 0) return null
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
