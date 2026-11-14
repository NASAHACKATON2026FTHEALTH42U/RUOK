import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { serverNow } from '../api/client'
import { newId } from '../api/newId'
import { useIndicators } from '../api/useIndicators'
import {
  answeredCount,
  buildCheckinBatch,
  CHECKIN_INDICATORS,
  type Answers,
} from '../components/behavioral/checkin'
import { FaceScale } from '../components/behavioral/FaceScale'
import { statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useVocab } from '../environments/useVocab'
import { sendMeasurements, type MeasurementBatchResult } from '../offline/outbox'
import { useEnvironmentStore } from '../store/environment'

type Phase =
  | { kind: 'editing' }
  | { kind: 'sending' }
  | { kind: 'sent'; result: MeasurementBatchResult }
  | { kind: 'queued' }
  | { kind: 'failed'; message: string }

const btnPrimary = 'rounded-lg bg-env-primary px-4 py-2 font-medium text-env-primary-text'
const btnSecondary = 'rounded-lg border border-env-border px-4 py-2 hover:border-env-text'

/**
 * Check-in diario conductual "R U OK?" (FE-19). Seis escalas 1–5 con caras (ánimo, estrés,
 * energía, soledad, calidad del sueño y relación con el equipo) y una nota opcional, en una
 * sola pantalla para hacerlo en menos de 30 s. Se envía como UN lote de mediciones con
 * `source: "checkin"` por el outbox (FE-11): sin red queda guardado en el dispositivo y se
 * envía solo cuando vuelve la conexión, con los mismos UUID (sin duplicados).
 */
export default function CheckIn() {
  const vocab = useVocab()
  const memberId = useEnvironmentStore((s) => s.memberId)
  const catalog = useIndicators()

  const questions = useMemo(() => {
    const all = catalog.state === 'ready' ? catalog.data : []
    return CHECKIN_INDICATORS.flatMap((id) => all.filter((i) => i.id === id))
  }, [catalog])

  const [answers, setAnswers] = useState<Answers>({})
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'editing' })

  const title = <h1 className="text-2xl font-semibold">R U OK?</h1>

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

  if (catalog.state === 'loading') {
    return (
      <section className="mx-auto max-w-xl space-y-4">
        {title}
        <div className="h-64 animate-pulse rounded-xl bg-env-surface" aria-busy="true" />
      </section>
    )
  }

  if (catalog.state === 'error') {
    return (
      <section className="mx-auto max-w-xl space-y-4">
        {title}
        <p className="rounded-lg border border-env-border bg-env-surface p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          No se pudo cargar el check-in. Comprueba la conexión con el servidor.
        </p>
      </section>
    )
  }

  const ids = questions.map((q) => q.id)
  const done = answeredCount(answers, ids)
  const complete = done === ids.length && ids.length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complete) {
      setPhase({ kind: 'failed', message: 'Responde a todas las preguntas.' })
      return
    }
    const batch = buildCheckinBatch(answers, ids, note, serverNow().toISOString(), newId)

    setPhase({ kind: 'sending' })
    try {
      // Se guarda en el dispositivo y se intenta enviar; sin red queda pendiente (no se pierde).
      const r = await sendMeasurements(memberId, batch)
      setPhase(r.status === 'sent' ? { kind: 'sent', result: r.result } : { kind: 'queued' })
    } catch (err) {
      // Solo si falla el propio guardado local (IndexedDB no disponible).
      setPhase({
        kind: 'failed',
        message: `No se ha podido guardar en el dispositivo: ${String(err)}`,
      })
    }
  }

  const links = (
    <div className="flex flex-wrap gap-2">
      <Link to="/dashboard" className={btnPrimary}>
        Ver el panel
      </Link>
      <Link to="/history?indicator=mood" className={btnSecondary}>
        Ver el historial
      </Link>
    </div>
  )

  if (phase.kind === 'queued') {
    return (
      <section className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Check-in guardado en el dispositivo</h1>
        <div className="rounded-xl border border-env-border bg-env-surface p-4" role="status">
          <p>
            <span aria-hidden>⇡ </span>
            No hay conexión con el servidor. Tus respuestas están guardadas aquí y{' '}
            <strong>se enviarán solas</strong> cuando vuelva la conexión, sin duplicarse.
          </p>
          <p className="mt-2 text-sm text-env-muted">
            Verás los pendientes en la cabecera. Hasta entonces, el panel y el historial pueden no
            reflejarlas.
          </p>
        </div>
        {links}
      </section>
    )
  }

  if (phase.kind === 'sent') {
    const { assessment } = phase.result
    return (
      <section className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Check-in guardado</h1>
        <div className="rounded-xl border border-env-border bg-env-surface p-4" role="status">
          <p>Gracias. Tus respuestas de hoy ya están registradas.</p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-env-muted">
            Evaluación actualizada:
            <StatusBadge
              status={assessment.overall_status}
              label={`Estado general: ${statusStyle(assessment.overall_status).label}`}
              size="sm"
            />
          </p>
        </div>
        {links}
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4" noValidate>
      <div>
        {title}
        <p className="text-env-muted">¿Cómo estás hoy? {ids.length} preguntas rápidas.</p>
      </div>

      <fieldset disabled={phase.kind === 'sending'} className="space-y-3">
        <legend className="sr-only">Check-in diario</legend>
        {questions.map((q) => (
          <FaceScale
            key={q.id}
            indicator={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers((s) => ({ ...s, [q.id]: v }))}
          />
        ))}

        <label className="block text-sm">
          <span className="text-env-muted">¿Algo más? (opcional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-env-border bg-env-surface px-3 py-2 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
          />
        </label>
      </fieldset>

      <p className="text-xs text-env-muted">
        Tus respuestas son privadas: fuera de tu perfil solo se ve un semáforo agregado, salvo que
        decidas compartirlas o haya una emergencia.
      </p>

      {phase.kind === 'failed' && (
        <p className="rounded-lg border border-env-border bg-env-surface p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          {phase.message}
        </p>
      )}

      <button
        type="submit"
        disabled={phase.kind === 'sending' || !complete}
        className="w-full rounded-lg bg-env-primary px-4 py-3 font-medium text-env-primary-text disabled:opacity-60"
      >
        {phase.kind === 'sending'
          ? 'Guardando…'
          : complete
            ? 'Enviar check-in'
            : `Responde ${done} / ${ids.length}`}
      </button>
    </form>
  )
}
