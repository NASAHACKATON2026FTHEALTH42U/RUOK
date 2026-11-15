import { motion } from 'framer-motion'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Assessment } from '../../api/useAssessment'
import type { Indicator } from '../../api/useIndicators'
import { useInterventions } from '../../api/useInterventions'
import type { BodySystem } from '../../api/useSystems'
import { InterventionCard } from '../behavioral/InterventionCard'
import { ListenButton } from '../behavioral/VoiceControls'
import { CaseFeedbackFor } from '../alerts/CaseFeedbackNote'
import { Modal } from '../ui/Modal'
import { bySeverity } from '../ui/status'
import { StatusBadge } from '../ui/StatusBadge'
import { IndicatorCard } from './IndicatorCard'
import { SystemTrends } from './SystemTrends'

type SystemAssessment = Assessment['systems'][number]

interface SystemPanelProps {
  system: BodySystem
  /** Evaluación del sistema; sin ella, el sistema está "sin datos". */
  assessed: SystemAssessment | undefined
  indicators: Indicator[]
  /** Liveness stale/lost: los estados se muestran como "sin datos recientes". */
  stale: boolean
  /** El rol puede registrar mediciones de este member (si no, no hay "Medir ahora"). */
  canMeasure?: boolean
  /** Indicadores con estado provisional (medición sin sincronizar, FE-12). */
  provisionalIds?: ReadonlySet<string>
  /** Indicador pulsado en el panel: la gráfica empieza solo con él (luego se añaden otros). */
  focusIndicatorId?: string | null
  onClose: () => void
}

/**
 * Detalle de un sistema del cuerpo (FE-06): estado, las tendencias en un bloque y, plegados
 * (se abren por encima, sin ocupar sitio), indicadores, recomendaciones e intervenciones; y
 * "Medir ahora". Las tendencias van en una sola gráfica con selectores de indicador. Sin los
 * textos descriptivos (función, efectos en el espacio, peligros), para que quepa sin scroll.
 * Modal grande centrada y bloqueante: se cierra con Esc o con el botón.
 */
export function SystemPanel({
  system,
  assessed,
  indicators,
  stale,
  canMeasure = true,
  provisionalIds,
  focusIndicatorId,
  onClose,
}: SystemPanelProps) {
  const titleId = `system-panel-${system.id}`
  const byId = new Map(indicators.map((i) => [i.id, i]))
  const recommendations = [...(assessed?.recommendations ?? [])].sort(
    (a, b) => a.priority - b.priority,
  )
  // Intervenciones (FE-20): las que proponen las recomendaciones y las del sistema, sin repetir.
  const catalog = useInterventions()
  const allInterventions = catalog.state === 'ready' ? catalog.data : []
  const recommendedIds = new Set(recommendations.map((r) => r.intervention_id).filter(Boolean))
  const interventions = allInterventions
    .filter((i) => recommendedIds.has(i.id) || i.system_id === system.id)
    .sort((a, b) => Number(recommendedIds.has(b.id)) - Number(recommendedIds.has(a.id)))

  // Secciones plegadas: solo una abierta a la vez.
  const [open, setOpen] = useState<string | null>(null)
  const sections = [
    assessed && assessed.indicators.length > 0
      ? {
          id: 'indicators',
          label: 'Indicadores',
          count: assessed.indicators.length,
          content: (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {assessed.indicators.map((ind) => (
                <li key={ind.indicator_id}>
                  <IndicatorCard
                    indicator={ind}
                    name={byId.get(ind.indicator_id)?.name}
                    stale={stale}
                    provisional={provisionalIds?.has(ind.indicator_id)}
                  />
                </li>
              ))}
            </ul>
          ),
        }
      : null,
    recommendations.length > 0
      ? {
          id: 'recommendations',
          label: 'Recomendaciones',
          count: recommendations.length,
          content: (
            <>
              {/* Voz guía (FE-37): las recomendaciones en voz alta. */}
              <ListenButton
                texts={recommendations.map((r) => r.text)}
                label="Escuchar recomendaciones"
                className="mb-2"
              />
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {recommendations.map((r) => (
                  <li key={r.id}>{r.text}</li>
                ))}
              </ol>
            </>
          ),
        }
      : null,
    interventions.length > 0
      ? {
          id: 'interventions',
          label: 'Qué puedes hacer ahora',
          count: interventions.length,
          content: (
            <ul className="grid gap-2 md:grid-cols-2">
              {interventions.map((i) => (
                <li key={i.id}>
                  <InterventionCard intervention={i} compact />
                </li>
              ))}
            </ul>
          ),
        }
      : null,
  ].filter((x) => x !== null)
  const current = sections.find((x) => x.id === open)

  return (
    // Modal bloqueante: hasta cerrarlo (✕ o Escape) no se puede usar nada más. El fondo oscuro
    // lo pinta el propio panel, con fundido (el `::backdrop` no se puede animar al salir).
    <Modal labelledBy={titleId} onClose={onClose} backdrop={false}>
      <div className="flex min-h-full items-center justify-center p-3 md:p-8">
        <motion.div
          aria-hidden
          className="fixed inset-0 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto  border border-env-border bg-env-bg p-5 shadow-2xl md:p-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'tween', duration: 0.2 }}
        >
          <header className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id={titleId} className="text-2xl font-semibold">
                {system.name}
              </h2>
              <StatusBadge status={stale ? 'stale' : (assessed?.status ?? 'unknown')} size="sm" />
            </div>
            <button
              data-autofocus
              type="button"
              onClick={onClose}
              className=" px-2 py-1 text-env-muted hover:bg-env-surface hover:text-env-text focus-visible:outline-2 focus-visible:outline-env-primary"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </header>

          {/* Aviso abierto de este sistema: «Estamos revisando tu caso» (y si ha mejorado, se dice). */}
          <CaseFeedbackFor
            systemId={system.id}
            current={stale ? 'unknown' : assessed?.status}
            className="mt-4"
          />

          {/* Las secciones plegadas (indicadores, recomendaciones, intervenciones) se abren SOBRE
            este bloque, ocupando justo su hueco y con scroll propio: no empujan el contenido ni
            se salen de la ventana. */}
          <section className={`relative mt-4 ${current ? 'min-h-48' : ''}`}>
            {!assessed || assessed.indicators.length === 0 ? (
              <p className="text-sm text-env-muted">Todavía no hay mediciones de este sistema.</p>
            ) : (
              // Los peores primero: son los que se ven al abrir el sistema.
              <SystemTrends
                series={[...assessed.indicators]
                  .sort((a, b) => bySeverity(a.status, b.status))
                  .map((ind) => ({
                    id: ind.indicator_id,
                    name: byId.get(ind.indicator_id)?.name ?? ind.indicator_id,
                    unit: ind.unit,
                    range: ind.range,
                  }))}
                initial={focusIndicatorId ? [focusIndicatorId] : undefined}
              />
            )}
            {current && (
              <div
                id={`${titleId}-extra`}
                role="region"
                aria-label={current.label}
                className="absolute inset-0 z-10 overflow-y-auto  border border-env-border bg-env-bg p-3 [scrollbar-color:var(--env-border)_transparent]"
              >
                {current.content}
              </div>
            )}
          </section>

          {sections.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    aria-expanded={open === sec.id}
                    aria-controls={open === sec.id ? `${titleId}-extra` : undefined}
                    onClick={() => setOpen(open === sec.id ? null : sec.id)}
                    className={` border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                      open === sec.id
                        ? 'border-env-text bg-env-surface'
                        : 'border-env-border text-env-muted hover:border-env-text hover:text-env-text'
                    }`}
                  >
                    <span aria-hidden>{open === sec.id ? '▾ ' : '▸ '}</span>
                    {sec.label} ({sec.count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {canMeasure && (
            <Link
              to={`/measure?system=${encodeURIComponent(system.id)}`}
              className="mx-auto mt-4 block max-w-sm  bg-env-primary px-4 py-2 text-center font-medium text-env-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-text"
            >
              Medir ahora
            </Link>
          )}
        </motion.div>
      </div>
    </Modal>
  )
}
