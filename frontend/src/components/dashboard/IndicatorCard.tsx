import { serverNow } from '../../api/client'
import type { Assessment } from '../../api/useAssessment'
import { formatAgo } from '../../lib/time'
import { StatusBadge } from '../ui/StatusBadge'
import { formatTrend, formatValue } from './format'

export type IndicatorAssessment = Assessment['systems'][number]['indicators'][number]

interface IndicatorCardProps {
  indicator: IndicatorAssessment
  /** Nombre del catálogo `/indicators` (si no está, se muestra el id). */
  name?: string
  /** Nombre del sistema, como subtítulo (en la cuadrícula del dashboard). */
  systemName?: string
  /** Liveness stale/lost: el estado se muestra como "Sin datos recientes". */
  stale?: boolean
  /** Si se indica, la tarjeta es un botón (p. ej. abre el SystemPanel). */
  onClick?: () => void
}

/**
 * Tarjeta de un indicador: valor y unidad, semáforo, tendencia (flecha + texto) y antigüedad.
 * TODO(FE-08): añadir la TrendChart con las bandas de umbral.
 */
export function IndicatorCard({ indicator, name, systemName, stale, onClick }: IndicatorCardProps) {
  const trend = formatTrend(indicator.trend)
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span>
          <span className="block font-medium">{name ?? indicator.indicator_id}</span>
          {systemName && <span className="block text-xs text-env-muted">{systemName}</span>}
        </span>
        <StatusBadge status={stale ? 'stale' : indicator.status} size="sm" />
      </span>
      <span className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="text-lg font-semibold">
          {formatValue(indicator.last_value, indicator.unit)}
        </span>
        <span className="text-env-muted">
          <span aria-hidden>{trend.arrow}</span> {trend.label}
        </span>
        <span className="text-env-muted">
          {indicator.taken_at ? formatAgo(indicator.taken_at, serverNow()) : 'Nunca medido'}
        </span>
      </span>
    </>
  )
  const cls = 'block w-full rounded-lg border border-env-border bg-env-surface p-3 text-left'

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${cls} hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary`}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}
