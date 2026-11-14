import { useCallback, useState } from 'react'
import { useEnvironments } from '../../api/useEnvironments'
import { useInterventions } from '../../api/useInterventions'
import { useVocab } from '../../environments/useVocab'
import { useSession } from '../../auth/session'
import { useAuth } from '../../auth/useAuth'
import { useEnvironmentStore } from '../../store/environment'
import { SosDialog } from './SosDialog'

/**
 * Botón "Pedir ayuda" siempre visible (FE-13). Carga las intervenciones al arrancar para
 * tenerlas en caché y poder mostrarlas sin conexión. Mismo diálogo en las tres variantes:
 * - `header`: botón `SOS` de la cabecera HUD (44 px), arriba a la derecha.
 * - `inline`: a todo el ancho dentro de la página (login, FE-27).
 * - `floating`: flotante abajo a la derecha (pantallas sin cabecera).
 */
export function SosButton({
  variant = 'floating',
  label = 'Pedir ayuda',
}: {
  variant?: 'header' | 'inline' | 'floating'
  label?: string
} = {}) {
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
      {variant === 'header' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label="SOS: pedir ayuda"
          className="hud-btn hud-btn-danger !h-11 shrink-0 !px-3 !text-[11px] !tracking-[0.12em] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-env-text"
        >
          SOS
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={
            variant === 'inline'
              ? 'hud-btn hud-btn-danger w-full focus-visible:outline-2 focus-visible:outline-env-text'
              : 'hud-btn hud-btn-danger-solid fixed right-4 bottom-4 z-40 shadow-lg hover:brightness-110 focus-visible:outline-2 focus-visible:outline-env-text'
          }
        >
          <span aria-hidden className="text-base leading-none">
            ✚
          </span>
          {label}
        </button>
      )}
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
