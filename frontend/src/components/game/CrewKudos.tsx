import { useState } from 'react'
import type { Kudos } from '../../api/useGame'
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
const SHOWN = 4

const field =
  'min-h-11 w-full rounded-lg border border-env-border bg-env-bg px-3 text-sm text-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary'

/**
 * Kudos entre compañeros (FE-24): un agradecimiento breve a alguien del equipo. Suma puntos a
 * la tripulación, no a una persona: es cooperativo.
 */
export function CrewKudos({ kudos, members, memberId, canSend, onSend }: CrewKudosProps) {
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
    <section className="hud-panel shrink-0">
      <h2 className="hud-panel-head">Kudos</h2>
      <div className="px-4 py-3">
        {canSend && mates.length > 0 && (
          <form
            className="mt-2 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-env-muted">Para</span>
              <select
                value={to}
                onChange={(e) => setTo(e.target.value === '' ? '' : Number(e.target.value))}
                className={field}
              >
                <option value="">Elige a alguien…</option>
                {mates.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-env-muted">Qué le agradeces</span>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={KUDOS_MAX}
                placeholder="Gracias por…"
                className={field}
              />
            </label>
            <button
              type="submit"
              disabled={to === '' || !text || busy}
              className="min-h-11 rounded-lg bg-env-primary px-4 text-sm font-semibold text-env-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary disabled:opacity-60"
            >
              {busy ? 'Enviando…' : 'Dar kudos'}
            </button>
          </form>
        )}

        {kudos.length === 0 ? (
          <p className="mt-3 text-sm text-env-muted">
            Todavía no hay kudos. Estrena tú el tablero.
          </p>
        ) : (
          <ul className="mt-3 space-y-2" aria-label="Kudos recientes">
            {kudos.slice(0, SHOWN).map((k) => (
              <li key={k.id} className="text-sm">
                <p className="text-xs text-env-muted">
                  {memberName(k.from_member_id, names, memberId)} →{' '}
                  {memberName(k.to_member_id, names, memberId)}
                </p>
                <p className="break-words">«{k.message}»</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
