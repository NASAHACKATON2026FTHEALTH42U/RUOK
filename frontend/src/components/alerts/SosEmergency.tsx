import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { newId } from '../../api/newId'
import type { Environment } from '../../api/useEnvironments'
import type { Intervention } from '../../api/useInterventions'
import { sendAlert, type AlertResult } from '../../offline/outbox'
import type { Vocabulary } from '../../store/environment'
import { Modal } from '../ui/Modal'
import { defaultTarget, roleLabel } from './sos'
import { Queued, Sent } from './SosDialog'

/**
 * Resultado (enviado o sin conexión) en móvil: centrado y más grande, como la cuenta atrás. Los
 * componentes Sent y Queued se comparten con el aviso a control, así que se ajustan desde aquí.
 */
const RESULT =
  'max-sm:text-center max-sm:[&_p]:text-lg max-sm:[&_.text-lg]:text-2xl max-sm:[&_button]:min-h-14 max-sm:[&_button]:text-lg max-sm:[&_ul]:text-left max-sm:[&_ol]:text-left'

/** Segundos para cancelar un SOS pulsado sin querer. */
export const SOS_COUNTDOWN_S = 3

type Phase =
  | { kind: 'countdown' }
  | { kind: 'sending' }
  | { kind: 'sent'; alert: AlertResult }
  | { kind: 'queued' }
  | { kind: 'error'; message: string }

interface SosEmergencyProps {
  memberId: number | null
  /** Sin sesión: el servidor acepta las emergencias sin token (docs/auth-and-roles.md). */
  anonymous?: boolean
  env: Environment | undefined
  vocabulary: Vocabulary
  interventions: Intervention[]
  /** Segundos de cuenta atrás; 0 = se envía al abrir (p. ej. «Necesito ayuda» sin conexión). */
  delayS?: number
  onClose: () => void
}

/**
 * SOS (FE-13): sin formulario. Avisa de que se enviará la alerta de ayuda si no se cancela en
 * 3 s; después la envía sola por el outbox (emergencia, al siguiente nivel de la escalera) y
 * muestra a quién ha llegado o, sin conexión, "No enviado. Avisa de viva voz" con el protocolo
 * autónomo. Es un modal bloqueante: hasta que se cancela o se cierra, no se puede usar nada más.
 * Los avisos con detalle (categoría, urgencia, destino) van en "Enviar aviso a control".
 */
export function SosEmergency({
  memberId,
  anonymous = false,
  env,
  vocabulary,
  interventions,
  delayS = SOS_COUNTDOWN_S,
  onClose,
}: SosEmergencyProps) {
  const [phase, setPhase] = useState<Phase>(
    delayS > 0 ? { kind: 'countdown' } : { kind: 'sending' },
  )
  const [left, setLeft] = useState(delayS)
  const reduceMotion = useReducedMotion()
  // Un UUID por pulsación: si el envío se repite, el servidor no la duplica.
  const alertId = useRef(newId())
  const fired = useRef(false)
  const ladder = env?.escalation_ladder ?? ['self', 'crew', 'ground']

  // Lo último de cada render, para que la cuenta atrás no se reinicie cuando cambian las props.
  const fireRef = useRef<() => Promise<void>>(async () => {})
  fireRef.current = async () => {
    if (fired.current || memberId === null) return
    fired.current = true
    setPhase({ kind: 'sending' })
    try {
      const r = await sendAlert(memberId, {
        id: alertId.current,
        category: 'emergency',
        severity: 'emergency',
        message: 'SOS',
        system_id: null,
        target_role: defaultTarget(ladder),
      })
      setPhase(r.status === 'sent' ? { kind: 'sent', alert: r.result } : { kind: 'queued' })
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Cuenta atrás con el reloj del dispositivo (es una espera local, no depende del servidor).
  useEffect(() => {
    if (memberId === null) return
    if (delayS <= 0) {
      void fireRef.current()
      return
    }
    const start = Date.now()
    const timer = window.setInterval(() => {
      const remaining = delayS - (Date.now() - start) / 1000
      if (remaining <= 0) {
        window.clearInterval(timer)
        void fireRef.current()
      } else {
        setLeft(Math.ceil(remaining))
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [delayS, memberId])

  const title =
    phase.kind === 'sent'
      ? 'Alerta de ayuda enviada'
      : phase.kind === 'queued'
        ? 'No enviado'
        : 'SOS'
  // Mientras cuenta, Escape cancela; enviando, no se puede cerrar; después, cierra.
  const closable = phase.kind !== 'sending'

  return (
    <Modal
      role="alertdialog"
      labelledBy="sos-title"
      describedBy="sos-desc"
      onClose={closable ? onClose : undefined}
    >
      {/* Móvil: casi toda la pantalla (cuenta atrás enorme y botones grandes abajo, al alcance del
          pulgar). Desde 640 px, una tarjeta centrada. */}
      <div className="flex min-h-full items-stretch justify-center p-3 sm:items-center sm:p-6">
        <div
          data-autofocus
          tabIndex={-1}
          // Tras enviar (o sin conexión), en móvil el mensaje va centrado en la pantalla.
          className={`flex w-full max-w-md flex-col rounded-2xl border-2 border-st-crit bg-env-bg p-5 shadow-2xl outline-none max-sm:min-h-[calc(100dvh-1.5rem)] sm:p-6 ${
            phase.kind === 'countdown' || phase.kind === 'sending'
              ? ''
              : 'max-sm:justify-center-safe'
          }`}
        >
          <h2
            id="sos-title"
            className={
              phase.kind === 'countdown' || phase.kind === 'sending'
                ? 'text-center font-mono text-sm tracking-[0.3em] text-env-muted uppercase max-sm:text-base'
                : 'text-xl font-semibold max-sm:text-center max-sm:text-3xl'
            }
          >
            {title}
          </h2>

          {memberId === null ? (
            <div id="sos-desc" className="mt-3 space-y-4">
              <p>
                {anonymous ? (
                  'Este dispositivo no sabe quién eres: inicia sesión para pedir ayuda desde aquí'
                ) : (
                  <>
                    Primero{' '}
                    <Link to="/" onClick={onClose} className="underline">
                      elige entorno y {vocabulary.member}
                    </Link>
                  </>
                )}
                . Si es una emergencia, avisa ya de viva voz a {roleLabel('crew', vocabulary)}.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-env-border px-4 py-3 font-medium hover:border-env-text"
              >
                Cerrar
              </button>
            </div>
          ) : phase.kind === 'countdown' ? (
            <div className="mt-2 flex flex-1 flex-col text-center">
              <div className="flex flex-1 flex-col items-center justify-center">
                <p id="sos-desc" className="text-lg max-sm:text-2xl">
                  Se enviará la alerta de ayuda en
                </p>
                <p
                  aria-hidden
                  className="mt-1 font-mono text-8xl leading-none font-light tabular-nums text-st-crit max-sm:mt-4 max-sm:text-[10rem]"
                >
                  {left}
                </p>
              </div>
              <p className="sr-only" aria-live="assertive">
                Se enviará la alerta de ayuda en {delayS} segundos si no la cancelas.
              </p>
              {/* Barra que se vacía en los 3 s (sin animación con «reducir movimiento»). */}
              <div
                aria-hidden
                className="mt-4 h-1.5 overflow-hidden rounded-full bg-env-surface max-sm:mt-6 max-sm:h-2"
              >
                <div
                  className="h-full bg-st-crit"
                  style={
                    reduceMotion
                      ? { width: `${(left / delayS) * 100}%` }
                      : { animation: `sos-countdown ${delayS}s linear forwards` }
                  }
                />
              </div>
              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-14 rounded-xl border-2 border-env-text px-4 text-lg font-semibold hover:bg-env-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary max-sm:min-h-18 max-sm:text-2xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void fireRef.current()}
                  className="min-h-12 rounded-xl bg-[var(--sos-bg)] px-4 font-semibold text-[var(--sos-text)] hover:bg-[var(--sos-bg-strong)] active:bg-[var(--sos-bg-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-text max-sm:min-h-16 max-sm:text-xl"
                >
                  Enviar ya
                </button>
              </div>
            </div>
          ) : phase.kind === 'sending' ? (
            <p
              id="sos-desc"
              role="status"
              className="mt-4 text-center text-lg max-sm:flex max-sm:flex-1 max-sm:items-center max-sm:justify-center max-sm:text-2xl"
            >
              Enviando la alerta de ayuda…
            </p>
          ) : phase.kind === 'sent' ? (
            <div id="sos-desc" className={RESULT}>
              <Sent alert={phase.alert} vocabulary={vocabulary} onClose={onClose} />
            </div>
          ) : phase.kind === 'queued' ? (
            <div id="sos-desc" className={RESULT}>
              <Queued
                memberId={memberId}
                category="emergency"
                vocabulary={vocabulary}
                interventions={interventions}
                onClose={onClose}
              />
            </div>
          ) : (
            <div id="sos-desc" className="mt-3 space-y-4">
              <p role="alert">
                <span aria-hidden>⚠ </span>No se ha podido guardar la alerta en este dispositivo (
                {phase.message}). Avisa ya de viva voz a {roleLabel('crew', vocabulary)}.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-env-border px-4 py-3 font-medium hover:border-env-text"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
