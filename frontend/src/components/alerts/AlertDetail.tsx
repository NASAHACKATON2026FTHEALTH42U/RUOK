import { useEffect, useState } from 'react'
import { ApiError, NetworkError, serverNow } from '../../api/client'
import type { Alert } from '../../api/useAlerts'
import type { Assessment } from '../../api/useAssessment'
import type { Intervention } from '../../api/useInterventions'
import { useAuth } from '../../auth/useAuth'
import { formatAgo } from '../../lib/time'
import { ackAlert, escalateAlert, resolveAlert, sendAlertMessage } from '../../offline/outbox'
import type { Vocabulary } from '../../store/environment'
import { Icon } from '../ui/Icon'
import { hhmm } from '../ui/link'
import { StatusBadge } from '../ui/StatusBadge'
import {
  actorLabel,
  categoryLabel,
  countdown,
  escalationTargets,
  eventStyle,
  severityStyle,
  statusLabel,
} from './alertFormat'
import { roleLabel } from './sos'

interface AlertDetailProps {
  alert: Alert
  ladder: string[]
  vocabulary: Vocabulary
  /** Última evaluación del member: de ahí sale el protocolo autónomo del sistema. */
  assessment: Assessment | undefined
  interventions: Intervention[]
  /** Tras una acción. `resolved` = la alerta se acaba de resolver (sale de la lista de abiertas). */
  onChanged: (what?: 'resolved') => void
  /** Protocolo autónomo (para quien está a bordo). En /ground no se muestra. */
  showProtocol?: boolean
  /** Caja para responder (consola /ground). */
  allowReply?: boolean
  /** false = alerta psicológica sin permiso para ver el detalle (privacidad). */
  showDetails?: boolean
}

/** Hora del servidor que avanza cada segundo (para la cuenta atrás de la ETA). */
function useServerClock(): number {
  const [now, setNow] = useState(() => serverNow().getTime())
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow().getTime()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/**
 * Detalle de una alerta (FE-14): entrega (al momento, o cuenta atrás de la ETA si va con
 * retardo), protocolo autónomo paso a paso, línea de tiempo de AlertEvent y acciones según el
 * rol (escalar; reconocer y resolver).
 */
export function AlertDetail({
  alert,
  ladder,
  vocabulary,
  assessment,
  interventions,
  onChanged,
  showProtocol = true,
  allowReply = false,
  showDetails = true,
}: AlertDetailProps) {
  const now = useServerClock()
  const { can } = useAuth()
  const sev = severityStyle(alert.severity)
  const resolved = alert.status === 'resolved'
  const targets = escalationTargets(ladder, alert.target_role)
  const [target, setTarget] = useState(targets[0] ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [reply, setReply] = useState('')

  // Protocolo autónomo: mensaje de escalado del sistema + intervenciones offline del sistema.
  const system = assessment?.systems.find((s) => s.system_id === alert.system_id)
  const autonomous =
    alert.delivery_mode === 'autonomous' || system?.escalation.mode === 'autonomous'
  const steps = interventions.filter((i) => i.system_id === alert.system_id)

  const act = async (fn: () => Promise<unknown>, what?: 'resolved') => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged(what)
    } catch (err) {
      setError(
        err instanceof NetworkError
          ? 'Sin conexión con el servidor de a bordo: no se ha podido. Avisa de viva voz.'
          : err instanceof ApiError
            ? `El servidor lo ha rechazado: ${err.message}`
            : String(err),
      )
    } finally {
      setBusy(false)
    }
  }

  const left = alert.eta ? countdown(alert.eta, now) : null
  const actor = can('action:ack-alerts') ? 'responder' : 'member'

  return (
    // En paneles anchos, la línea de tiempo va en una columna lateral: el bloque queda más bajo y
    // se aprovecha el ancho. En estrechos (móvil), debajo.
    <article className="@container" aria-labelledby={`alert-${alert.id}`}>
      <div className="grid gap-5 @[38rem]:grid-cols-[minmax(0,1fr)_16rem] @[38rem]:gap-6">
        <div className="min-w-0 space-y-5">
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={sev.status} label={sev.label} />
              <span className="rounded-full border border-env-border px-2.5 py-1 text-sm">
                {statusLabel(alert.status)}
              </span>
              <span className="text-sm text-env-muted">
                {alert.origin === 'auto' ? 'Automática' : 'Manual'}
                {!alert.authenticated && ' · sin sesión'}
              </span>
            </div>
            <h2 id={`alert-${alert.id}`} className="text-xl font-semibold">
              {categoryLabel(alert.category)}
            </h2>
            {!showDetails ? (
              <p className="border border-env-border p-2 text-sm text-env-muted">
                <Icon name="lock" size={15} /> Alerta conductual activa. El detalle es confidencial
                (solo el canal de apoyo psicológico), salvo emergencia o si el member decide
                compartirlo.
              </p>
            ) : (
              alert.message &&
              alert.message !== categoryLabel(alert.category) && <p>{alert.message}</p>
            )}
            <p className="text-sm text-env-muted">
              Destino:{' '}
              <strong className="text-env-text">{roleLabel(alert.target_role, vocabulary)}</strong>{' '}
              (nivel {alert.level}) · creada {formatAgo(alert.created_at, new Date(now))}
            </p>
          </header>

          {/* Entrega */}
          {!resolved && (
            <section className="border border-env-border bg-env-surface p-3" aria-live="polite">
              {alert.delivered_at ? (
                <p>
                  ✓ Entregada a {roleLabel(alert.target_role, vocabulary)} a las{' '}
                  {hhmm(alert.delivered_at)}.
                </p>
              ) : alert.delivery_mode === 'realtime' || alert.delay_s < 5 ? (
                <p>Contactando con {roleLabel(alert.target_role, vocabulary)}…</p>
              ) : left ? (
                <p>
                  Llegará a {roleLabel(alert.target_role, vocabulary)} en{' '}
                  <strong className="text-2xl tabular-nums">{left}</strong>
                  {alert.eta && (
                    <span className="text-sm text-env-muted"> (ETA {hhmm(alert.eta)})</span>
                  )}
                </p>
              ) : (
                <p>
                  Debería haber llegado (ETA {alert.eta ? hhmm(alert.eta) : '—'}); pendiente de
                  confirmación del enlace.
                </p>
              )}
            </section>
          )}

          {/* Protocolo autónomo */}
          {!resolved && showProtocol && autonomous && (
            <section>
              <h3 className="font-semibold">Protocolo autónomo (mientras llega la respuesta)</h3>
              {system?.escalation.message && (
                <p className="mt-1 text-sm">{system.escalation.message}</p>
              )}
              {steps.map((i) => (
                <div key={i.id} className="mt-3 border border-env-border bg-env-surface p-3">
                  <p className="font-medium">
                    {i.title} <span className="text-sm text-env-muted">· {i.duration_min} min</span>
                  </p>
                  <ol className="mt-2 space-y-1">
                    {i.steps.map((s, n) => {
                      const key = `${i.id}:${n}`
                      return (
                        <li key={key}>
                          <label className="flex min-h-11 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={done.has(key)}
                              onChange={() =>
                                setDone((d) => {
                                  const next = new Set(d)
                                  if (next.has(key)) next.delete(key)
                                  else next.add(key)
                                  return next
                                })
                              }
                              className="mt-0.5"
                            />
                            <span className={done.has(key) ? 'text-env-muted line-through' : ''}>
                              {n + 1}. {s}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              ))}
              {!system?.escalation.message && steps.length === 0 && (
                <p className="mt-1 text-sm text-env-muted">
                  No hay pasos guardados para este sistema. Sigue las indicaciones de tu panel.
                </p>
              )}
            </section>
          )}

          {/* Acciones */}
          {!resolved && (can('action:escalate-alerts') || can('action:ack-alerts')) && (
            <section className="flex flex-wrap items-end gap-2">
              {can('action:escalate-alerts') && targets.length > 0 && (
                <>
                  <label className="text-sm">
                    <span className="block text-env-muted">Escalar a</span>
                    <select
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="mt-1 border border-env-border bg-env-surface px-2 py-1.5 text-env-text"
                    >
                      {targets.map((r, i) => (
                        <option key={r} value={r}>
                          {roleLabel(r, vocabulary)}
                          {i === 0 ? ' (siguiente nivel)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(() => escalateAlert(alert.id, target || null))}
                    className="bg-env-primary px-4 py-2 font-medium text-env-primary-text disabled:opacity-60"
                  >
                    ⇡ Escalar
                  </button>
                </>
              )}
              {can('action:ack-alerts') && alert.status !== 'acknowledged' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => ackAlert(alert.id, actor))}
                  className="min-h-11 border border-env-border px-4 py-2 hover:border-env-text disabled:opacity-60"
                >
                  Marcar como recibida
                </button>
              )}
              {can('action:ack-alerts') && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => resolveAlert(alert.id, actor), 'resolved')}
                  className="min-h-11 border border-env-border px-4 py-2 hover:border-env-text disabled:opacity-60"
                >
                  Resolver
                </button>
              )}
            </section>
          )}
          {!resolved && allowReply && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const text = reply.trim()
                if (text)
                  void act(() => sendAlertMessage(alert.id, actor, text)).then(() => setReply(''))
              }}
            >
              <label className="flex-1 text-sm">
                <span className="sr-only">Respuesta</span>
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Responder (llega a bordo con el retardo del enlace)"
                  className="w-full border border-env-border bg-env-surface px-3 py-2 text-env-text"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !reply.trim()}
                className="bg-env-primary px-4 py-2 font-medium text-env-primary-text disabled:opacity-60"
              >
                Enviar
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="text-sm">
              ⚠ {error}
            </p>
          )}

          {/* Línea de tiempo */}
        </div>
        <section className="@[38rem]:border-l @[38rem]:border-env-border/60 @[38rem]:pl-6">
          <h3 className="hud-label">Línea de tiempo</h3>
          <ol className="mt-3 ml-2.5 border-l border-env-border">
            {alert.events.map((e, i) => {
              const st = eventStyle(e.type)
              const extra =
                showDetails && typeof e.payload?.text === 'string'
                  ? `"${e.payload.text}"`
                  : typeof e.payload?.note === 'string'
                    ? e.payload.note
                    : typeof e.payload?.eta_s === 'number'
                      ? `retardo ${Math.round(e.payload.eta_s / 60)} min`
                      : typeof e.payload?.target_role === 'string'
                        ? `→ ${roleLabel(e.payload.target_role, vocabulary)}`
                        : ''
              return (
                <li key={i} className="relative pb-3 pl-5 text-sm">
                  <span
                    aria-hidden
                    className="absolute top-0 -left-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-env-border bg-env-bg text-env-muted"
                  >
                    <Icon name={st.icon} size={11} />
                  </span>
                  <span className="font-medium">{st.label}</span>
                  <span className="text-env-muted">
                    {' '}
                    · {hhmm(e.at)} · {actorLabel(e.actor)}
                    {extra && ` · ${extra}`}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </article>
  )
}
