/** Texto del estado del enlace simulado (FE-17). Lógica pura, fácil de testear. */

export interface LinkLike {
  state: 'online' | 'delayed' | 'los'
  delay_s: number
  queued: number
  since: string
}

/** Retardo de una vía legible: "14 min", "2 s". */
export function formatDelay(s: number): string {
  return s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`
}

/** Hora local "14:02" de una fecha ISO. */
export function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Icono (forma, no color), texto corto (móvil) y texto completo de un estado del enlace.
 * `null` = no se pudo consultar: el estado es DESCONOCIDO, nunca el último visto.
 */
export function describeLink(link: LinkLike | null): { icon: string; short: string; long: string } {
  if (!link) return { icon: '?', short: 'Desconocido', long: 'estado desconocido' }
  const queued = link.queued > 0 ? ` · ${link.queued} en cola` : ''
  switch (link.state) {
    case 'online':
      return { icon: '●', short: 'En línea', long: `en línea${queued}` }
    case 'delayed':
      return {
        icon: '◐',
        short: formatDelay(link.delay_s),
        long: `con retardo · ${formatDelay(link.delay_s)}${queued}`,
      }
    case 'los':
      return {
        icon: '○',
        short: 'Sin enlace',
        long: `sin enlace (LOS) desde las ${hhmm(link.since)}${queued}`,
      }
  }
}
