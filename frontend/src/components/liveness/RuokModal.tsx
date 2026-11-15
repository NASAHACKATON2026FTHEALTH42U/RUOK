import { useEffect, useRef, useState } from 'react'
import { NetworkError } from '../../api/client'
import { useT } from '../../i18n/t'
import { answerRuok } from '../../offline/outbox'
import { Modal } from '../ui/Modal'

type Phase =
  | { kind: 'ask' }
  | { kind: 'sending'; ok: boolean }
  | { kind: 'help-sent' }
  | { kind: 'error'; ok: boolean; message: string }

interface RuokModalProps {
  memberId: number
  /** Se respondió (o se cerró tras pedir ayuda): ocultar el modal. */
  onAnswered: () => void
  /** Sin conexión: enviar ya la alerta de ayuda (SOS sin cuenta atrás), que va al outbox. */
  onSendSos: () => void
  /** Tras pedir ayuda: abrir "Enviar aviso a control" para contar qué pasa. */
  onAddDetails: () => void
}

/**
 * Check-in "R U OK?" a pantalla completa (FE-15, docs/offline-and-liveness.md §2). Aparece cuando
 * el heartbeat devuelve `checkin_required` y bloquea la interfaz hasta que se responde (Escape
 * no lo cierra).
 * - "Estoy bien" → `POST /ruok {ok: true}`.
 * - "Necesito ayuda" → `POST /ruok {ok: false}`: según el contrato, el servidor crea la alerta.
 *   Después se ofrece "Añadir detalles" (el aviso a control). Sin conexión, se envía el SOS al
 *   momento (sin cuenta atrás: ya se ha pedido ayuda), que queda guardado en el outbox.
 */
export function RuokModal({ memberId, onAnswered, onSendSos, onAddDetails }: RuokModalProps) {
  const t = useT()
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' })
  const detailsRef = useRef<HTMLButtonElement>(null)

  // Al pedir ayuda desaparecen los botones de la pregunta: el foco pasa al primero de los nuevos.
  useEffect(() => {
    if (phase.kind === 'help-sent') detailsRef.current?.focus()
  }, [phase.kind])

  const answer = async (ok: boolean) => {
    setPhase({ kind: 'sending', ok })
    try {
      await answerRuok(memberId, ok)
      if (ok) onAnswered()
      else setPhase({ kind: 'help-sent' })
    } catch (err) {
      if (!ok && err instanceof NetworkError) {
        // Sin conexión: el SOS se guarda en el outbox y muestra el protocolo autónomo.
        onAnswered()
        onSendSos()
        return
      }
      setPhase({
        kind: 'error',
        ok,
        message:
          err instanceof NetworkError
            ? t('Sin conexión con el servidor. Vuelve a intentarlo.')
            : t('No se ha podido enviar: {error}', { error: String(err) }),
      })
    }
  }

  const sending = phase.kind === 'sending'

  return (
    <Modal role="alertdialog" labelledBy="ruok-title" describedBy="ruok-desc">
      <div className="flex min-h-full flex-col items-center justify-center gap-8 bg-env-bg p-6 text-center text-env-text">
        {phase.kind === 'help-sent' ? (
          <>
            <div>
              <h2 id="ruok-title" className="text-4xl font-bold">
                {t('Ayuda pedida')}
              </h2>
              <p id="ruok-desc" className="mt-3 text-lg text-env-muted">
                {t('Se ha creado una alerta y se está avisando. Si puedes, cuenta qué pasa.')}
              </p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-3">
              <button
                ref={detailsRef}
                type="button"
                onClick={() => {
                  onAnswered()
                  onAddDetails()
                }}
                className=" bg-[var(--sos-bg)] hover:bg-[var(--sos-bg-strong)] px-6 py-4 text-lg font-semibold text-[var(--sos-text)]"
              >
                {t('Añadir detalles')}
              </button>
              <button
                type="button"
                onClick={onAnswered}
                className=" border border-env-border px-6 py-3"
              >
                {t('Cerrar')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 id="ruok-title" className="text-6xl font-bold tracking-tight">
                R U OK<span className="text-env-primary">?</span>
              </h2>
              <p id="ruok-desc" className="mt-4 text-lg text-env-muted">
                {t('Hace un rato que no recibimos señal tuya. ¿Estás bien?')}
              </p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-3">
              <button
                data-autofocus
                type="button"
                disabled={sending}
                onClick={() => void answer(true)}
                className=" bg-env-primary px-6 py-5 text-xl font-semibold text-env-primary-text disabled:opacity-60"
              >
                {sending && phase.ok ? t('Enviando…') : t('Estoy bien')}
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void answer(false)}
                className=" bg-[var(--sos-bg)] hover:bg-[var(--sos-bg-strong)] px-6 py-5 text-xl font-semibold text-white disabled:opacity-60"
              >
                {sending && !phase.ok ? t('Enviando…') : t('Necesito ayuda')}
              </button>
            </div>
            {phase.kind === 'error' && (
              <p className="max-w-sm text-sm" role="alert">
                <span aria-hidden>⚠ </span>
                {phase.message}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
