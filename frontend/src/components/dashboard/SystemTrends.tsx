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
  formatDateTime,
  formatDay,
  yDomain,
  yTicks,
  type Period,
  type Ranges,
  type TrendPoint,
} from './trend'

const DAY_MS = 86_400_000
/** Colores de serie en orden fijo (styles/index.css). Como mucho 6 líneas por gráfica. */
const SERIES = [1, 2, 3, 4, 5, 6].map((n) => `var(--series-${n})`)

export interface TrendSeries {
  id: string
  name: string
  unit: string
  /** Rangos ya ajustados al entorno (`IndicatorAssessment.range`). */
  range: Ranges
}

const unitLabel = (unit: string) => (unit === '1-5' ? 'escala 1-5' : unit || 'sin unidad')

/** Indicadores agrupados por unidad, en orden de aparición: cada grupo comparte eje Y. */
function groupByUnit(series: TrendSeries[]): TrendSeries[][] {
  const groups = new Map<string, TrendSeries[]>()
  for (const s of series) groups.set(s.unit, [...(groups.get(s.unit) ?? []), s])
  // Más de 6 con la misma unidad: se parten, para no repetir colores en una gráfica.
  return [...groups.values()].flatMap((g) =>
    Array.from({ length: Math.ceil(g.length / SERIES.length) }, (_, i) =>
      g.slice(i * SERIES.length, (i + 1) * SERIES.length),
    ),
  )
}

/**
 * Tendencias de un sistema en UN solo contenedor (detalle del sistema): una línea de color por
 * indicador, con leyenda. Los indicadores con la misma unidad comparten gráfica y eje; los de
 * unidad distinta van en su propia gráfica dentro del mismo bloque, porque mezclar unidades en
 * un eje (o usar dos ejes) falsearía la lectura. Selector de periodo común, tooltip con todas
 * las series y tabla de datos desplegable (los colores nunca son la única pista).
 */
export function SystemTrends({ series }: { series: TrendSeries[] }) {
  const memberId = useEnvironmentStore((s) => s.memberId)
  const [days, setDays] = useState<Period>(7)
  const data = useMeasurementsMany(
    memberId,
    series.map((s) => s.id),
    days,
  )
  const groups = groupByUnit(series)

  return (
    <figure className="rounded-lg border border-env-border bg-env-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <figcaption className="text-sm font-semibold">
          Tendencias <span className="font-normal text-env-muted">· últimos {days} días</span>
        </figcaption>
        <PeriodSwitch days={days} onChange={setDays} />
      </div>

      {data.state === 'loading' && (
        <div className="mt-2 h-40 animate-pulse rounded-md bg-env-bg" aria-busy="true" />
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
        <div className={`mt-2 grid gap-x-4 gap-y-3 ${groups.length > 1 ? 'md:grid-cols-2' : ''}`}>
          {groups.map((g) => (
            <GroupPlot
              key={g.map((s) => s.id).join(',')}
              group={g}
              data={data.data}
              days={days}
              tall={groups.length === 1}
            />
          ))}
        </div>
      )}
    </figure>
  )
}

function GroupPlot({
  group,
  data,
  days,
  tall,
}: {
  group: TrendSeries[]
  data: Record<string, { taken_at: string; value: number }[]>
  days: Period
  tall: boolean
}) {
  const now = serverNow().getTime()
  const unit = group[0].unit
  const single = group.length === 1
  // Filas por instante: { t, [indicador]: valor }, para un tooltip con todas las series.
  const byT = new Map<number, Record<string, number>>()
  const all: TrendPoint[] = []
  for (const s of group) {
    for (const m of data[s.id] ?? []) {
      const t = Date.parse(m.taken_at)
      byT.set(t, { ...(byT.get(t) ?? { t }), [s.id]: m.value })
      all.push({ t, value: m.value })
    }
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t)
  // Bandas normal/atención solo con una serie: con varias, cada una tiene sus rangos.
  const range = single ? group[0].range : {}
  const domain = yDomain(all, range)
  const last = (id: string) => (data[id] ?? []).at(-1)?.value

  return (
    <div className="min-w-0">
      <p className="text-xs text-env-muted">
        {single ? `${group[0].name} · ${unitLabel(unit)}` : unitLabel(unit)}
      </p>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-env-muted">Sin mediciones en los últimos {days} días.</p>
      ) : (
        <>
          <div style={{ height: tall ? 220 : 150 }} aria-hidden="true" className="mt-1">
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
                  tick={{ fill: 'var(--env-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--env-muted)', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    const row = active && (payload?.[0]?.payload as Record<string, number>)
                    if (!row) return null
                    return (
                      <div className="rounded-md border border-env-border bg-env-bg px-2 py-1 text-xs shadow">
                        <div className="text-env-muted">{formatDateTime(row.t)}</div>
                        {group.map(
                          (s, i) =>
                            row[s.id] !== undefined && (
                              <div key={s.id} className="flex items-center gap-1.5">
                                <span
                                  className="inline-block h-0.5 w-3 shrink-0"
                                  style={{ background: SERIES[i] }}
                                />
                                <span className="font-semibold text-env-text">
                                  {formatValue(row[s.id], unit)}
                                </span>
                                <span className="text-env-muted">{s.name}</span>
                              </div>
                            ),
                        )}
                      </div>
                    )
                  }}
                />
                {group.map((s, i) => (
                  <Line
                    key={s.id}
                    type="monotone"
                    dataKey={s.id}
                    stroke={SERIES[i]}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    connectNulls
                    dot={rows.length > 14 ? false : { r: 2.5, fill: SERIES[i], strokeWidth: 0 }}
                    activeDot={{ r: 4.5, fill: SERIES[i], stroke: 'var(--env-bg)', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Leyenda (solo con varias series): trazo del color + nombre y último valor en texto. */}
          {!single && (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              {group.map((s, i) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-0.5 w-3 shrink-0"
                    style={{ background: SERIES[i] }}
                  />
                  <span>{s.name}</span>
                  <span className="text-env-muted tabular-nums">
                    {formatValue(last(s.id), unit)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <details className="mt-1 text-xs">
            <summary className="cursor-pointer text-env-muted hover:text-env-text">
              Ver datos ({rows.length})
            </summary>
            <div className="overflow-x-auto">
              <table className="mt-1 w-full">
                <caption className="sr-only">
                  {group.map((s) => s.name).join(', ')}: últimos {days} días
                </caption>
                <thead>
                  <tr className="text-left text-env-muted">
                    <th className="font-normal">Fecha</th>
                    {group.map((s) => (
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
                      {group.map((s) => (
                        <td key={s.id} className="pl-2 text-right tabular-nums">
                          {r[s.id] === undefined ? '—' : formatValue(r[s.id], unit)}
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
