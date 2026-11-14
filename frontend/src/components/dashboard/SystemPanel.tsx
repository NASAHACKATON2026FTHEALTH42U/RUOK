import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Assessment } from '../../api/useAssessment'
import type { Indicator } from '../../api/useIndicators'
import type { BodySystem } from '../../api/useSystems'
import { StatusBadge } from '../ui/StatusBadge'
import { formatHazard } from './format'
import { IndicatorCard } from './IndicatorCard'

type SystemAssessment = Assessment['systems'][number]

interface SystemPanelProps {
  system: BodySystem
  /** Evaluación del sistema; sin ella, el sistema está "sin datos". */
  assessed: SystemAssessment | undefined
  indicators: Indicator[]
  /** Entorno espacial: muestra los efectos en el espacio y los peligros. */
  isSpace: boolean
  /** Liveness stale/lost: los estados se muestran como "sin datos recientes". */
  stale: boolean
  onClose: () => void
}

/**
 * Detalle de un sistema del cuerpo (FE-06): función, efectos en el espacio, peligros,
 * indicadores (valor, estado, tendencia, antigüedad), recomendaciones y "Medir ahora".
 * Panel lateral (abajo en móvil). Se cierra con Esc, con el botón o con un clic fuera.
 */
export function SystemPanel({
  system,
  assessed,
  indicators,
  isSpace,
  stale,
  onClose,
}: SystemPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = `system-panel-${system.id}`
  const byId = new Map(indicators.map((i) => [i.id, i]))
  const recommendations = [...(assessed?.recommendations ?? [])].sort(
    (a, b) => a.priority - b.priority,
  )

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40">
      {/* Clic fuera = cerrar */}
      <motion.button
        type="button"
        aria-label="Cerrar el detalle"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-env-border bg-env-bg p-5 shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-2xl"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'tween', duration: 0.2 }}
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-xl font-semibold">
              {system.name}
            </h2>
            <StatusBadge
              status={stale ? 'stale' : (assessed?.status ?? 'unknown')}
              className="mt-2"
            />
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-env-muted hover:bg-env-surface hover:text-env-text focus-visible:outline-2 focus-visible:outline-env-primary"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <section className="mt-5 space-y-3 text-sm">
          <p>
            <span className="block text-xs font-medium tracking-wide text-env-muted uppercase">
              Función
            </span>
            {system.function}
          </p>
          {isSpace && (
            <p>
              <span className="block text-xs font-medium tracking-wide text-env-muted uppercase">
                En el espacio
              </span>
              {system.space_effects}
            </p>
          )}
          {isSpace && system.hazards && system.hazards.length > 0 && (
            <div>
              <span className="block text-xs font-medium tracking-wide text-env-muted uppercase">
                Peligros
              </span>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {system.hazards.map((h) => (
                  <li key={h} className="rounded-full border border-env-border px-2 py-0.5 text-xs">
                    {formatHazard(h)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-semibold">Indicadores</h3>
          {!assessed || assessed.indicators.length === 0 ? (
            <p className="mt-2 text-sm text-env-muted">
              Todavía no hay mediciones de este sistema.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {assessed.indicators.map((ind) => (
                <li key={ind.indicator_id}>
                  <IndicatorCard
                    indicator={ind}
                    name={byId.get(ind.indicator_id)?.name}
                    stale={stale}
                    showTrend
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {recommendations.length > 0 && (
          <section className="mt-6">
            <h3 className="text-sm font-semibold">Recomendaciones</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {recommendations.map((r) => (
                <li key={r.id}>{r.text}</li>
              ))}
            </ol>
          </section>
        )}

        <Link
          to={`/measure?system=${encodeURIComponent(system.id)}`}
          className="mt-6 block rounded-lg bg-env-primary px-4 py-2.5 text-center font-medium text-env-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-text"
        >
          Medir ahora
        </Link>
      </motion.aside>
    </div>
  )
}
