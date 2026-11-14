import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { newId } from '../../api/newId'
import type { Assessment } from '../../api/useAssessment'
import type { Environment } from '../../api/useEnvironments'
import type { Intervention } from '../../api/useInterventions'
import { loadCachedAssessment } from '../../offline/cache'
import { sendAlert, type AlertResult } from '../../offline/outbox'
import type { Vocabulary } from '../../store/environment'
import {
  CATEGORIES,
  defaultSeverity,
  defaultTarget,
  interventionSystemsFor,
  protocolAppliesTo,
  roleLabel,
  SEVERITIES,
  targets,
  type AlertCategory,
  type AlertSeverity,
} from './sos'

type Phase =
  | { kind: 'form' }
  | { kind: 'sending' }
  | { kind: 'sent'; alert: AlertResult }
  | { kind: 'queued' }
  | { kind: 'error'; message: string }

interface SosDialogProps {
  memberId: number | null
  env: Environment | undefined
  vocabulary: Vocabulary
  interventions: Intervention[]
  onClose: () => void
}

/**
 * Diálogo "Pedir ayuda" (FE-13): categoría (incluida "Necesito hablar"), severidad, destino
 * (se pueden saltar niveles) y mensaje. Se envía por el outbox: sin conexión queda guardado
 * y se muestra "No enviado. Avisa de viva voz" con el protocolo que haya en el dispositivo.
 */
export function SosDialog({ memberId, env, vocabulary, interventions, onClose }: SosDialogProps) {
  const ladder = env?.escalation_ladder ?? ['self', 'crew', 'ground']
  const [category, setCategory] = useState<AlertCategory | null>(null)
  const [severity, setSeverity] = useState<AlertSeverity>('warning')
  const [target, setTarget] = useState<string | null>(defaultTarget(ladder))
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || memberId === null) return
    setPhase({ kind: 'sending' })
    try {
      const r = await sendAlert(memberId, {
        id: newId(),
        category,
        severity,
        message: message.trim() || CATEGORIES.find((c) => c.id === category)!.label,
        system_id: null,
        target_role: target,
      })
      setPhase(r.status === 'sent' ? { kind: 'sent', alert: r.result } : { kind: 'queued' })
    } catch (err) {
      setPhase({
        kind: 'error',
        message: `No se ha podido guardar en el dispositivo: ${String(err)}`,
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sos-title"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-env-border bg-env-bg p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="sos-title" className="text-xl font-semibold">
            {phase.kind === 'queued' ? 'No enviado' : 'Pedir ayuda'}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md px-2 py-1 text-env-muted hover:bg-env-surface hover:text-env-text"
          >
            ✕
          </button>
        </div>

        {memberId === null ? (
          <p className="mt-3">
            Primero{' '}
            <Link to="/" onClick={onClose} className="underline">
              elige entorno y {vocabulary.member}
            </Link>
            . Si es una emergencia, avisa ya de viva voz a {roleLabel('crew', vocabulary)}.
          </p>
        ) : phase.kind === 'sent' ? (
          <Sent alert={phase.alert} vocabulary={vocabulary} onClose={onClose} />
        ) : phase.kind === 'queued' ? (
          <Queued
            memberId={memberId}
            category={category!}
            vocabulary={vocabulary}
            interventions={interventions}
            onClose={onClose}
          />
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-5">
            <fieldset>
              <legend className="text-sm font-medium">¿Qué pasa?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={category === c.id}
                    onClick={() => {
                      setCategory(c.id)
                      setSeverity(defaultSeverity(c.id))
                    }}
                    className={`rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                      category === c.id
                        ? 'border-env-text bg-env-surface'
                        : 'border-env-border hover:border-env-text'
                    }`}
                  >
                    <span className="block font-medium">{c.label}</span>
                    <span className="block text-xs text-env-muted">{c.hint}</span>
                  </button>
                ))}
              </div>
              {category === 'psychological' && (
                <p className="mt-2 text-sm text-env-muted">
                  🔒 Confidencial: solo lo verá{' '}
                  {vocabulary.psych ?? 'el equipo de apoyo psicológico'}.
                </p>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">¿Cuánto urge?</legend>
              <div className="mt-2 flex gap-2" role="radiogroup">
                {SEVERITIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={severity === s.id}
                    onClick={() => setSeverity(s.id)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                      severity === s.id
                        ? 'border-env-text bg-env-surface font-medium'
                        : 'border-env-border hover:border-env-text'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm">
              <span className="font-medium">¿A quién avisar?</span>
              <select
                value={target ?? ''}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1 w-full rounded-md border border-env-border bg-env-surface px-3 py-2 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
              >
                {targets(ladder).map((r, i) => (
                  <option key={r} value={r}>
                    {roleLabel(r, vocabulary)}
                    {i === 0 ? ' (siguiente nivel)' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium">Mensaje (opcional)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-md border border-env-border bg-env-surface px-3 py-2 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
              />
            </label>

            {phase.kind === 'error' && (
              <p role="alert" className="text-sm">
                ⚠ {phase.message}
              </p>
            )}

            <button
              type="submit"
              disabled={!category || phase.kind === 'sending'}
              className="w-full rounded-lg bg-[#d03b3b] px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {phase.kind === 'sending' ? 'Enviando…' : 'Enviar petición de ayuda'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/** Hora local "14:05" de una fecha ISO. */
function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function Sent({
  alert,
  vocabulary,
  onClose,
}: {
  alert: AlertResult
  vocabulary: Vocabulary
  onClose: () => void
}) {
  const to = roleLabel(alert.target_role, vocabulary)
  const minutes = Math.max(1, Math.round(alert.delay_s / 60))
  return (
    <div className="mt-4 space-y-3" role="status">
      <p className="text-lg">
        ✓ Enviado a <strong>{to}</strong>.
      </p>
      {alert.delivery_mode === 'realtime' || alert.delay_s < 5 ? (
        <p className="text-env-muted">Le llega al momento.</p>
      ) : (
        <p className="text-env-muted">
          Por el retardo de comunicación, le llegará en unos <strong>{minutes} min</strong>
          {alert.eta ? ` (hacia las ${hhmm(alert.eta)}, hora del servidor)` : ''}. Mientras tanto,
          sigue las indicaciones de tu panel.
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-lg bg-env-primary px-4 py-2.5 font-medium text-env-primary-text"
      >
        Entendido
      </button>
    </div>
  )
}

/**
 * Sin conexión con el servidor de a bordo: la alerta está en el outbox y se enviará sola.
 * Protocolo autónomo con lo que hay en el dispositivo: los mensajes de escalado de la última
 * evaluación guardada y las intervenciones offline (no hay textos clínicos en el código).
 */
function Queued({
  memberId,
  category,
  vocabulary,
  interventions,
  onClose,
}: {
  memberId: number
  category: AlertCategory
  vocabulary: Vocabulary
  interventions: Intervention[]
  onClose: () => void
}) {
  const [steps, setSteps] = useState<string[]>([])
  useEffect(() => {
    void loadCachedAssessment<Assessment>(memberId).then((a) => {
      if (!a) return
      const msgs = a.systems
        .filter(
          (s) =>
            s.status !== 'normal' &&
            s.escalation?.message &&
            protocolAppliesTo(category, s.system_id),
        )
        // Primero los protocolos autónomos (no esperan respuesta del exterior).
        .sort(
          (x, y) =>
            Number(y.escalation.mode === 'autonomous') - Number(x.escalation.mode === 'autonomous'),
        )
        .map((s) => s.escalation.message)
      setSteps([...new Set(msgs)])
    })
  }, [memberId, category])
  const systems = interventionSystemsFor(category)
  const offline = interventions.filter((i) => i.offline && systems.includes(i.system_id ?? ''))

  return (
    <div className="mt-3 space-y-4">
      <div role="alert" className="rounded-lg border-2 border-[#d03b3b] p-3">
        <p className="text-lg font-semibold">
          No enviado. Avisa a {roleLabel('crew', vocabulary)} de viva voz.
        </p>
        <p className="mt-1 text-sm text-env-muted">
          No hay conexión con el servidor de a bordo. La petición está guardada en este dispositivo
          y se enviará sola en cuanto vuelva la conexión.
        </p>
      </div>

      {(steps.length > 0 || offline.length > 0) && (
        <section>
          <h3 className="font-semibold">Mientras tanto</h3>
          {steps.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {offline.map((i) => (
            <div key={i.id} className="mt-3 rounded-lg border border-env-border bg-env-surface p-3">
              <p className="font-medium">
                {i.title} <span className="text-sm text-env-muted">· {i.duration_min} min</span>
              </p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm">
                {i.steps.map((s, n) => (
                  <li key={n}>{s}</li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-lg border border-env-border px-4 py-2.5 font-medium hover:border-env-text"
      >
        Cerrar
      </button>
    </div>
  )
}
