import { STATUS_COLORS } from '../ui/status'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { newId } from '../../api/newId'
import type { Assessment } from '../../api/useAssessment'
import type { Environment } from '../../api/useEnvironments'
import type { Intervention } from '../../api/useInterventions'
import { loadCachedAssessment } from '../../offline/cache'
import { sendAlert, type AlertResult } from '../../offline/outbox'
import { translate, useT } from '../../i18n/t'
import type { Vocabulary } from '../../store/environment'
import { ListenButton } from '../behavioral/VoiceControls'
import { Modal } from '../ui/Modal'
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
import { AutoTextarea } from '../ui/AutoTextarea'
import { Icon } from '../ui/Icon'

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
 * "Enviar aviso a control" (FE-13): categoría (incluida "Necesito hablar"), severidad, destino
 * (se pueden saltar niveles) y mensaje. Se envía por el outbox: sin conexión queda guardado
 * y se muestra "No enviado. Avisa de viva voz" con el protocolo que haya en el dispositivo.
 * El SOS no pasa por aquí: avisa y envía solo, sin formulario (`SosEmergency`).
 */
export function SosDialog({ memberId, env, vocabulary, interventions, onClose }: SosDialogProps) {
  const t = useT()
  const ladder = env?.escalation_ladder ?? ['self', 'crew', 'ground']
  const [category, setCategory] = useState<AlertCategory | null>(null)
  const [severity, setSeverity] = useState<AlertSeverity>('warning')
  const [target, setTarget] = useState<string | null>(defaultTarget(ladder))
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'form' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || memberId === null) return
    setPhase({ kind: 'sending' })
    try {
      const r = await sendAlert(memberId, {
        id: newId(),
        category,
        severity,
        message: message.trim() || translate(CATEGORIES.find((c) => c.id === category)!.label),
        system_id: null,
        target_role: target,
      })
      setPhase(r.status === 'sent' ? { kind: 'sent', alert: r.result } : { kind: 'queued' })
    } catch (err) {
      setPhase({
        kind: 'error',
        message: translate('No se ha podido guardar en el dispositivo: {error}', {
          error: String(err),
        }),
      })
    }
  }

  return (
    // Bloqueante: mientras está abierto no se puede usar nada más. Mientras se envía, no se cierra.
    <Modal labelledBy="notice-title" onClose={phase.kind === 'sending' ? undefined : onClose}>
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6">
        <div className="w-full max-w-lg  border border-env-border bg-env-bg p-5 shadow-2xl ">
          <div className="flex items-start justify-between gap-3">
            <h2 id="notice-title" className="text-xl font-semibold">
              {phase.kind === 'queued' ? t('No enviado') : t('Enviar aviso a control')}
            </h2>
            <button
              data-autofocus
              type="button"
              onClick={onClose}
              disabled={phase.kind === 'sending'}
              aria-label={t('Cerrar')}
              className=" px-2 py-1 text-env-muted hover:bg-env-surface hover:text-env-text disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          {memberId === null ? (
            <p className="mt-3">
              {t('Primero')}{' '}
              <Link to="/" onClick={onClose} className="underline">
                {t('elige entorno y {member}', { member: vocabulary.member })}
              </Link>
              .{' '}
              {t('Si es una emergencia, avisa ya de viva voz a {crew}.', {
                crew: roleLabel('crew', vocabulary),
              })}
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
                <legend className="text-sm font-medium">{t('¿Qué pasa?')}</legend>
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
                      className={` border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                        category === c.id
                          ? 'border-env-text bg-env-surface'
                          : 'border-env-border hover:border-env-text'
                      }`}
                    >
                      <span className="block font-medium">{t(c.label)}</span>
                      <span className="block text-xs text-env-muted">{t(c.hint)}</span>
                    </button>
                  ))}
                </div>
                {category === 'psychological' && (
                  <p className="mt-2 text-sm text-env-muted">
                    <Icon name="lock" size={15} />{' '}
                    {t('Confidencial: solo lo verá {who}.', {
                      who: vocabulary.psych ?? t('el equipo de apoyo psicológico'),
                    })}
                  </p>
                )}
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium">{t('¿Cuánto urge?')}</legend>
                <div className="mt-2 flex gap-2" role="radiogroup">
                  {SEVERITIES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={severity === s.id}
                      onClick={() => setSeverity(s.id)}
                      className={`flex-1  border px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                        severity === s.id
                          ? 'border-env-text bg-env-surface font-medium'
                          : 'border-env-border hover:border-env-text'
                      }`}
                    >
                      {t(s.label)}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block text-sm">
                <span className="font-medium">{t('¿A quién avisar?')}</span>
                <select
                  value={target ?? ''}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-1 w-full  border border-env-border bg-env-surface px-3 py-2 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
                >
                  {targets(ladder).map((r, i) => (
                    <option key={r} value={r}>
                      {roleLabel(r, vocabulary)}
                      {i === 0 ? ` ${t('(siguiente nivel)')}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium">{t('Mensaje (opcional)')}</span>
                <AutoTextarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="mt-1 w-full  border border-env-border bg-env-surface px-3 py-2 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
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
                className="w-full bg-[var(--sos-bg)] px-4 py-3 font-semibold text-[var(--sos-text)] hover:bg-[var(--sos-bg-strong)] disabled:opacity-50"
              >
                {phase.kind === 'sending' ? t('Enviando…') : t('Enviar aviso')}
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  )
}

/** Hora local "14:05" de una fecha ISO. */
function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function Sent({
  alert,
  vocabulary,
  onClose,
}: {
  alert: AlertResult
  vocabulary: Vocabulary
  onClose: () => void
}) {
  const t = useT()
  const to = roleLabel(alert.target_role, vocabulary)
  const minutes = Math.max(1, Math.round(alert.delay_s / 60))
  return (
    <div className="mt-4 space-y-3" role="status">
      <p className="text-lg">
        ✓ {t('Enviado a')} <strong>{to}</strong>.
      </p>
      {alert.delivery_mode === 'realtime' || alert.delay_s < 5 ? (
        <p className="text-env-muted">{t('Le llega al momento.')}</p>
      ) : (
        <p className="text-env-muted">
          {t('Por el retardo de comunicación, le llegará en unos')}{' '}
          <strong>{t('{n} min', { n: minutes })}</strong>
          {alert.eta
            ? ` ${t('(hacia las {time}, hora del servidor)', { time: hhmm(alert.eta) })}`
            : ''}
          . {t('Mientras tanto, sigue las indicaciones de tu panel.')}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="w-full  bg-env-primary px-4 py-2.5 font-medium text-env-primary-text"
      >
        {t('Entendido')}
      </button>
    </div>
  )
}

/**
 * Sin conexión con el servidor de a bordo: la alerta está en el outbox y se enviará sola.
 * Protocolo autónomo con lo que hay en el dispositivo: los mensajes de escalado de la última
 * evaluación guardada y las intervenciones offline (no hay textos clínicos en el código).
 */
export function Queued({
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
  const t = useT()
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
      <div role="alert" className=" border-2 p-3" style={{ borderColor: STATUS_COLORS.critical }}>
        <p className="text-lg font-semibold">
          {t('No enviado. Avisa a {crew} de viva voz.', { crew: roleLabel('crew', vocabulary) })}
        </p>
        <p className="mt-1 text-sm text-env-muted">
          {t(
            'No hay conexión con el servidor de a bordo. La petición está guardada en este dispositivo y se enviará sola en cuanto vuelva la conexión.',
          )}
        </p>
      </div>

      {(steps.length > 0 || offline.length > 0) && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{t('Mientras tanto')}</h3>
            {/* Voz guía (FE-37): los pasos en voz alta, con las manos libres. */}
            <ListenButton texts={[...steps, ...offline.flatMap((i) => i.steps)]} />
          </div>
          {steps.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {offline.map((i) => (
            <div key={i.id} className="mt-3  border border-env-border bg-env-surface p-3">
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
        className="w-full  border border-env-border px-4 py-2.5 font-medium hover:border-env-text"
      >
        {t('Cerrar')}
      </button>
    </div>
  )
}
