import { serverNow } from '../../api/client'
import type { Assessment } from '../../api/useAssessment'
import { formatAgo } from '../../lib/time'
import { statusStyle } from '../ui/status'
import { StatusBadge, StatusIcon } from '../ui/StatusBadge'
import { formatTrend, formatValue } from './format'
import { TrendChart } from './TrendChart'

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
  /** Muestra la TrendChart (7/30 días) del indicador debajo del valor. */
  showTrend?: boolean
  /** Estado calculado en el dispositivo con una medición aún sin sincronizar (FE-12). */
  provisional?: boolean
  /**
   * Versión mínima (columna de indicadores del panel): símbolo de estado junto al nombre y el
   * valor; sin sistema, tendencia ni antigüedad (están en el detalle del sistema).
   */
  compact?: boolean
}

/**
 * Tarjeta de un indicador: valor y unidad, semáforo, tendencia (flecha + texto), antigüedad y,
 * con `showTrend`, la TrendChart con las bandas de umbral (FE-08).
 */
export function IndicatorCard({
  indicator,
  name,
  systemName,
  stale,
  onClick,
  showTrend,
  provisional,
  compact = false,
}: IndicatorCardProps) {
  const trend = formatTrend(indicator.trend)
  const st = statusStyle(stale ? 'stale' : indicator.status)
  const stateLabel = provisional && !stale ? `${st.label} · provisional` : st.label
  const compactBody = (
    <span className="flex items-center justify-between gap-3" title={stateLabel}>
      <span className="flex min-w-0 items-center gap-2">
        {/* Símbolo de estado (forma, no solo color) y su texto para lectores de pantalla. */}
        <StatusIcon glyph={st.glyph} color={st.color} size={18} />
        <span className="sr-only">{stateLabel}:</span>
        <span className="truncate font-medium">{name ?? indicator.indicator_id}</span>
        {provisional && !stale && (
          <span aria-hidden className="text-xs text-env-muted">
            ⇡
          </span>
        )}
      </span>
      <span className="shrink-0 text-lg font-semibold tabular-nums">
        {formatValue(indicator.last_value, indicator.unit)}
      </span>
    </span>
  )
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span>
          <span className="block font-medium">{name ?? indicator.indicator_id}</span>
          {systemName && <span className="block text-xs text-env-muted">{systemName}</span>}
        </span>
        <StatusBadge
          status={stale ? 'stale' : indicator.status}
          label={
            provisional && !stale
              ? `${statusStyle(indicator.status).label} · provisional`
              : undefined
          }
          size="xs"
        />
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
  const cls = `block w-full rounded-lg border border-env-border bg-env-surface text-left ${
    compact ? 'px-3 py-2' : 'p-3'
  }`

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${cls} hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary`}
    >
      {compact ? compactBody : body}
    </button>
  ) : (
    <div className={cls}>
      {compact ? compactBody : body}
      {showTrend && (
        <TrendChart
          indicatorId={indicator.indicator_id}
          name={name ?? indicator.indicator_id}
          unit={indicator.unit}
          range={indicator.range}
        />
      )}
    </div>
  )
}
