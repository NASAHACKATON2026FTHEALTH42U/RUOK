import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { serverNow } from '../../api/client'
import { useMeasurements } from '../../api/useMeasurements'
import { useEnvironmentStore } from '../../store/environment'
import { STATUS_COLORS } from '../ui/status'
import { formatValue } from './format'
import { bands, formatDateTime, formatDay, toPoints, yDomain, type Ranges } from './trend'

const DAY_MS = 86_400_000
const PERIODS = [7, 30] as const

interface TrendChartProps {
  indicatorId: string
  name: string
  unit: string
  /** Rangos ya ajustados al entorno (`IndicatorAssessment.range`). */
  range: Ranges
}

/**
 * Serie temporal de un indicador (7 o 30 días) con las bandas normal y atención sombreadas.
 * Una sola serie: sin leyenda (el título dice qué es), línea de 2 px en el color de texto,
 * bandas como lavado suave de los colores del semáforo y tabla de datos desplegable.
 */
export function TrendChart({ indicatorId, name, unit, range }: TrendChartProps) {
  const memberId = useEnvironmentStore((s) => s.memberId)
  const [days, setDays] = useState<(typeof PERIODS)[number]>(7)
  const series = useMeasurements(memberId, indicatorId, days)
  const now = serverNow().getTime()
  const points = series.state === 'ready' ? toPoints(series.data) : []
  const domain = yDomain(points, range)

  return (
    <figure className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <figcaption className="text-xs text-env-muted">
          Últimos {days} días · {unit === '1-5' ? 'escala 1-5' : unit}
        </figcaption>
        <div
          role="group"
          aria-label="Periodo"
          className="flex rounded-md border border-env-border text-xs"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              aria-pressed={days === p}
              className={`px-2 py-0.5 first:rounded-l-md last:rounded-r-md ${
                days === p
                  ? 'bg-env-primary text-env-primary-text'
                  : 'text-env-muted hover:text-env-text'
              }`}
            >
              {p} d
            </button>
          ))}
        </div>
      </div>

      {series.state === 'loading' && (
        <div className="mt-2 h-36 animate-pulse rounded-md bg-env-bg" aria-busy="true" />
      )}
      {series.state === 'error' && (
        <p className="mt-2 text-sm text-env-muted">
          No se ha podido cargar la serie.{' '}
          <button type="button" onClick={series.retry} className="underline">
            Reintentar
          </button>
        </p>
      )}
      {series.state === 'ready' && points.length === 0 && (
        <p className="mt-2 text-sm text-env-muted">Sin mediciones en los últimos {days} días.</p>
      )}

      {series.state === 'ready' && points.length > 0 && (
        <>
          <div className="mt-2 h-36" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                {bands(range).map((b) => (
                  <ReferenceArea
                    key={b.kind}
                    y1={b.y1}
                    y2={b.y2}
                    fill={b.kind === 'normal' ? STATUS_COLORS.normal : STATUS_COLORS.warning}
                    fillOpacity={0.12}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                ))}
                <CartesianGrid vertical={false} stroke="var(--env-border)" strokeOpacity={0.6} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={[now - days * DAY_MS, now]}
                  tickFormatter={formatDay}
                  tick={{ fill: 'var(--env-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--env-border)' }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={domain}
                  tick={{ fill: 'var(--env-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--env-muted)', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload
                    if (!p) return null
                    return (
                      <div className="rounded-md border border-env-border bg-env-bg px-2 py-1 text-xs shadow">
                        <div className="text-env-muted">{formatDateTime(p.t)}</div>
                        <div className="font-semibold text-env-text">
                          {formatValue(p.value, unit)}
                        </div>
                      </div>
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--env-text)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    const isLast = props.index === points.length - 1
                    // Último punto siempre marcado (≥ 8 px con anillo); el resto solo si hay pocos.
                    if (!isLast && points.length > 14) return <g key={props.index} />
                    return (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={isLast ? 4.5 : 3}
                        fill="var(--env-text)"
                        stroke={isLast ? 'var(--env-bg)' : 'none'}
                        strokeWidth={isLast ? 2 : 0}
                      />
                    )
                  }}
                  activeDot={{
                    r: 5,
                    fill: 'var(--env-text)',
                    stroke: 'var(--env-bg)',
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-env-muted hover:text-env-text">
              Ver datos ({points.length})
            </summary>
            <table className="mt-1 w-full">
              <caption className="sr-only">
                {name}, últimos {days} días
              </caption>
              <thead>
                <tr className="text-left text-env-muted">
                  <th className="font-normal">Fecha</th>
                  <th className="text-right font-normal">Valor</th>
                </tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.t}>
                    <td>{formatDateTime(p.t)}</td>
                    <td className="text-right tabular-nums">{formatValue(p.value, unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </figure>
  )
}
