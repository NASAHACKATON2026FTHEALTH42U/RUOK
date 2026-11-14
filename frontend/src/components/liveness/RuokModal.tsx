import { useEffect, useRef, useState } from 'react'
import { NetworkError } from '../../api/client'
import { answerRuok } from '../../offline/outbox'

type Phase =
  | { kind: 'ask' }
  | { kind: 'sending'; ok: boolean }
  | { kind: 'help-sent' }
  | { kind: 'error'; ok: boolean; message: string }

interface RuokModalProps {
  memberId: number
  /** Se respondió (o se cerró tras pedir ayuda): ocultar el modal. */
  onAnswered: () => void
  /** Abrir el diálogo "Pedir ayuda" (FE-13), que se encola aunque no haya conexión. */
  onOpenSos: () => void
}

/**
 * Check-in "R U OK?" a pantalla completa (FE-15, docs/offline-and-liveness.md §2). Aparece cuando
 * el heartbeat devuelve `checkin_required`.
 * - "Estoy bien" → `POST /ruok {ok: true}`.
 * - "Necesito ayuda" → `POST /ruok {ok: false}`: según el contrato, el servidor crea la alerta.
 *   Después se ofrece abrir "Pedir ayuda" para añadir detalles. Si no hay conexión, se abre
 *   directamente "Pedir ayuda", que guarda la petición en el outbox.
 */
export function RuokModal({ memberId, onAnswered, onOpenSos }: RuokModalProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' })
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    okRef.current?.focus()
  }, [])

  const answer = async (ok: boolean) => {
    setPhase({ kind: 'sending', ok })
    try {
      await answerRuok(memberId, ok)
      if (ok) onAnswered()
      else setPhase({ kind: 'help-sent' })
    } catch (err) {
      if (!ok && err instanceof NetworkError) {
        // Sin conexión: "Pedir ayuda" la guarda en el outbox y muestra el protocolo autónomo.
        onAnswered()
        onOpenSos()
        return
      }
      setPhase({
        kind: 'error',
        ok,
        message:
          err instanceof NetworkError
            ? 'Sin conexión con el servidor. Vuelve a intentarlo.'
            : `No se ha podido enviar: ${String(err)}`,
      })
    }
  }

  const sending = phase.kind === 'sending'

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ruok-title"
      aria-describedby="ruok-desc"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-env-bg p-6 text-center text-env-text"
    >
      {phase.kind === 'help-sent' ? (
        <>
          <div>
            <h2 id="ruok-title" className="text-4xl font-bold">
              Ayuda pedida
            </h2>
            <p id="ruok-desc" className="mt-3 text-lg text-env-muted">
              Se ha creado una alerta y se está avisando. Si puedes, cuenta qué pasa.
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                onAnswered()
                onOpenSos()
              }}
              className="rounded-xl bg-[#d03b3b] px-6 py-4 text-lg font-semibold text-white"
            >
              Añadir detalles
            </button>
            <button
              type="button"
              onClick={onAnswered}
              className="rounded-xl border border-env-border px-6 py-3"
            >
              Cerrar
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
              Hace un rato que no recibimos señal tuya. ¿Estás bien?
            </p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <button
              ref={okRef}
              type="button"
              disabled={sending}
              onClick={() => void answer(true)}
              className="rounded-xl bg-env-primary px-6 py-5 text-xl font-semibold text-env-primary-text disabled:opacity-60"
            >
              {sending && phase.ok ? 'Enviando…' : 'Estoy bien'}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => void answer(false)}
              className="rounded-xl bg-[#d03b3b] px-6 py-5 text-xl font-semibold text-white disabled:opacity-60"
            >
              {sending && !phase.ok ? 'Enviando…' : 'Necesito ayuda'}
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
  )
}
