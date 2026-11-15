import { AnimatePresence } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { serverNow } from '../api/client'
import { useAssessment } from '../api/useAssessment'
import { useEnvironments } from '../api/useEnvironments'
import { useIndicators } from '../api/useIndicators'
import { useSystems } from '../api/useSystems'
import { BodyFigure } from '../components/body/BodyFigure'
import { buildRegions, formatSinceLabel, isFigureStale } from '../components/body/regions'
import { IndicatorCard } from '../components/dashboard/IndicatorCard'
import { SystemPanel } from '../components/dashboard/SystemPanel'
import { SystemsRing } from '../components/dashboard/SystemsRing'
import { BodyLegend } from '../components/body/BodyLegend'
import { TopBarPortal } from '../components/ui/TopBarPortal'
import { bySeverity, livenessState } from '../components/ui/status'
import { StatusHeadline } from '../components/ui/StatusHeadline'
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
  // Indicador pulsado (celda del panel): el detalle del sistema abre su gráfica con él solo.
  const [focusIndicator, setFocusIndicator] = useState<string | null>(null)
  const selectSystem = useCallback((id: string) => {
    setSelected(id)
    setFocusIndicator(null)
  }, [])
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
        <div className=" border border-env-border bg-env-surface p-4">
          <p>No se ha podido cargar la evaluación.</p>
          <button
            type="button"
            onClick={() => {
              assessment.retry()
              systems.retry()
            }}
            className="mt-3  bg-env-primary px-3 py-1.5 text-sm font-medium text-env-primary-text"
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
          <div className="h-96 animate-pulse  bg-env-surface" />
          <div className="grid content-start gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse  bg-env-surface" />
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
            ? 'flex min-w-0 flex-wrap items-center gap-3 text-xs'
            : 'mb-3 flex flex-wrap items-center gap-2 md:hidden'
        }
      >
        {/* El estado general, en una palabra, en la barra superior (escritorio): es el peor entre
            la salud y el liveness; con liveness stale o lost y todo normal, "Sin datos" (nunca verde
            sin datos). */}
        {desktop && (
          <StatusHeadline
            state={live && a.overall_status === 'normal' ? 'unknown' : a.overall_status}
          />
        )}
        {live && (
          <StatusBadge status={live} label={formatSinceLabel(a.last_seen_at, serverNow())} />
        )}
        {desktop && provisionalText && (
          <span
            className=" border border-dashed border-env-border px-2 py-0.5 text-env-muted"
            title={`Estado provisional: ${provisionalText}`}
          >
            <span aria-hidden>⇡ </span>
            <strong className="text-env-text">Estado provisional</strong>
            <span className="sr-only">: {provisionalText}</span>
          </span>
        )}
        <span
          className={`${desktop ? 'text-xs' : 'text-[0.75rem]'} font-mono text-env-muted`}
          role={desktop ? 'status' : undefined}
        >
          {/* Solo el aviso de fallo: los datos pueden estar desfasados. */}
          {assessment.refreshFailed && '⚠ No se pudo actualizar: los datos pueden estar desfasados'}
        </span>
      </div>
    )

  return (
    // Ocupa el alto disponible (Layout `fill`): en tableta y escritorio, la rejilla llena el hueco.
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      {/* `contents`: sin hueco arriba cuando no hay nada que avisar (en escritorio va todo arriba). */}
      <header className="contents">
        {/* Título solo para lectores de pantalla; el estado general va en la barra superior. */}
        <div className="sr-only">{title}</div>
        {/* Estado general: en la barra superior (escritorio) y, en móvil, aquí arriba. */}
        <TopBarPortal>{summary(true)}</TopBarPortal>
        {summary(false)}
        {provisionalText && (
          <p className="mb-3  border border-dashed border-env-border px-3 py-2 text-sm text-env-muted md:hidden">
            <span aria-hidden>⇡ </span>
            <strong className="text-env-text">Estado provisional:</strong> {provisionalText}
          </p>
        )}
      </header>

      {/* Móvil: cuerpo en pequeño con el estado y lista de sistemas (estilo HUD). */}
      <SystemsRing
        regions={regions}
        stale={stale}
        name={user?.member_id === memberId ? user?.display_name.split(' ').pop() : undefined}
        now={serverNow()}
        liveness={a.liveness}
        staleLabel={formatSinceLabel(a.last_seen_at, serverNow())}
        onSelectSystem={selectSystem}
      />

      {/* Tableta y escritorio: ocupa todo el hueco, sin scroll (rejilla `.dash-grid` en index.css).
          Estrecho: arriba el cuerpo y los sistemas, abajo los indicadores. Ancho: sistemas |
          cuerpo | indicadores. El cuerpo va en su panel, recortado por las rodillas (ahí están
          todas las zonas que se pueden pulsar). Las celdas reparten el alto
          y su texto crece con el espacio; si no caben, la lista hace scroll dentro del panel. */}
      <div className="dash-fill hidden min-h-0 flex-1 overflow-hidden md:block">
        <div className="dash-grid">
          <section
            aria-labelledby="dash-systems"
            className="hud-panel @container flex min-h-0 min-w-0 flex-col [grid-area:systems]"
          >
            <div className="hud-panel-head">
              <h2 id="dash-systems">Sistemas</h2>
            </div>
            <BodyLegend
              regions={regions}
              stale={stale}
              selectedSystemId={selected}
              onSelectSystem={selectSystem}
              onHoverSystem={setHovered}
              className="-mr-px -mb-px min-h-0 flex-1 auto-rows-[minmax(2.75rem,1fr)] grid-cols-1 overflow-y-auto @min-[26rem]:grid-cols-2"
              rows
            />
          </section>

          <section
            aria-label="Cuerpo"
            className="hud-panel min-h-0 min-w-0 [container-type:size] [grid-area:body]"
          >
            <BodyFigure
              regions={regions}
              liveness={a.liveness}
              staleLabel={formatSinceLabel(a.last_seen_at, serverNow())}
              selectedSystemId={selected}
              onSelectSystem={selectSystem}
              hoveredSystemId={hovered}
              onHoverSystem={setHovered}
              showLegend={false}
              crop={0.71}
              fill
            />
          </section>

          <section
            aria-labelledby="dash-indicators"
            className="hud-panel @container flex min-h-0 min-w-0 flex-col [grid-area:indicators]"
          >
            <h2 id="dash-indicators" className="hud-panel-head">
              Indicadores
            </h2>
            {cards.length === 0 ? (
              <p className="px-3.5 py-3 text-sm text-env-muted">Todavía no hay mediciones.</p>
            ) : (
              // Celdas separadas por líneas; las del borde se esconden bajo el marco del panel.
              <ul className="-mr-px -mb-px grid min-h-0 flex-1 auto-rows-[minmax(3.75rem,1fr)] grid-cols-2 overflow-y-auto @min-[30rem]:grid-cols-3 @min-[44rem]:grid-cols-4">
                {cards.map(({ systemId, ind }) => (
                  <li
                    key={`${systemId}-${ind.indicator_id}`}
                    className="dash-cell border-r border-b border-env-border/60"
                  >
                    <IndicatorCard
                      indicator={ind}
                      name={indicatorById.get(ind.indicator_id)?.name}
                      systemName={systemById.get(systemId)?.name}
                      stale={stale}
                      provisional={provisionalIds?.has(ind.indicator_id)}
                      onClick={() => {
                        setSelected(systemId)
                        setFocusIndicator(ind.indicator_id)
                      }}
                      tile
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
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
            focusIndicatorId={focusIndicator}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
