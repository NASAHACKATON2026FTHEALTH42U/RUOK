import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAssessment } from '../api/useAssessment'
import { useEnvironments } from '../api/useEnvironments'
import { useIndicators } from '../api/useIndicators'
import { useMeasurements } from '../api/useMeasurements'
import { CHECKIN_INDICATORS } from '../components/behavioral/checkin'
import { formatSource, formatValue } from '../components/dashboard/format'
import { PeriodSwitch, TrendPlot } from '../components/dashboard/TrendChart'
import {
  formatDateTime,
  PERIODS,
  toPoints,
  type Period,
  type Ranges,
} from '../components/dashboard/trend'
import { useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'

/** Cada cuánto se recarga la serie, para que aparezcan las mediciones nuevas. */
const REFRESH_MS = 15_000

/**
 * Historial (FE-09): selector de indicador y de periodo (7/30 días), TrendChart y tabla de
 * mediciones. El indicador y el periodo van en la URL (`?indicator=bp_systolic&days=30`).
 */
export default function History() {
  const vocab = useVocab()
  const memberId = useEnvironmentStore((s) => s.memberId)
  const envId = useEnvironmentStore((s) => s.envId)
  const [params, setParams] = useSearchParams()
  const envs = useEnvironments()
  const catalog = useIndicators()
  const assessment = useAssessment(memberId)

  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined
  const byId = useMemo(
    () => new Map((catalog.state === 'ready' ? catalog.data : []).map((i) => [i.id, i])),
    [catalog],
  )
  // Indicadores activos del entorno, en su orden, más los del check-in diario (FE-19), que se
  // registran en todos los entornos; sin entorno, todo el catálogo.
  const options = [
    ...new Set([...(env?.indicators ?? [...byId.keys()]), ...CHECKIN_INDICATORS]),
  ].filter((id) => byId.has(id))

  const daysParam = Number(params.get('days'))
  const days: Period = (PERIODS as readonly number[]).includes(daysParam)
    ? (daysParam as Period)
    : 7
  const indicatorId = params.get('indicator') ?? options[0] ?? null
  const indicator = indicatorId ? byId.get(indicatorId) : undefined
  const series = useMeasurements(memberId, indicatorId, days, REFRESH_MS)

  const set = (key: string, value: string) =>
    setParams(
      (p) => {
        p.set(key, value)
        return p
      },
      { replace: true },
    )

  // Rangos del entorno (de la evaluación); si el indicador no está evaluado, los del catálogo.
  const range: Ranges = useMemo(() => {
    const assessed =
      assessment.state === 'ready'
        ? assessment.data.systems
            .flatMap((s) => s.indicators)
            .find((i) => i.indicator_id === indicatorId)
        : undefined
    if (assessed) return assessed.range
    const r = indicator?.ranges
    const out: Ranges = {}
    if (r?.normal) out.normal = r.normal
    if (r?.warning) out.warning = r.warning
    return out
  }, [assessment, indicatorId, indicator])

  const title = <h1 className="text-2xl font-semibold">Historial</h1>

  if (memberId === null) {
    return (
      <section>
        {title}
        <p className="mt-2 text-env-muted">
          No hay nadie seleccionado.{' '}
          <Link to="/" className="underline hover:text-env-text">
            Elige entorno y {vocab.member}
          </Link>
          .
        </p>
      </section>
    )
  }

  const unit = indicator?.unit ?? ''
  const rows = series.state === 'ready' ? [...series.data].reverse() : []
  const points = series.state === 'ready' ? toPoints(series.data) : []

  return (
    <section className="space-y-5">
      <header>
        {title}
        <p className="mt-1 text-env-muted">Evolución de tus mediciones.</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-env-muted">Indicador</span>
          <select
            value={indicatorId ?? ''}
            onChange={(e) => set('indicator', e.target.value)}
            disabled={options.length === 0}
            className="min-w-56 rounded-md border border-env-border bg-env-surface px-2 py-1.5 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
          >
            {options.length === 0 && <option value="">Cargando…</option>}
            {options.map((id) => (
              <option key={id} value={id}>
                {byId.get(id)?.name ?? id}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-env-muted">Periodo</span>
          <PeriodSwitch days={days} onChange={(d) => set('days', String(d))} size="md" />
        </div>
      </div>

      <div className="rounded-xl border border-env-border bg-env-surface p-4">
        <p className="text-sm text-env-muted">
          {indicator?.name ?? indicatorId} · últimos {days} días
          {unit && ` · ${unit === '1-5' ? 'escala 1-5' : unit}`}
        </p>
        {series.state === 'loading' && (
          <div className="mt-3 h-64 animate-pulse rounded-md bg-env-bg" aria-busy="true" />
        )}
        {series.state === 'error' && (
          <p className="mt-3 text-sm">
            No se han podido cargar las mediciones.{' '}
            <button type="button" onClick={series.retry} className="underline">
              Reintentar
            </button>
          </p>
        )}
        {series.state === 'ready' && points.length === 0 && (
          <p className="mt-3 text-env-muted">Sin mediciones en los últimos {days} días.</p>
        )}
        {series.state === 'ready' && points.length > 0 && (
          <div className="mt-3">
            <TrendPlot points={points} unit={unit} range={range} days={days} height={256} />
          </div>
        )}
        {series.refreshFailed && (
          <p className="mt-2 text-sm text-env-muted" role="status">
            ⚠ No se pudo actualizar: puede haber mediciones nuevas que no se ven.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-env-border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Mediciones de {indicator?.name ?? indicatorId}, últimos {days} días
            </caption>
            <thead className="bg-env-surface text-left text-env-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Origen</th>
                <th className="px-3 py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-env-border">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {formatDateTime(Date.parse(m.taken_at))}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                    {formatValue(m.value, m.unit)}
                  </td>
                  <td className="px-3 py-2">{formatSource(m.source)}</td>
                  <td className="px-3 py-2 text-env-muted">{m.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
