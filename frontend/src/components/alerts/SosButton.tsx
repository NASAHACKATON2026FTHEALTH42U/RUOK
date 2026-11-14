import { useCallback, useState } from 'react'
import { useEnvironments } from '../../api/useEnvironments'
import { useInterventions } from '../../api/useInterventions'
import { useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'
import { SosDialog } from './SosDialog'

/**
 * Botón "Pedir ayuda" fijo y siempre visible (FE-13). Carga las intervenciones al arrancar
 * para tenerlas en caché y poder mostrarlas sin conexión.
 */
export function SosButton() {
  const [open, setOpen] = useState(false)
  const memberId = useEnvironmentStore((s) => s.memberId)
  const envId = useEnvironmentStore((s) => s.envId)
  const vocabulary = useVocab()
  const envs = useEnvironments()
  const interventions = useInterventions()
  const close = useCallback(() => setOpen(false), [])
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined

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
          env={env}
          vocabulary={vocabulary}
          interventions={interventions.state === 'ready' ? interventions.data : []}
          onClose={close}
        />
      )}
    </>
  )
}
