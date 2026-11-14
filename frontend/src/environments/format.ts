/**
 * Formato de los datos de un entorno para las tarjetas de selección.
 * El umbral de "tiempo real" (< 5 s) es el de docs/environments.md (escalation.mode).
 */

const REALTIME_MAX_DELAY_S = 5

export function formatKind(kind: 'space' | 'earth'): string {
  return kind === 'space' ? 'Espacio' : 'Tierra'
}

export function formatGravity(g: number): string {
  if (g === 0) return '0 g · microgravedad'
  return `${g.toLocaleString('es-ES', { maximumFractionDigits: 2 })} g`
}

/** Retardo de comunicación de una vía. */
export function formatDelay(seconds: number): string {
  if (seconds <= 0) return 'Sin retardo'
  if (seconds < REALTIME_MAX_DELAY_S) return `≈${seconds} s · tiempo real`
  if (seconds < 60) return `${seconds} s · diferido`
  return `${Math.round(seconds / 60)} min · diferido`
}
