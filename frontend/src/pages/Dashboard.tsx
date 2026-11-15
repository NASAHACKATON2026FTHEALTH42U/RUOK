import { AnimatePresence } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
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
import { SystemsRing } from '../components/dashboard/SystemsRing'
import { BodyLegend } from '../components/body/BodyLegend'
import { TopBarPortal } from '../components/ui/TopBarPortal'
import { bySeverity, livenessState, statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { capitalize, useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'
import { useActiveMemberId, useAuth } from '../auth/useAuth'
import { useProvisionalAssessment } from '../offline/useProvisional'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'

/** Cada cuánto se refresca la evaluación (FE-07). */
const REFRESH_MS = 15_000
const NO_INDICATORS: never[] = []

/**
 * Panel del member (FE-07): cabecera con estado general, liveness y frescura de los datos (el enlace está en la cabecera global, FE-17);
 * figura del cuerpo (FE-05); paneles de sistemas e indicadores (celdas ordenadas por gravedad);
 * detalle del sistema al hacer clic (FE-06). La evaluación se refresca cada 15 s.
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
        <NoMemberSelected />
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

  const provisionalText =
    provisionalIds && provisionalIds.size > 0
      ? `${provisionalIds.size === 1 ? 'hay 1 indicador' : `hay ${provisionalIds.size} indicadores`} con mediciones sin sincronizar, evaluados en este dispositivo. Se sustituye por la evaluación del servidor al sincronizar.`
      : null

  // Escritorio: en la barra superior (Layout, TopBarPortal), en línea. Móvil: aquí arriba y solo
  // si hay algo que avisar (liveness o fallo al actualizar), para caber sin scroll (hud-style §5).
  const summary = (desktop: boolean) =>
    (desktop || live || assessment.refreshFailed) && (
      <div
        className={
          desktop
            ? 'flex min-w-0 flex-wrap items-center gap-2 text-xs'
            : 'mb-3 flex flex-wrap items-center gap-2 md:hidden'
        }
      >
        {/* Si el "sin datos" se debe a un liveness stale, basta el badge de liveness (FE-34).
          En móvil el estado general ya lo cuenta el anillo (SystemsRing). */}
        {desktop && !(live === 'stale' && a.overall_status === 'unknown') && (
          <StatusBadge
            status={a.overall_status}
            label={`Estado general: ${statusStyle(a.overall_status).label}`}
            size="xs"
          />
        )}
        {live && (
          <StatusBadge status={live} label={formatSinceLabel(a.last_seen_at, serverNow())} />
        )}
        {desktop && provisionalText && (
          <span
            className="rounded-md border border-dashed border-env-border px-2 py-0.5 text-env-muted"
            title={`Estado provisional: ${provisionalText}`}
          >
            <span aria-hidden>⇡ </span>
            <strong className="text-env-text">Estado provisional</strong>
            <span className="sr-only">: {provisionalText}</span>
          </span>
        )}
        <span
          className={`${desktop ? 'text-xs' : 'text-[11px]'} font-mono text-env-muted`}
          role={desktop ? 'status' : undefined}
        >
          {/* Solo el aviso de fallo: los datos pueden estar desfasados. */}
          {assessment.refreshFailed && '⚠ No se pudo actualizar: los datos pueden estar desfasados'}
        </span>
      </div>
    )

  return (
    // Ocupa el alto disponible (Layout `fill`): en tableta y escritorio el bloque se centra en
    // vertical y, si no cabe, la página hace scroll como siempre (`my-auto` no corta nada).
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      {/* `contents`: sin hueco arriba cuando no hay nada que avisar (en escritorio va todo arriba). */}
      <header className="contents">
        {/* Título solo para lectores de pantalla; el estado general va en la barra superior. */}
        <div className="sr-only">{title}</div>
        {/* Estado general: en la barra superior (escritorio) y, en móvil, aquí arriba. */}
        <TopBarPortal>{summary(true)}</TopBarPortal>
        {summary(false)}
        {provisionalText && (
          <p className="mb-3 rounded-lg border border-dashed border-env-border px-3 py-2 text-sm text-env-muted md:hidden">
            <span aria-hidden>⇡ </span>
            <strong className="text-env-text">Estado provisional:</strong> {provisionalText}
          </p>
        )}
      </header>

      {/* Móvil: anillo de sistemas y lista SYS.01 (estilo HUD, maqueta Main). */}
      <SystemsRing
        regions={regions}
        stale={stale}
        name={user?.member_id === memberId ? user?.display_name.split(' ').pop() : undefined}
        env={env}
        now={serverNow()}
        onSelectSystem={setSelected}
      />

      {/* Tableta y escritorio, sin scroll. Tableta (768–1023 px): el cuerpo a la izquierda y, a
          la derecha, los indicadores y debajo los sistemas. Desde 1024 px, tres columnas
          centradas en vertical: sistemas | cuerpo | indicadores. Debajo, la fase de la misión
          a todo el ancho y en una línea. Los indicadores van en celdas (2 por fila, 3 desde
          1280 px): 16 indicadores ocupan 6–8 filas en vez de 16. */}
      <div className="hidden md:my-auto md:flex md:flex-col md:gap-4">
        <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)] lg:grid-cols-[190px_auto_minmax(0,1fr)] lg:items-center lg:gap-x-5 xl:grid-cols-[220px_auto_minmax(0,1fr)] xl:gap-x-6">
          <div className="md:row-span-2 md:self-center lg:col-start-2 lg:row-span-1 lg:row-start-1 lg:max-xl:[--body-max:min(200px,max(170px,calc((100vh-300px)/2)))]">
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

          <section
            aria-labelledby="dash-indicators"
            className="hud-panel min-w-0 md:col-start-2 md:row-start-1 lg:col-start-3"
          >
            <h2 id="dash-indicators" className="hud-panel-head">
              <b>IND.02</b>Indicadores
            </h2>
            {cards.length === 0 ? (
              <p className="px-3.5 py-3 text-sm text-env-muted">Todavía no hay mediciones.</p>
            ) : (
              // Celdas separadas por líneas; las del borde se esconden bajo el marco del panel.
              <ul className="-mr-px -mb-px grid grid-cols-2 xl:grid-cols-3">
                {cards.map(({ systemId, ind }) => (
                  <li
                    key={`${systemId}-${ind.indicator_id}`}
                    className="border-r border-b border-env-border/60"
                  >
                    <IndicatorCard
                      indicator={ind}
                      name={indicatorById.get(ind.indicator_id)?.name}
                      systemName={systemById.get(systemId)?.name}
                      stale={stale}
                      provisional={provisionalIds?.has(ind.indicator_id)}
                      onClick={() => setSelected(systemId)}
                      tile
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="dash-systems"
            className="hud-panel min-w-0 md:col-start-2 md:row-start-2 lg:col-start-1 lg:row-start-1"
          >
            <h2 id="dash-systems" className="hud-panel-head">
              <b>SYS.01</b>Sistemas
            </h2>
            <BodyLegend
              regions={regions}
              stale={stale}
              selectedSystemId={selected}
              onSelectSystem={setSelected}
              onHoverSystem={setHovered}
              className="-mr-px -mb-px grid-cols-2 lg:grid-cols-1"
              rows
            />
          </section>
        </div>

        {env?.kind === 'space' && env.mission && (
          <MissionPhaseBar
            mission={env.mission}
            now={serverNow()}
            canCheckIn={can('view:checkin')}
            compact
          />
        )}
      </div>

      <AnimatePresence>
        {selectedSystem && (
          <SystemPanel
            key={selectedSystem.id}
            system={selectedSystem}
            assessed={a.systems.find((x) => x.system_id === selectedSystem.id)}
            indicators={indicators.state === 'ready' ? indicators.data : []}
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
