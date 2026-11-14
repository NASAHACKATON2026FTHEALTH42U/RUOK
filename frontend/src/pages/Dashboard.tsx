import { AnimatePresence } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { serverNow } from '../api/client'
import { useAssessment } from '../api/useAssessment'
import { useEnvironments } from '../api/useEnvironments'
import { useIndicators } from '../api/useIndicators'
import { useSystems } from '../api/useSystems'
import { BodyFigure } from '../components/body/BodyFigure'
import { buildRegions, formatSinceLabel, isFigureStale } from '../components/body/regions'
import { SystemPanel } from '../components/dashboard/SystemPanel'
import { capitalize, useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'

/**
 * Panel del member: figura del cuerpo (FE-05) y detalle del sistema al hacer clic (FE-06).
 * TODO(FE-07): layout completo del dashboard.
 */
export default function Dashboard() {
  const { member } = useVocab()
  const memberId = useEnvironmentStore((s) => s.memberId)
  const envId = useEnvironmentStore((s) => s.envId)
  const assessment = useAssessment(memberId)
  const systems = useSystems()
  const indicators = useIndicators()
  const envs = useEnvironments()
  const [selected, setSelected] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])

  const regions = useMemo(
    () =>
      assessment.state === 'ready' && systems.state === 'ready'
        ? buildRegions(systems.data, assessment.data.systems)
        : [],
    [assessment, systems],
  )

  const title = <h1 className="text-2xl font-semibold">{capitalize(member)}: tu panel de salud</h1>

  if (memberId === null) {
    return (
      <section>
        {title}
        <p className="mt-2 text-env-muted">
          No hay nadie seleccionado.{' '}
          <Link to="/" className="underline hover:text-env-text">
            Elige entorno y {member}
          </Link>
          .
        </p>
      </section>
    )
  }

  const failed = assessment.state === 'error' || systems.state === 'error'
  const selectedSystem =
    systems.state === 'ready' ? systems.data.find((s) => s.id === selected) : undefined
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined

  return (
    <section className="space-y-6">
      {title}
      {failed ? (
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
      ) : assessment.state !== 'ready' ? (
        <div className="mx-auto h-96 max-w-[280px] animate-pulse rounded-xl bg-env-surface" />
      ) : (
        <>
          <BodyFigure
            regions={regions}
            liveness={assessment.data.liveness}
            staleLabel={formatSinceLabel(assessment.data.last_seen_at, serverNow())}
            selectedSystemId={selected}
            onSelectSystem={setSelected}
          />
          <AnimatePresence>
            {selectedSystem && (
              <SystemPanel
                key={selectedSystem.id}
                system={selectedSystem}
                assessed={assessment.data.systems.find((x) => x.system_id === selectedSystem.id)}
                indicators={indicators.state === 'ready' ? indicators.data : []}
                isSpace={env?.kind === 'space'}
                stale={isFigureStale(assessment.data.liveness)}
                onClose={close}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </section>
  )
}
