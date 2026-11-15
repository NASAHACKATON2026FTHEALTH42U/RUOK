import { useState } from 'react'
import type { Kudos } from '../../api/useGame'
import { useT } from '../../i18n/t'
import { cleanKudos, KUDOS_MAX, memberName } from './crew'

interface CrewKudosProps {
  kudos: Kudos[]
  /** Compañeros del entorno (id y nombre), incluido el member activo. */
  members: { member_id: number; name: string }[]
  memberId: number | null
  /** Puede dar kudos (member o admin); el resto solo los lee. */
  canSend: boolean
  /** Envía el kudos; resuelve a true si se ha guardado (para vaciar el formulario). */
  onSend: (toMemberId: number, message: string) => Promise<boolean>
}

/** Cuántos kudos recientes se enseñan. */
const SHOWN = 12

const field =
  'min-h-11 w-full  border border-env-border bg-env-bg px-3 text-sm text-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary'

/**
 * Kudos entre compañeros (FE-24): un agradecimiento breve a alguien del equipo. Suma puntos a
 * la tripulación, no a una persona: es cooperativo.
 */
export function CrewKudos({ kudos, members, memberId, canSend, onSend }: CrewKudosProps) {
  const t = useT()
  const mates = members.filter((m) => m.member_id !== memberId)
  const names = new Map(members.map((m) => [m.member_id, m.name]))
  const [to, setTo] = useState<number | ''>('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const text = cleanKudos(message)

  const submit = async () => {
    if (to === '' || !text || busy) return
    setBusy(true)
    try {
      if (await onSend(to, text)) {
        setMessage('')
        setTo('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    // Muro de agradecimientos: el formulario en una línea arriba y los kudos como tarjetas con
    // scroll propio (el panel se estira en su columna).
    <section aria-labelledby="kudos-title" className="hud-panel flex min-h-0 flex-1 flex-col">
      <h2 id="kudos-title" className="hud-panel-head">
        Kudos
        <span className="mr-2.5 ml-auto tracking-normal text-env-muted normal-case">
          {kudos.length}
        </span>
      </h2>
      {canSend && mates.length > 0 && (
        // El mensaje ocupa todo el ancho (es lo que se escribe); debajo, para quién y «Dar kudos».
        <form
          className="flex flex-col gap-2 border-b border-env-border/60 px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t('Qué le agradeces')}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void submit()
                }
              }}
              maxLength={KUDOS_MAX}
              rows={2}
              placeholder={t('Gracias por ayudarme con…')}
              className={`${field} min-h-[4.5rem] resize-none py-2.5 leading-snug [field-sizing:content]`}
            />
          </label>
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col">
              <span className="sr-only">{t('Para')}</span>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value === '' ? '' : Number(e.target.value))}
                className={field}
              >
                <option value="">{t('Para…')}</option>
                {mates.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={to === '' || !text || busy}
              className="hud-btn hud-btn-primary !h-11 shrink-0 px-4 disabled:opacity-60"
            >
              {busy ? t('Enviando…') : t('Dar kudos')}
            </button>
          </div>
        </form>
      )}

      {kudos.length === 0 ? (
        <p className="px-4 py-3 text-sm text-env-muted">
          {t('Todavía no hay kudos. Estrena tú el tablero.')}
        </p>
      ) : (
        <ul
          aria-label={t('Kudos recientes')}
          className="grid min-h-0 flex-1 auto-rows-min gap-2 overflow-y-auto p-3 [scrollbar-color:var(--env-border)_transparent] sm:grid-cols-2"
        >
          {kudos.slice(0, SHOWN).map((k) => (
            <li
              key={k.id}
              className="flex flex-col gap-1.5 border border-env-border/70 bg-env-bg/60 px-3.5 py-3"
              style={{ boxShadow: 'inset 3px 0 0 var(--env-primary)' }}
            >
              <p className="text-[0.9375rem] leading-snug break-words">
                {t('«{message}»', { message: k.message })}
              </p>
              <p className="text-sm text-env-muted">
                <span className="text-env-text">
                  {memberName(k.from_member_id, names, memberId)}
                </span>{' '}
                {t('para')}{' '}
                <span className="text-env-text">{memberName(k.to_member_id, names, memberId)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
