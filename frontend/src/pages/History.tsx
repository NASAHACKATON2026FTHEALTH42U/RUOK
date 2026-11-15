import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAssessment } from '../api/useAssessment'
import { useEnvironments } from '../api/useEnvironments'
import { useIndicators } from '../api/useIndicators'
import { useMeasurements } from '../api/useMeasurements'
import { CHECKIN_INDICATORS } from '../components/behavioral/checkin'
import { PVT_INDICATORS } from '../components/behavioral/pvt'
import { formatSource, formatValue } from '../components/dashboard/format'
import { TrendPlot } from '../components/dashboard/TrendChart'
import {
  formatDateTime,
  PERIODS,
  toPoints,
  type Period,
  type Ranges,
} from '../components/dashboard/trend'
import { classify, mergeRanges, type Ranges as FullRanges } from '../offline/provisional'
import { useEnvironmentStore } from '../store/environment'
import { useActiveMemberId } from '../auth/useAuth'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'

/** Cada cuánto se recarga la serie, para que aparezcan las mediciones nuevas. */
const REFRESH_MS = 15_000
/** Filas por página (docs/design/hud-style.md §5: en móvil, sin scroll vertical). */
const PAGE_SIZE = 8

/** Color y texto del estado de cada medición. Normal y "sin rangos" van en el color de texto. */
const VALUE_STATUS = {
  normal: { className: '', label: '' },
  unknown: { className: '', label: '' },
  warning: { className: 'text-st-warn', label: 'Atención' },
  critical: { className: 'text-st-crit', label: 'Crítico' },
} as const

/**
 * Historial (FE-09) con el estilo de consola de a bordo (`History.dc.html`): selector de
 * indicador, periodo 7/30 días y tabla de mediciones paginada (8 filas). El indicador y el
 * periodo van en la URL (`?indicator=bp_systolic&days=30`).
 * - **Móvil:** solo la tabla, para que la pantalla quepa sin scroll (como la maqueta).
 * - **Escritorio (≥ md):** además, la gráfica de tendencia; en ≥ lg, gráfica y tabla en dos columnas.
 */
export default function History() {
  // Un member, siempre los suyos; el resto de roles, el member elegido (FE-28).
  const memberId = useActiveMemberId()
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
  // Indicadores activos del entorno, en su orden, más los del check-in diario (FE-19) y los del
  // test PVT (FE-22), que se registran en todos los entornos; sin entorno, todo el catálogo.
  const options = [
    ...new Set([
      ...(env?.indicators ?? [...byId.keys()]),
      ...CHECKIN_INDICATORS,
      ...PVT_INDICATORS,
    ]),
  ].filter((id) => byId.has(id))

  const daysParam = Number(params.get('days'))
  const days: Period = (PERIODS as readonly number[]).includes(daysParam)
    ? (daysParam as Period)
    : 7
  const indicatorId = params.get('indicator') ?? options[0] ?? null
  const indicator = indicatorId ? byId.get(indicatorId) : undefined
  const series = useMeasurements(memberId, indicatorId, days, REFRESH_MS)

  // La página vuelve a la primera al cambiar de indicador o de periodo.
  const pageKey = `${indicatorId}:${days}`
  const [pageState, setPageState] = useState({ key: pageKey, page: 0 })
  const setPage = (page: number) => setPageState({ key: pageKey, page })

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

  // Para colorear cada fila: catálogo + ajustes del entorno, con los límites críticos incluidos
  // (las mismas reglas que el motor, offline/provisional.ts). Sin rangos, nada se colorea.
  const fullRange: FullRanges | null = useMemo(() => {
    if (!indicator || !indicatorId) return null
    return mergeRanges(
      indicator.ranges as FullRanges,
      env?.threshold_overrides?.[indicatorId] as FullRanges | undefined,
    )
  }, [indicator, indicatorId, env])

  const title = (
    <header>
      <h1 className="text-2xl font-semibold">Historial</h1>
    </header>
  )

  if (memberId === null) {
    return (
      <section className="mx-auto flex max-w-xl flex-col gap-3">
        {title}
        <NoMemberSelected className="" />
      </section>
    )
  }

  const unit = indicator?.unit ?? ''
  const name = indicator?.name ?? indicatorId ?? ''
  const rows = series.state === 'ready' ? [...series.data].reverse() : []
  const points = series.state === 'ready' ? toPoints(series.data) : []
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  // Si una recarga deja menos páginas, se queda en la última.
  const page = Math.min(pageState.key === pageKey ? pageState.page : 0, pages - 1)
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const errorMsg = series.state === 'error' && (
    <p className="px-3.5 py-3 text-sm">
      No se han podido cargar las mediciones.{' '}
      <button type="button" onClick={series.retry} className="underline">
        Reintentar
      </button>
    </p>
  )

  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-2.5 md:gap-4 lg:max-w-none">
      {title}

      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="history-indicator" className="text-sm text-env-muted">
            Indicador
          </label>
          <select
            id="history-indicator"
            value={indicatorId ?? ''}
            onChange={(e) => set('indicator', e.target.value)}
            disabled={options.length === 0}
            className="hud-input !pl-2.5 !font-sans !text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary"
          >
            {options.length === 0 && <option value="">Cargando…</option>}
            {options.map((id) => (
              <option key={id} value={id}>
                {byId.get(id)?.name ?? id}
                {byId.get(id)?.unit && byId.get(id)?.unit !== '1-5'
                  ? ` (${byId.get(id)?.unit})`
                  : ''}
              </option>
            ))}
          </select>
        </div>

        <div
          role="group"
          aria-label="Periodo"
          className="grid grid-cols-2 border border-env-border"
        >
          {PERIODS.map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => set('days', String(p))}
              aria-pressed={days === p}
              className={`h-11 text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary ${
                i > 0 ? 'border-l border-env-border' : ''
              } ${
                days === p
                  ? 'bg-env-primary/12 text-env-text shadow-[inset_0_-2px_0_var(--env-primary)]'
                  : 'text-env-muted hover:text-env-text'
              }`}
            >
              {p} días
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2.5 md:gap-4 lg:flex-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch">
        {/* Gráfica: solo en escritorio (en móvil la pantalla es la tabla, como la maqueta). */}
        <section
          aria-label={`Tendencia de ${name}`}
          className="hud-panel hidden md:flex md:flex-col"
        >
          <p className="border-b border-hud-line px-3.5 py-2.5 text-sm text-env-muted">
            {name} · últimos {days} días
            {unit && ` · ${unit === '1-5' ? 'escala 1-5' : unit}`}
          </p>
          <div className="flex min-h-64 flex-1 flex-col p-3.5 [&>*]:flex-1">
            {series.state === 'loading' && (
              <div className="h-64 animate-pulse bg-env-bg" aria-busy="true" />
            )}
            {series.state === 'ready' && points.length === 0 && (
              <p className="flex h-64 items-center justify-center text-sm text-env-muted">
                Sin mediciones en los últimos {days} días.
              </p>
            )}
            {series.state === 'ready' && points.length > 0 && (
              <TrendPlot points={points} unit={unit} range={range} days={days} height="100%" />
            )}
            {series.state === 'error' && (
              <p className="flex h-64 items-center justify-center text-sm text-env-muted">
                Sin datos que mostrar.
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-2.5">
          <section className="hud-panel">
            <table className="w-full table-fixed border-collapse">
              <caption className="sr-only">
                Mediciones de {name}, últimos {days} días
                {pages > 1 && `, página ${page + 1} de ${pages}`}
              </caption>
              <thead>
                <tr className="border-b border-hud-line text-left text-sm text-env-muted">
                  <th
                    scope="col"
                    className="w-[96px] py-2 sm:py-2.5 pr-2 pl-3.5 font-medium sm:w-[120px]"
                  >
                    Fecha
                  </th>
                  <th scope="col" className="px-2 py-2 sm:py-2.5 font-medium">
                    Valor
                  </th>
                  <th
                    scope="col"
                    className="w-[92px] py-2 sm:py-2.5 pr-3.5 pl-2 text-right font-medium sm:w-[110px]"
                  >
                    Origen
                  </th>
                  <th
                    scope="col"
                    className="hidden px-2 py-2 sm:py-2.5 pr-3.5 font-medium sm:table-cell lg:hidden xl:table-cell"
                  >
                    Nota
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m, i) => {
                  const st = VALUE_STATUS[fullRange ? classify(m.value, fullRange) : 'unknown']
                  const last = i === pageRows.length - 1
                  return (
                    <tr
                      key={m.id}
                      className={`h-10 text-sm sm:h-[42px] ${last ? '' : 'border-b border-hud-row'}`}
                    >
                      <td className="py-1.5 pr-2 pl-3.5 whitespace-nowrap tabular-nums">
                        {formatDateTime(Date.parse(m.taken_at))}
                      </td>
                      <td className={`px-2 py-1.5 tabular-nums ${st.className}`}>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          {st.label && (
                            <span className="size-[5px] shrink-0 bg-current" aria-hidden="true" />
                          )}
                          {m.unit === '1-5' ? (
                            formatValue(m.value, m.unit)
                          ) : (
                            <>
                              {formatValue(m.value, '')}
                              {m.unit && <span className="text-xs text-env-muted">{m.unit}</span>}
                            </>
                          )}
                          {st.label && <span className="sr-only">({st.label})</span>}
                        </span>
                      </td>
                      <td className="truncate py-1.5 pr-3.5 pl-2 text-right">
                        {formatSource(m.source)}
                      </td>
                      <td className="hidden truncate px-2 py-1.5 pr-3.5 text-sm text-env-muted sm:table-cell lg:hidden xl:table-cell">
                        {m.note ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {series.state === 'loading' && (
              <div className="space-y-2 px-3.5 py-3" aria-busy="true">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-6 animate-pulse bg-env-bg" />
                ))}
              </div>
            )}
            {errorMsg}
            {series.state === 'ready' && rows.length === 0 && (
              <p className="px-3.5 py-3 text-sm text-env-muted">
                Sin mediciones en los últimos {days} días.
              </p>
            )}
          </section>

          {series.refreshFailed && (
            <p className="text-sm text-env-muted" role="status">
              ⚠ No se pudo actualizar: puede haber mediciones nuevas que no se ven.
            </p>
          )}

          {rows.length > 0 && (
            // Sin página anterior o siguiente, la flecha desaparece (`invisible`: conserva su hueco
            // para que el contador siga centrado).
            <nav
              aria-label="Páginas del historial"
              className="flex items-center justify-between gap-3"
            >
              <button
                type="button"
                className={`hud-btn w-[52px] !px-0 !font-sans !text-base !tracking-normal ${page === 0 ? 'invisible' : ''}`}
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
                aria-label="Página anterior"
              >
                ←
              </button>
              <span className="text-center text-sm text-env-muted" aria-live="polite">
                Página {page + 1} / {pages} · {rows.length}{' '}
                {rows.length === 1 ? 'medición' : 'mediciones'}
              </span>
              <button
                type="button"
                className={`hud-btn w-[52px] !px-0 !font-sans !text-base !tracking-normal ${page >= pages - 1 ? 'invisible' : ''}`}
                onClick={() => setPage(page + 1)}
                disabled={page >= pages - 1}
                aria-label="Página siguiente"
              >
                →
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}
