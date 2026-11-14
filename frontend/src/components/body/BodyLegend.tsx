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
}: BodyLegendProps) {
  return (
    <ul
      className={`flex w-full flex-wrap ${compact ? 'gap-1.5' : 'gap-2'} ${className}`}
      aria-label="Sistemas"
    >
      {regions.map((r) => (
        <li key={r.systemId}>
          <button
            type="button"
            onClick={() => onSelectSystem?.(r.systemId)}
            onPointerEnter={() => onHoverSystem?.(r.systemId)}
            onPointerLeave={() => onHoverSystem?.(null)}
            onFocus={() => onHoverSystem?.(r.systemId)}
            onBlur={() => onHoverSystem?.(null)}
            aria-pressed={selectedSystemId === r.systemId}
            className={`flex items-center gap-2 rounded-lg border ${compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
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
