import { STATUS_COLORS, statusStyle, type DisplayState, type StatusGlyph } from './status'

interface StatusBadgeProps {
  status: DisplayState
  /** Sustituye la etiqueta por defecto (p. ej. "Sin datos desde hace 12 min"). */
  label?: string
  /** `xs`: muy pequeño, para la barra superior. */
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

const STRIPES = `repeating-linear-gradient(135deg, color-mix(in srgb, ${STATUS_COLORS.unknown} 28%, transparent) 0 3px, transparent 3px 7px)`

/**
 * Semáforo de estado con forma de chip HUD (docs/design/hud-style.md): borde de 1 px del
 * color del estado, icono (forma + símbolo) y etiqueta en mono mayúscula. Nunca solo color:
 * la etiqueta va con el color de texto del tema. `unknown`, `stale` y `lost` llevan fondo
 * rayado y nunca se pintan en el color nominal.
 */
export function StatusBadge({ status, label, size = 'md', className = '' }: StatusBadgeProps) {
  const s = statusStyle(status)
  const icon = size === 'xs' ? 10 : size === 'sm' ? 14 : 16

  return (
    <span
      className={`inline-flex items-center border bg-env-surface font-mono font-normal whitespace-nowrap text-env-text uppercase ${
        size === 'xs'
          ? 'gap-1 px-1 py-px text-xs tracking-[0.04em]'
          : size === 'sm'
            ? 'gap-1.5 px-1.5 py-0.5 text-xs tracking-[0.1em]'
            : 'gap-1.5 px-2 py-1 text-[0.75rem] tracking-[0.1em]'
      } ${className}`}
      style={{ borderColor: s.color, ...(s.striped ? { backgroundImage: STRIPES } : {}) }}
      data-status={status}
    >
      <StatusIcon glyph={s.glyph} color={s.color} size={icon} />
      {label ?? s.label}
    </span>
  )
}

/** Icono del estado. El contorno usa el color de texto del tema para verse en cualquier fondo. */
export function StatusIcon({
  glyph,
  color,
  size = 16,
}: {
  glyph: StatusGlyph
  color: string
  size?: number
}) {
  const outline = {
    fill: color,
    stroke: 'var(--env-text)',
    strokeOpacity: 0.35,
    strokeWidth: 1,
  }
  // Símbolo interior: oscuro sobre ámbar (contraste), blanco sobre el resto.
  const ink = glyph === 'alert' ? '#0b0b0b' : '#ffffff'
  const line = {
    stroke: ink,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }

  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" className="shrink-0">
      {glyph === 'check' && (
        <>
          <circle cx="8" cy="8" r="7.5" {...outline} />
          <path d="M4.8 8.3l2.1 2.1 4.3-4.6" {...line} />
        </>
      )}
      {glyph === 'alert' && (
        <>
          <path d="M8 1L15.3 14.5H0.7Z" {...outline} strokeLinejoin="round" />
          <path d="M8 6v3.6" {...line} />
          <circle cx="8" cy="12" r="1" fill={ink} />
        </>
      )}
      {glyph === 'cross' && (
        <>
          <path d="M5.1 0.5h5.8l4.6 4.6v5.8l-4.6 4.6H5.1L0.5 10.9V5.1Z" {...outline} />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" {...line} />
        </>
      )}
      {glyph === 'question' && (
        <>
          <circle cx="8" cy="8" r="7.5" {...outline} />
          <path d="M6 6.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.3" {...line} strokeWidth={1.8} />
          <circle cx="8" cy="11.9" r="0.95" fill={ink} />
        </>
      )}
      {glyph === 'no-signal' && (
        <>
          <circle cx="8" cy="8" r="7.5" {...outline} />
          <path d="M4.5 9.5a5 5 0 0 1 7 0M6.3 11.3a2.4 2.4 0 0 1 3.4 0M3.5 3.5l9 9" {...line} />
        </>
      )}
    </svg>
  )
}
