import type { Schema } from '../../api/client'

export type Status = Schema<'Status'>
export type Liveness = Schema<'Liveness'>

/** Todo lo que puede pintar un StatusBadge: el estado de salud o un liveness degradado. */
export type DisplayState = Status | Exclude<Liveness, 'active'>

export type StatusGlyph = 'check' | 'alert' | 'cross' | 'question' | 'no-signal'

export interface StatusStyle {
  label: string
  /** Color del icono. Nunca se usa para el texto (el texto va en los tokens del tema). */
  color: string
  /** Forma + símbolo: el estado nunca depende solo del color. */
  glyph: StatusGlyph
  /** Rayado gris = sin datos fiables (docs/offline-and-liveness.md). */
  striped: boolean
}

/**
 * Paleta fija del semáforo: NO depende del tema del entorno.
 * Validada con dataviz/validate_palette.js en las superficies de los 7 temas: separación CVD
 * ΔE ≥ 9; en los temas claros el verde y el ámbar bajan de 3:1, por eso la etiqueta es
 * siempre visible y el icono lleva contorno.
 */
export const STATUS_COLORS = {
  normal: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  unknown: '#898781',
} as const

const STYLES: Record<DisplayState, StatusStyle> = {
  normal: { label: 'Normal', color: STATUS_COLORS.normal, glyph: 'check', striped: false },
  warning: { label: 'Atención', color: STATUS_COLORS.warning, glyph: 'alert', striped: false },
  critical: { label: 'Crítico', color: STATUS_COLORS.critical, glyph: 'cross', striped: false },
  unknown: { label: 'Sin datos', color: STATUS_COLORS.unknown, glyph: 'question', striped: true },
  stale: {
    label: 'Sin datos recientes',
    color: STATUS_COLORS.unknown,
    glyph: 'question',
    striped: true,
  },
  lost: { label: 'Sin contacto', color: STATUS_COLORS.critical, glyph: 'no-signal', striped: true },
}

/** Estilo de un estado. `unknown`, `stale` y `lost` nunca son verdes. */
export function statusStyle(state: DisplayState): StatusStyle {
  return STYLES[state]
}

/** Liveness que hay que señalar, o `null` si el dispositivo está activo. */
export function livenessState(liveness: Liveness): DisplayState | null {
  return liveness === 'active' ? null : liveness
}

/** Orden por gravedad para listar lo urgente primero (sin datos va por delante de normal). */
const SEVERITY: Record<Status, number> = { critical: 0, warning: 1, unknown: 2, normal: 3 }

export function bySeverity(a: Status, b: Status): number {
  return SEVERITY[a] - SEVERITY[b]
}
