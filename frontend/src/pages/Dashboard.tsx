import { AnimatePresence } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { serverNow } from '../api/client'
import { useAssessment } from '../api/useAssessment'
import { useEnvironments } from '../api/useEnvironments'
import { useIndicators } from '../api/useIndicators'
import { useSystems } from '../api/useSystems'
import { BodyFigure } from '../components/body/BodyFigure'
import { MissionPhaseBar } from '../components/behavioral/MissionPhaseBar'
import { buildRegions, formatSinceLabel, isFigureStale } from '../components/body/regions'
import { IndicatorCard } from '../components/dashboard/IndicatorCard'
import { SystemPanel } from '../components/dashboard/SystemPanel'
import { BodyLegend } from '../components/body/BodyLegend'
import { SidebarPortal } from '../components/ui/SidebarPortal'
import { bySeverity, livenessState, statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { capitalize, useVocab } from '../environments/useVocab'
import { formatAgo } from '../lib/time'
import { useEnvironmentStore } from '../store/environment'
import { useActiveMemberId, useAuth } from '../auth/useAuth'
import { useProvisionalAssessment } from '../offline/useProvisional'

/** Cada cuánto se refresca la evaluación (FE-07). */
const REFRESH_MS = 15_000
const NO_INDICATORS: never[] = []

/**
 * Panel del member (FE-07): cabecera con estado general, liveness y frescura de los datos (el enlace está en la cabecera global, FE-17);
 * figura del cuerpo (FE-05); cuadrícula de indicadores ordenada por gravedad; detalle del sistema
 * al hacer clic (FE-06). La evaluación se refresca cada 15 s.
 * Los pendientes de sincronizar del outbox se ven en la cabecera global (PendingSyncChip, FE-11).
 */
export default function Dashboard() {
  const vocab = useVocab()
  // Un member, siempre los suyos; el resto de roles, el member elegido (FE-28).
  const memberId = useActiveMemberId()
  const { user, can } = useAuth()
  // Medir: un member para sí mismo; medic/admin para cualquiera ("medir para otro solo medic").
  const canMeasure =
    can('action:measure-others') || (can('view:measure') && user?.member_id === memberId)
  const envId = useEnvironmentStore((s) => s.envId)
  const assessment = useAssessment(memberId, REFRESH_MS)
  const systems = useSystems()
  const indicators = useIndicators()
  const envs = useEnvironments()
  const [selected, setSelected] = useState<string | null>(null)
  // Sistema señalado en la leyenda (columna derecha) o en la figura: se resalta en ambas.
  const [hovered, setHovered] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined
  // Semáforo provisional (FE-12): mediciones aún sin sincronizar, evaluadas en el dispositivo.
  const prov = useProvisionalAssessment(
    memberId,
    assessment.state === 'ready' ? assessment.data : null,
    indicators.state === 'ready' ? indicators.data : NO_INDICATORS,
    env,
  )

  const regions = useMemo(
    () =>
      prov && systems.state === 'ready' ? buildRegions(systems.data, prov.assessment.systems) : [],
    [prov, systems],
  )

  const title = (
    <h1 className="text-2xl font-semibold">{capitalize(vocab.member)}: tu panel de salud</h1>
  )

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

  if (assessment.state === 'error' || systems.state === 'error') {
    return (
      <section className="space-y-4">
        {title}
        <div className="rounded-lg border border-env-border bg-env-surface p-4">
          <p>No se ha podido cargar la evaluación.</p>
          <button
            type="button"
            onClick={() => {
              assessment.retry()
              systems.retry()
            }}
            className="mt-3 rounded-md bg-env-primary px-3 py-1.5 text-sm font-medium text-env-primary-text"
          >
            Reintentar
          </button>
        </div>
      </section>
    )
  }

  if (assessment.state !== 'ready') {
    return (
      <section className="space-y-6">
        {title}
        <div className="grid gap-8 md:grid-cols-[minmax(240px,320px)_1fr]" aria-busy="true">
          <div className="h-96 animate-pulse rounded-xl bg-env-surface" />
          <div className="grid content-start gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-env-surface" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  const a = prov?.assessment ?? assessment.data
  const provisionalIds = prov?.provisionalIds
  const stale = isFigureStale(a.liveness)
  const live = livenessState(a.liveness)
  const systemById = new Map((systems.state === 'ready' ? systems.data : []).map((s) => [s.id, s]))
  const indicatorById = new Map(
    (indicators.state === 'ready' ? indicators.data : []).map((i) => [i.id, i]),
  )
  const cards = a.systems
    .flatMap((s) => s.indicators.map((ind) => ({ systemId: s.system_id, ind })))
    .sort((x, y) => bySeverity(x.ind.status, y.ind.status))
  const selectedSystem = selected ? systemById.get(selected) : undefined

  const summary = (sidebar: boolean) => (
    <div
      className={
        sidebar
          ? 'flex flex-col items-start gap-1.5 rounded-lg border border-env-border p-2.5 text-xs'
          : 'flex flex-wrap items-center gap-2 md:hidden'
      }
    >
      {/* Si el "sin datos" se debe a un liveness stale, basta el badge de liveness (FE-34). */}
      {!(live === 'stale' && a.overall_status === 'unknown') && (
        <StatusBadge
          status={a.overall_status}
          label={`Estado general: ${statusStyle(a.overall_status).label}`}
          size={sidebar ? 'sm' : 'md'}
        />
      )}
      {live && <StatusBadge status={live} label={formatSinceLabel(a.last_seen_at, serverNow())} />}
      <span
        className={`${sidebar ? 'text-xs' : 'text-sm'} font-mono text-env-muted`}
        role={sidebar ? 'status' : undefined}
      >
        {assessment.refreshFailed
          ? '⚠ No se pudo actualizar: los datos pueden estar desfasados'
          : assessment.updatedAt
            ? `Actualizado ${formatAgo(assessment.updatedAt.toISOString(), serverNow())}`
            : null}
      </span>
    </div>
  )

  return (
    <section className="space-y-4 lg:pt-[clamp(2.5rem,calc(100vh-788px),7rem)]">
      <header className="space-y-3">
        {/* Título solo para lectores de pantalla; el estado general va en la barra lateral. */}
        <div className="sr-only">{title}</div>
        {/* Estado general: en la barra lateral (escritorio) y, en móvil, aquí arriba. */}
        <SidebarPortal>{summary(true)}</SidebarPortal>
        {summary(false)}
        {provisionalIds && provisionalIds.size > 0 && (
          <p className="rounded-lg border border-dashed border-env-border px-3 py-2 text-sm text-env-muted">
            <span aria-hidden>⇡ </span>
            <strong className="text-env-text">Estado provisional:</strong>{' '}
            {provisionalIds.size === 1
              ? 'hay 1 indicador'
              : `hay ${provisionalIds.size} indicadores`}{' '}
            con mediciones sin sincronizar, evaluados en este dispositivo. Se sustituye por la
            evaluación del servidor al sincronizar.
          </p>
        )}
      </header>

      {/* Tres columnas en escritorio (≥ 1280 px): sistemas | cuerpo | indicadores, las laterales
          centradas en vertical, y debajo las fases de la misión a todo el ancho. Más estrecho:
          cuerpo e indicadores lado a lado y los sistemas debajo; en móvil, todo en columna. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(240px,320px)_1fr] xl:grid-cols-[230px_minmax(240px,320px)_1fr]">
        <div className="order-3 lg:col-span-2 xl:order-1 xl:col-span-1 xl:self-center">
          <h2 className="mb-3 text-lg font-semibold">Sistemas</h2>
          <BodyLegend
            regions={regions}
            stale={stale}
            selectedSystemId={selected}
            onSelectSystem={setSelected}
            onHoverSystem={setHovered}
            className="justify-start"
            compact
            vertical
          />
        </div>

        <div className="order-1 lg:sticky lg:top-4 lg:self-start xl:order-2">
          <BodyFigure
            regions={regions}
            liveness={a.liveness}
            staleLabel={formatSinceLabel(a.last_seen_at, serverNow())}
            selectedSystemId={selected}
            onSelectSystem={setSelected}
            hoveredSystemId={hovered}
            onHoverSystem={setHovered}
            showLegend={false}
          />
        </div>

        <div className="order-2 xl:order-3 xl:self-center">
          <h2 className="mb-3 text-lg font-semibold">Indicadores</h2>
          {cards.length === 0 ? (
            <p className="text-env-muted">Todavía no hay mediciones.</p>
          ) : (
            // Lista fija: símbolo de estado, nombre y valor (el resto, en el detalle del sistema).
            <ul className="flex flex-col gap-2">
              {cards.map(({ systemId, ind }) => (
                <li key={`${systemId}-${ind.indicator_id}`}>
                  <IndicatorCard
                    indicator={ind}
                    name={indicatorById.get(ind.indicator_id)?.name}
                    systemName={systemById.get(systemId)?.name}
                    stale={stale}
                    provisional={provisionalIds?.has(ind.indicator_id)}
                    onClick={() => setSelected(systemId)}
                    compact
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Fases de la misión debajo del cuerpo, a todo el ancho de las tres columnas. */}
        {env?.kind === 'space' && env.mission && (
          <div className="order-4 lg:col-span-2 lg:mt-8 xl:col-span-3">
            <MissionPhaseBar
              mission={env.mission}
              now={serverNow()}
              canCheckIn={can('view:checkin')}
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedSystem && (
          <SystemPanel
            key={selectedSystem.id}
            system={selectedSystem}
            assessed={a.systems.find((x) => x.system_id === selectedSystem.id)}
            indicators={indicators.state === 'ready' ? indicators.data : []}
            isSpace={env?.kind === 'space'}
            stale={stale}
            canMeasure={canMeasure}
            provisionalIds={provisionalIds}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
