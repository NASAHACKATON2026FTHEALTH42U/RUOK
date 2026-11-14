import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { serverNow } from '../api/client'
import { useAssessment } from '../api/useAssessment'
import { useSystems } from '../api/useSystems'
import { BodyFigure } from '../components/body/BodyFigure'
import { buildRegions, formatSinceLabel } from '../components/body/regions'
import { capitalize, useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'

/**
 * Panel del member. De momento solo la figura del cuerpo (FE-05).
 * TODO(FE-07): layout completo; TODO(FE-06): SystemPanel con el sistema seleccionado.
 */
export default function Dashboard() {
  const { member } = useVocab()
  const memberId = useEnvironmentStore((s) => s.memberId)
  const assessment = useAssessment(memberId)
  const systems = useSystems()
  const [selected, setSelected] = useState<string | null>(null)

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
  const selectedName = regions.find((r) => r.systemId === selected)?.name

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
          {selectedName && (
            <p className="text-center text-sm text-env-muted">
              Sistema seleccionado: <strong className="text-env-text">{selectedName}</strong> (el
              detalle llega con FE-06)
            </p>
          )}
        </>
      )}
    </section>
  )
}
