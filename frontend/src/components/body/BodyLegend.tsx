import { useT } from '../../i18n/t'
import { StatusBadge } from '../ui/StatusBadge'
import type { RegionState } from './regions'

interface BodyLegendProps {
  regions: RegionState[]
  /** Liveness stale/lost: los estados se muestran como "sin datos recientes". */
  stale: boolean
  selectedSystemId?: string | null
  onSelectSystem?: (systemId: string) => void
  /** Al pasar o enfocar un sistema, se señala su zona en la figura. */
  onHoverSystem?: (systemId: string | null) => void
  className?: string
  /** Botones más pequeños (leyenda en la columna derecha del panel). */
  compact?: boolean
  /** En columna, cada sistema a todo el ancho (columna de sistemas del panel). */
  vertical?: boolean
  /**
   * Filas del panel «Sistemas»: el nombre y, debajo, el estado (todas las filas iguales, quepa o
   * no el nombre en una línea), separadas por líneas y sin cajas redondeadas.
   * `className` va a la lista (p. ej. dos columnas en tableta).
   */
  rows?: boolean
}

/** Leyenda de sistemas del cuerpo: misma información que la figura sin depender del color. */
export function BodyLegend({
  regions,
  stale,
  selectedSystemId,
  onSelectSystem,
  onHoverSystem,
  className = 'justify-center',
  compact = false,
  vertical = false,
  rows = false,
}: BodyLegendProps) {
  const t = useT()
  if (rows) {
    return (
      <ul className={`grid ${className}`} aria-label={t('Sistemas')}>
        {regions.map((r) => (
          <li key={r.systemId} className="dash-cell border-r border-b border-env-border/60">
            <button
              type="button"
              onClick={() => onSelectSystem?.(r.systemId)}
              onPointerEnter={() => onHoverSystem?.(r.systemId)}
              onPointerLeave={() => onHoverSystem?.(null)}
              onFocus={() => onHoverSystem?.(r.systemId)}
              onBlur={() => onHoverSystem?.(null)}
              aria-pressed={selectedSystemId === r.systemId}
              className={`flex h-full min-h-11 w-full flex-col items-start justify-center gap-[0.45em] px-[clamp(0.75rem,6cqw,1.25rem)] py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary ${
                selectedSystemId === r.systemId
                  ? 'bg-env-primary/10 shadow-[inset_2px_0_0_var(--env-primary)]'
                  : 'hover:bg-env-primary/10'
              }`}
            >
              <span className="dash-sys-name min-w-0">{r.name}</span>
              <StatusBadge
                status={stale ? 'stale' : r.status}
                className="!text-[clamp(10px,min(5cqw,14cqh),13px)]"
              />
            </button>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul
      className={`flex w-full font-mono ${vertical ? 'flex-col' : 'flex-wrap'} ${compact ? 'gap-1.5' : 'gap-2'} ${className}`}
      aria-label={t('Sistemas')}
    >
      {regions.map((r) => (
        <li key={r.systemId} className={vertical ? 'w-full' : undefined}>
          <button
            type="button"
            onClick={() => onSelectSystem?.(r.systemId)}
            onPointerEnter={() => onHoverSystem?.(r.systemId)}
            onPointerLeave={() => onHoverSystem?.(null)}
            onFocus={() => onHoverSystem?.(r.systemId)}
            onBlur={() => onHoverSystem?.(null)}
            aria-pressed={selectedSystemId === r.systemId}
            className={`flex items-center gap-2  border ${vertical ? 'w-full justify-between text-left' : ''} ${compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
              selectedSystemId === r.systemId
                ? 'border-env-text bg-env-surface'
                : 'border-env-border hover:bg-env-surface'
            }`}
          >
            {r.name}
            <StatusBadge status={stale ? 'stale' : r.status} size="sm" />
          </button>
        </li>
      ))}
    </ul>
  )
}
