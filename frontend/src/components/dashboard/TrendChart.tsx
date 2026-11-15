import { useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { serverNow } from '../../api/client'
import { useMeasurements } from '../../api/useMeasurements'
import { useT } from '../../i18n/t'
import { useEnvironmentStore } from '../../store/environment'
import { STATUS_COLORS } from '../ui/status'
import { formatValue } from './format'
import {
  bands,
  formatDateTime,
  formatDay,
  toPoints,
  withForecast,
  yDomain,
  yTicks,
  PERIODS,
  type ChartPoint,
  type Forecast,
  type Period,
  type Ranges,
  type TrendPoint,
} from './trend'

const DAY_MS = 86_400_000

/**
 * Trazo de la previsión (FS-09): el gris neutro del tema, discontinuo y más fino que la línea
 * medida, y su intervalo como un lavado del mismo gris. Nunca un color del semáforo: una
 * estimación no se pinta como un dato ni como un estado.
 */
const FORECAST_COLOR = 'var(--env-muted)'
const FORECAST_WIDTH = 1.5
const FORECAST_DASH = '5 4'
const FORECAST_BAND_OPACITY = 0.2

/** Selector de periodo 7 d / 30 d. */
export function PeriodSwitch({
  days,
  onChange,
  size = 'sm',
}: {
  days: Period
  onChange: (d: Period) => void
  size?: 'sm' | 'md'
}) {
  const t = useT()
  return (
    <div
      role="group"
      aria-label={t('Periodo')}
      className={`flex  border border-env-border ${size === 'sm' ? 'text-xs' : 'text-sm'}`}
    >
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-pressed={days === p}
          className={`${size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1'} ${
            days === p
              ? 'bg-env-primary text-env-primary-text'
              : 'text-env-muted hover:text-env-text'
          }`}
        >
          {p} d
        </button>
      ))}
    </div>
  )
}

interface TrendPlotProps {
  points: TrendPoint[]
  unit: string
  /** Rangos ya ajustados al entorno (`IndicatorAssessment.range`). */
  range: Ranges
  days: Period
  /** Alto en píxeles. */
  height?: number | string
  /**
   * Previsión del indicador (FS-09). Solo se dibuja si es `ok` y trae puntos; con cualquier otro
   * estado la gráfica es la de siempre (sin datos = desconocido).
   */
  forecast?: Forecast | null
}

/**
 * Solo la gráfica: serie temporal con las bandas normal y atención sombreadas.
 * Una sola serie (sin leyenda), línea de 2 px en el color de texto, último punto marcado,
 * bandas como lavado suave del semáforo. Es `aria-hidden`: acompáñala de una tabla.
 *
 * Con `forecast`, el eje X sigue hasta el último punto previsto: los valores esperados van en
 * línea discontinua desde el último dato, su rango probable (el intervalo de predicción, de
 * ≈ 80 %) como banda gris y una línea vertical marca «ahora». Acompáñala de `ForecastLegend`.
 */
export function TrendPlot({ points, unit, range, days, height = 144, forecast }: TrendPlotProps) {
  const t = useT()
  const now = serverNow().getTime()
  const rows = withForecast(points, forecast)
  const predicted = rows.length > points.length
  const domain = yDomain(rows, range)
  const ticks = yTicks(domain)
  // Sitio para la marca más larga del eje: con cuatro cifras («3000» ml) la primera se cortaba.
  const axisWidth = 48 + 7 * Math.max(0, ...ticks.map((v) => String(v).length - 3))
  const end = predicted ? Math.max(now, rows[rows.length - 1].t) : now

  return (
    <div style={{ height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        {/* Sin capa de accesibilidad de Recharts: la gráfica es aria-hidden (la tabla da los
            datos) y un SVG enfocable dentro de aria-hidden confunde al lector de pantalla. */}
        <ComposedChart
          data={rows}
          // Con previsión, hueco arriba para la etiqueta «ahora».
          margin={{ top: predicted ? 18 : 6, right: 8, bottom: 0, left: -18 }}
          accessibilityLayer={false}
        >
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
            domain={[now - days * DAY_MS, end]}
            tickFormatter={formatDay}
            tick={{ fill: 'var(--env-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--env-border)' }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            tick={{ fill: 'var(--env-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={axisWidth}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: 'var(--env-muted)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active && (payload?.[0]?.payload as ChartPoint | undefined)
              if (!p) return null
              // Un punto previsto no lleva `value`: el tooltip dice que es una estimación.
              const estimated = p.value === undefined
              return (
                <div className=" border border-env-border bg-env-bg px-2 py-1 text-xs shadow">
                  <div className="text-env-muted">
                    {formatDateTime(p.t)}
                    {estimated && ` · ${t('previsión')}`}
                  </div>
                  <div className="font-semibold text-env-text">
                    {formatValue(estimated ? p.forecast : p.value, unit)}
                  </div>
                  {estimated && p.band && (
                    <div className="text-env-muted">
                      {t('Rango probable: {low} – {high}', {
                        low: formatValue(p.band[0], ''),
                        high: formatValue(p.band[1], ''),
                      })}
                    </div>
                  )}
                </div>
              )
            }}
          />
          {predicted && (
            <ReferenceLine
              x={now}
              stroke="var(--env-muted)"
              strokeOpacity={0.7}
              label={{ value: t('ahora'), position: 'top', fill: 'var(--env-muted)', fontSize: 11 }}
            />
          )}
          {predicted && (
            <Area
              type="monotone"
              dataKey="band"
              stroke="none"
              fill={FORECAST_COLOR}
              fillOpacity={FORECAST_BAND_OPACITY}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          {predicted && (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke={FORECAST_COLOR}
              strokeWidth={FORECAST_WIDTH}
              strokeDasharray={FORECAST_DASH}
              dot={false}
              // Punto activo hueco, distinto del de un dato; en el último dato manda el medido.
              activeDot={(props: { cx?: number; cy?: number; payload?: ChartPoint }) =>
                props.payload?.value === undefined ? (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={4.5}
                    fill="var(--env-bg)"
                    stroke={FORECAST_COLOR}
                    strokeWidth={FORECAST_WIDTH}
                  />
                ) : (
                  <g />
                )
              }
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--env-text)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const isLast = props.index === points.length - 1
              // Último punto siempre marcado (≥ 8 px con anillo); el resto solo si hay pocos. Los
              // puntos previstos no son datos: no llevan marca.
              if (props.cy === undefined || (!isLast && points.length > 14)) {
                return <g key={props.index} />
              }
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
            activeDot={{ r: 5, fill: 'var(--env-text)', stroke: 'var(--env-bg)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Leyenda de la gráfica con previsión: qué es dato, qué es estimación y qué cubre la banda (la
 * identidad no depende solo del trazo). Como la gráfica, es `aria-hidden`.
 */
export function ForecastLegend() {
  const t = useT()
  const key = 'h-2 w-4 shrink-0'
  return (
    <ul
      aria-hidden="true"
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-env-muted"
    >
      <li className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 16 8" className={key}>
          <line x1="1" y1="4" x2="15" y2="4" stroke="var(--env-text)" strokeWidth="2" />
        </svg>
        {t('Medido')}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 16 8" className={key}>
          <line
            x1="0"
            y1="4"
            x2="16"
            y2="4"
            stroke={FORECAST_COLOR}
            strokeWidth={FORECAST_WIDTH}
            strokeDasharray={FORECAST_DASH}
          />
        </svg>
        {t('Previsión')}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <svg viewBox="0 0 16 8" className={key}>
          <rect width="16" height="8" fill={FORECAST_COLOR} fillOpacity={FORECAST_BAND_OPACITY} />
        </svg>
        {t('Rango probable (≈ 80 %)')}
      </li>
    </ul>
  )
}

interface TrendChartProps {
  indicatorId: string
  name: string
  unit: string
  /** Rangos ya ajustados al entorno (`IndicatorAssessment.range`). */
  range: Ranges
}

/**
 * Serie temporal compacta de un indicador (7 o 30 días) para las tarjetas: carga sus datos,
 * selector de periodo, TrendPlot y tabla de datos desplegable.
 */
export function TrendChart({ indicatorId, name, unit, range }: TrendChartProps) {
  const t = useT()
  const memberId = useEnvironmentStore((s) => s.memberId)
  const [days, setDays] = useState<Period>(7)
  const series = useMeasurements(memberId, indicatorId, days)
  const points = series.state === 'ready' ? toPoints(series.data) : []

  return (
    <figure className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <figcaption className="text-xs text-env-muted">
          {t('Últimos {n} días', { n: days })} · {unit === '1-5' ? t('escala 1-5') : unit}
        </figcaption>
        <PeriodSwitch days={days} onChange={setDays} />
      </div>

      {series.state === 'loading' && (
        <div className="mt-2 h-36 animate-pulse  bg-env-bg" aria-busy="true" />
      )}
      {series.state === 'error' && (
        <p className="mt-2 text-sm text-env-muted">
          {t('No se ha podido cargar la serie.')}{' '}
          <button type="button" onClick={series.retry} className="underline">
            {t('Reintentar')}
          </button>
        </p>
      )}
      {series.state === 'ready' && points.length === 0 && (
        <p className="mt-2 text-sm text-env-muted">
          {t('Sin mediciones en los últimos {n} días.', { n: days })}
        </p>
      )}

      {series.state === 'ready' && points.length > 0 && (
        <>
          <div className="mt-2">
            <TrendPlot points={points} unit={unit} range={range} days={days} />
          </div>
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-env-muted hover:text-env-text">
              {t('Ver datos ({n})', { n: points.length })}
            </summary>
            <table className="mt-1 w-full">
              <caption className="sr-only">
                {t('{name}, últimos {n} días', { name, n: days })}
              </caption>
              <thead>
                <tr className="text-left text-env-muted">
                  <th className="font-normal">{t('Fecha')}</th>
                  <th className="text-right font-normal">{t('Valor')}</th>
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
