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
 * Paleta fija del semáforo: NO depende del tema del entorno. Valores del estilo HUD
 * (docs/design/hud-style.md §2–3): **nominal en cian**, no en verde. Son los mismos que
 * `--color-st-*` de styles/index.css (clases text-st-ok…); si cambias uno, cambia el otro.
 * Sobre los fondos oscuros, los cuatro superan 4.5:1. En los temas claros (hospital,
 * geriatría) el cian y el ámbar tienen poco contraste: por eso la etiqueta va siempre con
 * el color de texto del tema y el icono lleva contorno (el estado nunca depende del color).
 */
export const STATUS_COLORS = {
  normal: '#5fd4e8',
  warning: '#f5a623',
  critical: '#ff6b6b',
  unknown: '#7c9aa3',
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
