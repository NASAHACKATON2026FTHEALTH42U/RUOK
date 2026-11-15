import { dateLocale } from '../i18n/lang'
import { translate } from '../i18n/t'

/**
 * Formato de los datos de un entorno para las tarjetas de selección.
 * El umbral de "tiempo real" (< 5 s) es el de docs/environments.md (escalation.mode).
 */

const REALTIME_MAX_DELAY_S = 5

export function formatKind(kind: 'space' | 'earth'): string {
  return kind === 'space' ? translate('Espacio') : translate('Tierra')
}

export function formatGravity(g: number): string {
  if (g === 0) return translate('0 g · microgravedad')
  return `${g.toLocaleString(dateLocale(), { maximumFractionDigits: 2 })} g`
}

/** Retardo de comunicación de una vía. */
export function formatDelay(seconds: number): string {
  if (seconds <= 0) return translate('Sin retardo')
  if (seconds < REALTIME_MAX_DELAY_S) return translate('≈{s} s · tiempo real', { s: seconds })
  if (seconds < 60) return translate('{s} s · diferido', { s: seconds })
  return translate('{min} min · diferido', { min: Math.round(seconds / 60) })
}
