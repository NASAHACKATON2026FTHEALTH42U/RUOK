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
import { useMeasurementsMany } from '../../api/useMeasurements'
import { useEnvironmentStore } from '../../store/environment'
import { STATUS_COLORS } from '../ui/status'
import { formatValue } from './format'
import { PeriodSwitch } from './TrendChart'
import {
  bands,
  commonUnit,
  formatDateTime,
  formatDay,
  initialSlots,
  normalPct,
  toggleSlot,
  yDomain,
  yTicks,
  type Period,
  type Ranges,
  type Slots,
  type TrendPoint,
} from './trend'

const DAY_MS = 86_400_000
/** Colores de serie en orden fijo (styles/index.css): como mucho 6 indicadores a la vez. */
const SERIES = [1, 2, 3, 4, 5, 6].map((n) => `var(--series-${n})`)
const MAX = SERIES.length
/** Al abrir un sistema se ven sus 4 primeros indicadores (vienen ordenados por gravedad). */
const DEFAULT_COUNT = 4
const PLOT_H = 240
/** Sufijo de la columna con el valor real (con escala común, lo dibujado es el % del rango). */
const RAW = '__raw'

export interface TrendSeries {
  id: string
  name: string
  unit: string
  /** Rangos ya ajustados al entorno (`IndicatorAssessment.range`). */
  range: Ranges
}

const unitLabel = (unit: string) => (unit === '1-5' ? 'escala 1-5' : unit || 'sin unidad')

/**
 * Tendencias de un sistema en UNA sola gráfica (detalle de un sistema o de un indicador). Los
 * selectores (botones con `aria-pressed`, que hacen de leyenda: color, nombre y último valor)
 * eligen qué indicadores se ven a la vez, hasta 6; cada uno conserva su color al cambiar la
 * selección. Con `initial`, empieza con esos (p. ej. el indicador pulsado en el panel).
 * - Misma unidad: valores reales en un eje con esa unidad (con uno solo, también sus bandas).
 * - Unidades distintas: escala común, el % del rango normal de cada indicador (0–100 % = normal).
 *   Mezclar unidades en un eje, o usar dos ejes, falsearía la lectura. El valor real va en el
 *   tooltip y en la tabla.
 * Periodo común, tooltip con todas las series y tabla de datos desplegable (el color nunca va
 * solo).
 */
export function SystemTrends({ series, initial }: { series: TrendSeries[]; initial?: string[] }) {
  const memberId = useEnvironmentStore((s) => s.memberId)
  const [days, setDays] = useState<Period>(7)
  const ids = series.map((s) => s.id)
  const [slots, setSlots] = useState<Slots>(() =>
    initialSlots(ids, initial, initial?.length ? MAX : DEFAULT_COUNT),
  )
  // Se cargan todas las series del sistema: cambiar la selección no vuelve a pedir datos.
  const data = useMeasurementsMany(memberId, ids, days)
  const selected = series.filter((s) => s.id in slots)
  const last = (id: string) =>
    data.state === 'ready' ? (data.data[id] ?? []).at(-1)?.value : undefined

  return (
    <figure className=" border border-env-border bg-env-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <figcaption className="text-sm font-semibold">
          Tendencias <span className="font-normal text-env-muted">· últimos {days} días</span>
        </figcaption>
        <PeriodSwitch days={days} onChange={setDays} />
      </div>

      {series.length > 1 && (
        <div
          role="group"
          aria-label="Indicadores en la gráfica"
          className="mt-2 flex flex-wrap gap-1.5"
        >
          {series.map((s) => {
            const on = s.id in slots
            const count = Object.keys(slots).length
            // No se puede quitar el último ni añadir un séptimo: se avisa, pero el botón sigue
            // siendo enfocable (aria-disabled, no disabled).
            const locked = on ? count === 1 : count >= MAX
            const value = last(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                aria-disabled={locked || undefined}
                title={
                  locked
                    ? on
                      ? 'Tiene que quedar al menos un indicador'
                      : `Como mucho ${MAX} a la vez`
                    : undefined
                }
                onClick={() => !locked && setSlots((cur) => toggleSlot(cur, s.id, MAX))}
                className={`inline-flex min-h-11 items-center gap-2  border px-2.5 text-xs pointer-fine:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                  on
                    ? 'border-env-text/60 bg-env-bg text-env-text'
                    : 'border-env-border text-env-muted hover:text-env-text'
                } ${locked && !on ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <span
                  aria-hidden
                  className="inline-block h-[3px] w-3.5 shrink-0 rounded-full"
                  style={{ background: on ? SERIES[slots[s.id]] : 'var(--env-border)' }}
                />
                <span>{s.name}</span>
                {value !== undefined && (
                  <span className="text-env-muted tabular-nums">{formatValue(value, s.unit)}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Esqueleto con la MISMA forma que el contenido (título, gráfica y «Ver datos»): al llegar
          los datos la ventana no cambia de tamaño. */}
      {data.state === 'loading' && (
        <div className="mt-2" aria-busy="true">
          <div className="h-4" />
          <div className="mt-1 animate-pulse  bg-env-bg" style={{ height: PLOT_H }} />
          <div className="mt-1 h-4" />
        </div>
      )}
      {data.state === 'error' && (
        <p className="mt-2 text-sm text-env-muted">
          No se han podido cargar las series.{' '}
          <button type="button" onClick={data.retry} className="underline">
            Reintentar
          </button>
        </p>
      )}
      {data.state === 'ready' && (
        <Plot selected={selected} slots={slots} data={data.data} days={days} />
      )}
    </figure>
  )
}

function Plot({
  selected,
  slots,
  data,
  days,
}: {
  selected: TrendSeries[]
  slots: Slots
  data: Record<string, { taken_at: string; value: number }[]>
  days: Period
}) {
  const now = serverNow().getTime()
  const unit = commonUnit(selected.map((s) => s.unit))
  const normalized = unit === null
  const single = selected.length === 1
  // Filas por instante: { t, [indicador]: valor dibujado, [indicador + RAW]: valor real }, para
  // un tooltip con todas las series.
  const byT = new Map<number, Record<string, number>>()
  const points: TrendPoint[] = []
  for (const s of selected) {
    for (const m of data[s.id] ?? []) {
      const y = normalized ? normalPct(m.value, s.range) : m.value
      if (y === null) continue
      const t = Date.parse(m.taken_at)
      byT.set(t, { ...(byT.get(t) ?? { t }), [s.id]: y, [s.id + RAW]: m.value })
      points.push({ t, value: y })
    }
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t)
  // Bandas: con escala común, la franja normal (0–100 %); con valores reales, las del indicador
  // si solo hay uno (con varios, cada uno tiene las suyas).
  const range: Ranges = normalized ? { normal: [0, 100] } : single ? selected[0].range : {}
  const domain = yDomain(points, range)
  const caption = normalized
    ? 'Escala común: % del rango normal de cada indicador (0–100 % = normal)'
    : single
      ? `${selected[0].name} · ${unitLabel(unit)}`
      : unitLabel(unit)

  return (
    <div className="mt-2 min-w-0">
      <p className="text-xs text-env-muted">{caption}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-env-muted">Sin mediciones en los últimos {days} días.</p>
      ) : (
        <>
          <div style={{ height: PLOT_H }} aria-hidden="true" className="mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 6, right: 8, bottom: 0, left: -18 }}
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
                  domain={[now - days * DAY_MS, now]}
                  tickFormatter={formatDay}
                  tick={{ fill: 'var(--env-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--env-border)' }}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  domain={domain}
                  ticks={yTicks(domain)}
                  tickFormatter={normalized ? (v: number) => `${v} %` : undefined}
                  tick={{ fill: 'var(--env-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={normalized ? 60 : 48}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--env-muted)', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const row = active && (payload?.[0]?.payload as Record<string, number>)
                    if (!row) return null
                    return (
                      <div className=" border border-env-border bg-env-bg px-2 py-1 text-xs shadow">
                        <div className="text-env-muted">{formatDateTime(row.t)}</div>
                        {selected.map(
                          (s) =>
                            row[s.id] !== undefined && (
                              <div key={s.id} className="flex items-center gap-1.5">
                                <span
                                  className="inline-block h-0.5 w-3 shrink-0"
                                  style={{ background: SERIES[slots[s.id]] }}
                                />
                                <span className="font-semibold text-env-text">
                                  {formatValue(row[s.id + RAW], s.unit)}
                                </span>
                                <span className="text-env-muted">
                                  {s.name}
                                  {normalized && ` · ${Math.round(row[s.id])} % del rango`}
                                </span>
                              </div>
                            ),
                        )}
                      </div>
                    )
                  }}
                />
                {selected.map((s) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.id}
                    stroke={SERIES[slots[s.id]]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    connectNulls
                    dot={
                      rows.length > 14
                        ? false
                        : { r: 2.5, fill: SERIES[slots[s.id]], strokeWidth: 0 }
                    }
                    activeDot={{
                      r: 4.5,
                      fill: SERIES[slots[s.id]],
                      stroke: 'var(--env-bg)',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-env-muted hover:text-env-text">
              Ver datos ({rows.length})
            </summary>
            <div className="overflow-x-auto">
              <table className="mt-1 w-full">
                <caption className="sr-only">
                  {selected.map((s) => s.name).join(', ')}: últimos {days} días
                </caption>
                <thead>
                  <tr className="text-left text-env-muted">
                    <th className="font-normal">Fecha</th>
                    {selected.map((s) => (
                      <th key={s.id} className="pl-2 text-right font-normal">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.t}>
                      <td className="whitespace-nowrap">{formatDateTime(r.t)}</td>
                      {selected.map((s) => (
                        <td key={s.id} className="pl-2 text-right tabular-nums">
                          {r[s.id + RAW] === undefined ? '—' : formatValue(r[s.id + RAW], s.unit)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  )
}
