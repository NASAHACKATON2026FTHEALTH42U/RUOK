import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { serverNow } from '../api/client'
import { useActiveMemberId } from '../auth/useAuth'
import { newId } from '../api/newId'
import { useIndicators } from '../api/useIndicators'
import { useInterventions } from '../api/useInterventions'
import {
  answeredCount,
  buildCheckinBatch,
  CHECKIN_INDICATORS,
  type Answers,
} from '../components/behavioral/checkin'
import { FaceScale } from '../components/behavioral/FaceScale'
import { InterventionCard } from '../components/behavioral/InterventionCard'
import { statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { sendMeasurements, type MeasurementBatchResult } from '../offline/outbox'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'

type Phase =
  | { kind: 'editing' }
  | { kind: 'sending' }
  | { kind: 'sent'; result: MeasurementBatchResult }
  | { kind: 'queued' }
  | { kind: 'failed'; message: string }

const btnPrimary = 'rounded-lg bg-env-primary px-4 py-2 font-medium text-env-primary-text'
const btnSecondary = 'rounded-lg border border-env-border px-4 py-2 hover:border-env-text'
/** Pausa tras elegir una respuesta antes de pasar a la siguiente (se ve la opción marcada). */
const ADVANCE_MS = 350

/**
 * Check-in diario conductual "R U OK?" (FE-19). Seis escalas 1–5 con caras (ánimo, estrés,
 * energía, soledad, calidad del sueño y relación con el equipo) y una nota opcional.
 * **Una pregunta por pantalla** (docs/design/hud-style.md §6) con progreso segmentado arriba:
 * al elegir una respuesta pasa sola a la siguiente; el último paso es la nota, el resumen y el
 * envío. Así cabe en el móvil sin scroll y se hace en menos de 30 s. Se envía como UN lote de mediciones con
 * `source: "checkin"` por el outbox (FE-11): sin red queda guardado en el dispositivo y se
 * envía solo cuando vuelve la conexión, con los mismos UUID (sin duplicados).
 */
export default function CheckIn() {
  const memberId = useActiveMemberId() // un member: siempre el suyo; el resto: el elegido
  const catalog = useIndicators()
  const interventions = useInterventions()

  const questions = useMemo(() => {
    const all = catalog.state === 'ready' ? catalog.data : []
    return CHECKIN_INDICATORS.flatMap((id) => all.filter((i) => i.id === id))
  }, [catalog])

  const [answers, setAnswers] = useState<Answers>({})
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'editing' })
  // Resultado: la lista «Para cuidarte hoy» empieza plegada.
  const [careOpen, setCareOpen] = useState(false)
  // Paso actual: 0…n-1 las preguntas; n, la nota y el envío.
  const [step, setStep] = useState(0)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const advanceTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(advanceTimer.current), [])
  // Al cambiar de paso, el foco va al título (el lector de pantalla anuncia la nueva pregunta).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    stepHeading.current?.focus()
  }, [step])

  const title = <h1 className="text-2xl font-semibold">R U OK?</h1>

  if (memberId === null) {
    return (
      <section>
        {title}
        <NoMemberSelected />
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

  // Intervenciones del sistema neuro-conductual (FE-20): también sin conexión (catálogo en caché).
  const care = (interventions.state === 'ready' ? interventions.data : []).filter(
    (i) => i.system_id === 'neuro_behavioral',
  )
  // Plegado por defecto, para que el resultado quepa en la pantalla; al abrirlo, la lista va en
  // tarjetas compactas (sin los pasos: se ven al empezar) y con scroll propio.
  const careSection = care.length > 0 && (
    <section>
      <button
        type="button"
        aria-expanded={careOpen}
        aria-controls="checkin-care"
        onClick={() => setCareOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-env-border bg-env-surface px-3 py-2 text-left font-semibold hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary"
      >
        <span>
          Para cuidarte hoy <span className="font-normal text-env-muted">({care.length})</span>
        </span>
        <span aria-hidden>{careOpen ? '▾' : '▸'}</span>
      </button>
      {careOpen && (
        <ul
          id="checkin-care"
          className="mt-2 grid max-h-[max(7rem,calc(100dvh-33rem))] gap-2 overflow-y-auto pr-1 [scrollbar-color:var(--env-border)_transparent] sm:grid-cols-2"
        >
          {care.map((i) => (
            <li key={i.id}>
              <InterventionCard intervention={i} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  )

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
      <section className="mx-auto my-auto w-full max-w-xl space-y-3 lg:max-w-3xl">
        <h1 className="text-2xl font-semibold">Check-in guardado en el dispositivo</h1>
        <div className="rounded-xl border border-env-border bg-env-surface p-3" role="status">
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
        {careSection}
        {links}
      </section>
    )
  }

  if (phase.kind === 'sent') {
    const { assessment } = phase.result
    return (
      <section className="mx-auto my-auto w-full max-w-xl space-y-3 lg:max-w-3xl">
        <h1 className="text-2xl font-semibold">Check-in guardado</h1>
        <div className="rounded-xl border border-env-border bg-env-surface p-3" role="status">
          <p>Gracias. Tus respuestas de hoy ya están registradas.</p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-env-muted">
            Evaluación actualizada:
            <StatusBadge
              status={assessment.overall_status}
              label={`Estado general: ${statusStyle(assessment.overall_status).label}`}
              size="sm"
            />
          </p>
        </div>
        {careSection}
        {links}
      </section>
    )
  }

  const total = ids.length
  const current = Math.min(step, total)
  const isReview = current === total
  const question = isReview ? undefined : questions[current]
  const goTo = (n: number) => {
    window.clearTimeout(advanceTimer.current)
    if (phase.kind === 'failed') setPhase({ kind: 'editing' })
    setStep(Math.max(0, Math.min(total, n)))
  }
  const answer = (id: string, v: number | undefined) => {
    setAnswers((s) => ({ ...s, [id]: v }))
    window.clearTimeout(advanceTimer.current)
    // Elegir una opción pasa a la siguiente; quitarla, no.
    if (v !== undefined)
      advanceTimer.current = window.setTimeout(() => goTo(current + 1), ADVANCE_MS)
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto my-auto w-full max-w-xl space-y-4 lg:max-w-3xl lg:space-y-6"
      noValidate
    >
      <div>
        {title}
        <p className="text-env-muted">¿Cómo estás hoy? {total} preguntas rápidas.</p>
      </div>

      {/* Progreso: un segmento por pregunta más el de envío. Se puede saltar a una ya vista. */}
      <nav aria-label="Progreso del check-in">
        <ol className="flex gap-1.5">
          {[
            ...questions.map((q) => ({ id: q.id, name: q.name })),
            { id: '_send', name: 'Enviar' },
          ].map((q, i) => {
            const answered = i < total ? answers[q.id] !== undefined : complete
            const reachable = i <= current || answered || (i === total && complete)
            return (
              <li key={q.id} className="flex-1">
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={!reachable || phase.kind === 'sending'}
                  aria-current={i === current ? 'step' : undefined}
                  aria-label={`Paso ${i + 1}: ${q.name}${answered && i < total ? ` (respondida: ${answers[q.id]})` : ''}`}
                  className={`relative before:absolute before:inset-x-0 before:content-[''] before:-inset-y-[18px] block h-2 w-full rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                    i === current
                      ? 'bg-env-primary'
                      : answered
                        ? 'bg-env-primary/50'
                        : 'bg-env-border'
                  }`}
                />
              </li>
            )
          })}
        </ol>
        <p className="mt-2 text-sm text-env-muted" aria-live="polite">
          {isReview ? 'Último paso: revisar y enviar' : `Pregunta ${current + 1} de ${total}`}
        </p>
      </nav>

      <fieldset disabled={phase.kind === 'sending'} className="space-y-3">
        <legend className="sr-only">Check-in diario</legend>
        <h2 ref={stepHeading} tabIndex={-1} className="sr-only">
          {isReview ? 'Revisar y enviar' : `Pregunta ${current + 1} de ${total}: ${question?.name}`}
        </h2>

        {question && (
          <FaceScale
            key={question.id}
            indicator={question}
            value={answers[question.id]}
            onChange={(v) => answer(question.id, v)}
          />
        )}

        {isReview && (
          <>
            <ul className="divide-y divide-env-border rounded-xl border border-env-border bg-env-surface text-sm">
              {questions.map((q, i) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-env-bg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary"
                    aria-label={`${q.name}: ${answers[q.id] ?? 'sin responder'}. Cambiar`}
                  >
                    <span>{q.name}</span>
                    <span
                      className={`font-semibold tabular-nums ${answers[q.id] === undefined ? 'text-env-muted' : ''}`}
                    >
                      {answers[q.id] !== undefined ? `${answers[q.id]} / 5` : 'Sin responder'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <label className="block text-sm">
              <span className="text-env-muted">¿Algo más? (opcional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-env-border bg-env-surface px-3 py-2 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
              />
            </label>
          </>
        )}
      </fieldset>

      {isReview && (
        <p className="text-xs text-env-muted">
          Tus respuestas son privadas: fuera de tu perfil solo se ve un semáforo agregado, salvo que
          decidas compartirlas o haya una emergencia.
        </p>
      )}

      {phase.kind === 'failed' && (
        <p className="rounded-lg border border-env-border bg-env-surface p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          {phase.message}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => goTo(current - 1)}
          disabled={current === 0 || phase.kind === 'sending'}
          className={`${btnSecondary} py-3 disabled:opacity-40`}
        >
          ← Anterior
        </button>
        {isReview ? (
          <button
            type="submit"
            disabled={phase.kind === 'sending' || !complete}
            className="flex-1 rounded-lg bg-env-primary px-4 py-3 font-medium text-env-primary-text disabled:opacity-60"
          >
            {phase.kind === 'sending'
              ? 'Guardando…'
              : complete
                ? 'Enviar check-in'
                : `Responde ${done} / ${total}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={question !== undefined && answers[question.id] === undefined}
            className="flex-1 rounded-lg bg-env-primary px-4 py-3 font-medium text-env-primary-text disabled:opacity-60"
          >
            Siguiente →
          </button>
        )}
      </div>
    </form>
  )
}
