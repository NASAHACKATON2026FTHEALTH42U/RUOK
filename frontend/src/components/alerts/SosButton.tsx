import { useCallback, useState } from 'react'
import { useEnvironments } from '../../api/useEnvironments'
import { useInterventions } from '../../api/useInterventions'
import { useSession } from '../../auth/session'
import { useAuth } from '../../auth/useAuth'
import { useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'
import { SosDialog } from './SosDialog'
import { SosEmergency } from './SosEmergency'
import { Icon } from '../ui/Icon'

/**
 * Lo que necesitan el SOS y los avisos: quién pide ayuda, su entorno y las intervenciones (se
 * cargan al arrancar para tenerlas en caché y poder mostrarlas sin conexión). Sin sesión, el
 * último member del dispositivo (kv.last_member_id): el SOS nunca depende del login.
 */
function useHelpContext() {
  const authenticated = useSession((s) => s.status === 'authenticated')
  const lastMemberId = useSession((s) => s.lastMemberId)
  const selectedMemberId = useEnvironmentStore((s) => s.memberId)
  const envId = useEnvironmentStore((s) => s.envId)
  const vocabulary = useVocab()
  const envs = useEnvironments()
  const interventions = useInterventions()
  const { can } = useAuth()
  return {
    authenticated,
    memberId: authenticated ? selectedMemberId : lastMemberId,
    env: envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined,
    vocabulary,
    interventions: interventions.state === 'ready' ? interventions.data : [],
    // Con sesión, según la matriz: responder y psych están en tierra y no piden ayuda (FE-28).
    allowed: !authenticated || can('action:sos'),
  }
}

/**
 * Botón SOS siempre visible (FE-13). Pone solo «SOS»: al pulsarlo avisa de que se enviará la
 * alerta de ayuda si no se cancela en 3 s y la envía sola (`SosEmergency`, modal bloqueante).
 * - `sidebar`: bloque rojo arriba del menú lateral (tableta y escritorio), lo primero que se ve
 *   y lo primero al tabular.
 * - `tab`: botón rojo en el centro de la barra inferior (móvil), al alcance del pulgar.
 * - `inline`: a todo el ancho dentro de la página (login, FE-27).
 * - `floating`: flotante abajo a la derecha (pantallas sin menú ni barra inferior).
 */
export function SosButton({
  variant = 'floating',
}: {
  variant?: 'sidebar' | 'tab' | 'inline' | 'floating'
} = {}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ctx = useHelpContext()
  if (!ctx.allowed) return null

  // El nombre accesible empieza por el texto visible («SOS») y explica qué hace.
  const common = {
    type: 'button' as const,
    onClick: () => setOpen(true),
    'aria-haspopup': 'dialog' as const,
    'aria-label': 'SOS: pedir ayuda de emergencia',
  }

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          {...common}
          // 1,5 rem hasta el menú: el hueco de la barra (0,75 rem; 0,5 en pantallas bajas) + este margen.
          className="sos-font hud-btn hud-btn-danger-solid mb-3 !h-16 w-full shrink-0 !text-2xl !font-semibold !tracking-[0.35em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-text [@media(max-height:800px)]:mb-4 [@media(max-height:800px)]:!h-14"
        >
          SOS
        </button>
      ) : variant === 'tab' ? (
        // Más alto que las pestañas y sobresale de la barra: se encuentra sin buscarlo.
        <div className="flex items-start justify-center">
          <button
            {...common}
            className="sos-font -mt-6 flex size-[4.75rem] items-center justify-center rounded-full border-4 border-env-bg bg-[var(--sos-bg)] text-lg font-semibold tracking-[0.12em] text-[var(--sos-text)] shadow-lg transition-[transform,box-shadow,background-color] duration-150 hover:bg-[var(--sos-bg-strong)] hover:shadow-[0_0_0_3px_#ffffff,0_0_28px_rgba(255,42,42,0.85)] active:bg-[var(--sos-bg-strong)] active:shadow-[0_0_0_3px_#ffffff,0_0_28px_rgba(255,42,42,0.85)] motion-safe:hover:scale-105 motion-safe:active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-text"
          >
            SOS
          </button>
        </div>
      ) : (
        <button
          {...common}
          className={
            variant === 'inline'
              ? 'sos-font hud-btn hud-btn-danger w-full !text-base !font-semibold !tracking-[0.3em] focus-visible:outline-2 focus-visible:outline-env-text'
              : 'sos-font hud-btn hud-btn-danger-solid fixed right-4 bottom-4 z-40 !text-base !tracking-[0.3em] focus-visible:outline-2 focus-visible:outline-env-text'
          }
        >
          SOS
        </button>
      )}
      {open && (
        <SosEmergency
          memberId={ctx.memberId}
          anonymous={!ctx.authenticated}
          env={ctx.env}
          vocabulary={ctx.vocabulary}
          interventions={ctx.interventions}
          onClose={close}
        />
      )}
    </>
  )
}

/**
 * "Enviar aviso a control": el formulario con categoría, urgencia, destino y mensaje
 * (`SosDialog`), para lo que no es una emergencia. Solo con sesión y con permiso de SOS.
 */
export function NoticeButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ctx = useHelpContext()
  if (!ctx.authenticated || !ctx.allowed) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-env-border px-3.5 text-sm font-medium hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${className}`}
      >
        <Icon name="mail" size={17} />
        Enviar aviso a control
      </button>
      {open && (
        <SosDialog
          memberId={ctx.memberId}
          env={ctx.env}
          vocabulary={ctx.vocabulary}
          interventions={ctx.interventions}
          onClose={close}
        />
      )}
    </>
  )
}
