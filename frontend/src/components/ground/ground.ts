/** Lógica pura de la consola /ground (FE-16, docs/offline-and-liveness.md §3). */
import type { Role } from '../../auth/roles'
import { formatAgo } from '../../lib/time'
import { formatDelay, hhmm, type LinkLike } from '../ui/link'

export type BannerTone = 'live' | 'delayed' | 'unknown'

/**
 * Banner del enlace. Con retardo, "estás viendo el estado de hace N min"; con LOS, el estado
 * actual es DESCONOCIDO (gris, nunca verde) y solo se muestra el último conocido.
 */
export function linkBanner(
  link: LinkLike,
  asOf: string,
  now: Date,
): { tone: BannerTone; text: string } {
  const asOfText = `Datos a las ${hhmm(asOf)} (${formatAgo(asOf, now)})`
  switch (link.state) {
    case 'los':
      return {
        tone: 'unknown',
        text: `Enlace caído desde las ${hhmm(link.since)}. Estado actual DESCONOCIDO; lo que ves es el último conocido. ${asOfText}.`,
      }
    case 'delayed':
      return {
        tone: 'delayed',
        text: `Estás viendo el estado de hace ${formatDelay(link.delay_s)} (retardo del enlace). ${asOfText}.`,
      }
    default:
      return { tone: 'live', text: `Enlace en línea. ${asOfText}.` }
  }
}

/**
 * Privacidad conductual (CLAUDE.md, principio 8): el detalle de una alerta psicológica solo lo ve
 * `psych` (o `admin`), salvo emergencia o que el member comparta sus detalles.
 */
export function canSeeDetails(
  alert: { category: string; severity: string },
  role: Role | null,
  memberShares: boolean,
): boolean {
  if (alert.category !== 'psychological') return true
  return role === 'psych' || role === 'admin' || alert.severity === 'emergency' || memberShares
}
