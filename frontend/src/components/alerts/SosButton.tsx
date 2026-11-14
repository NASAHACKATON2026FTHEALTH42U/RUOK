import { useCallback, useState } from 'react'
import { useEnvironments } from '../../api/useEnvironments'
import { useInterventions } from '../../api/useInterventions'
import { useVocab } from '../../environments/useVocab'
import { useSession } from '../../auth/session'
import { useAuth } from '../../auth/useAuth'
import { useEnvironmentStore } from '../../store/environment'
import { SosDialog } from './SosDialog'

/**
 * Botón "Pedir ayuda" fijo y siempre visible (FE-13). Carga las intervenciones al arrancar
 * para tenerlas en caché y poder mostrarlas sin conexión.
 */
export function SosButton() {
  const [open, setOpen] = useState(false)
  const authenticated = useSession((s) => s.status === 'authenticated')
  const lastMemberId = useSession((s) => s.lastMemberId)
  const selectedMemberId = useEnvironmentStore((s) => s.memberId)
  // Sin sesión, el SOS usa el último member del dispositivo (kv.last_member_id).
  const memberId = authenticated ? selectedMemberId : lastMemberId
  const envId = useEnvironmentStore((s) => s.envId)
  const vocabulary = useVocab()
  const envs = useEnvironments()
  const interventions = useInterventions()
  const close = useCallback(() => setOpen(false), [])
  const { can } = useAuth()
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined

  // Sin sesión, siempre (el SOS nunca depende del login). Con sesión, según la matriz:
  // responder y psych están en tierra y no piden ayuda desde aquí (FE-28).
  if (authenticated && !can('action:sos')) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-[#d03b3b] px-5 py-3 font-semibold text-white shadow-lg ring-2 ring-white/70 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-text"
      >
        <span aria-hidden className="text-lg leading-none">
          ✚
        </span>
        Pedir ayuda
      </button>
      {open && (
        <SosDialog
          memberId={memberId}
          anonymous={!authenticated}
          env={env}
          vocabulary={vocabulary}
          interventions={interventions.state === 'ready' ? interventions.data : []}
          onClose={close}
        />
      )}
    </>
  )
}
