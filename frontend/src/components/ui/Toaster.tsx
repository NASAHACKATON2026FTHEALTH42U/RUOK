import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { setSoundEnabled, soundEnabled } from '../../realtime/notify'
import { useToasts, type Toast, type ToastTone } from '../../store/toasts'
import { Icon } from './Icon'
import { STATUS_COLORS } from './status'

const TONE: Record<ToastTone, string> = {
  info: 'var(--env-primary)',
  success: STATUS_COLORS.normal,
  warning: STATUS_COLORS.warning,
  critical: STATUS_COLORS.critical,
}
/** Lo que no es urgente desaparece solo. */
const AUTO_DISMISS_MS = 6000

const ACTION = 'inline-flex min-h-8 items-center px-3 text-sm focus-visible:outline-2'

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [sound, setSound] = useState(soundEnabled)

  useEffect(() => {
    if (toast.sticky) return
    const id = setTimeout(onClose, AUTO_DISMISS_MS)
    return () => clearTimeout(id)
    // Solo al aparecer: `onClose` cambia en cada render del contenedor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    // La sombra va fuera del panel: su esquina recortada (clip-path) se la comería.
    <div
      className="toast-in pointer-events-auto w-full md:w-[26rem]"
      style={{ filter: 'drop-shadow(0 14px 26px rgba(0, 0, 0, 0.42))' }}
    >
      <div
        role={toast.tone === 'critical' || toast.tone === 'warning' ? 'alert' : 'status'}
        className="hud-panel flex gap-3 bg-env-surface py-3 pr-3 pl-4"
        style={
          {
            '--tone': TONE[toast.tone],
            // Todo el borde con el color del aviso y una franja más gruesa a la izquierda.
            borderColor: 'color-mix(in srgb, var(--tone) 70%, transparent)',
            boxShadow: 'inset 4px 0 0 var(--tone)',
          } as CSSProperties
        }
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center border"
          style={{
            color: 'var(--tone)',
            borderColor: 'color-mix(in srgb, var(--tone) 55%, transparent)',
            background: 'color-mix(in srgb, var(--tone) 12%, transparent)',
          }}
        >
          <Icon name={toast.icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase"
            style={{ color: 'var(--tone)' }}
          >
            {toast.label}
          </p>
          <p className="mt-1 text-base leading-snug font-semibold">{toast.title}</p>
          {toast.body && (
            <p className="mt-1 text-[0.9375rem] leading-snug text-env-text/90">{toast.body}</p>
          )}
          {toast.meta && <p className="mt-1.5 text-xs text-env-muted">{toast.meta}</p>}
          {(toast.actions?.length || toast.sound) && (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              {toast.actions?.map((a) => {
                const className = `${ACTION} ${
                  a.primary
                    ? 'bg-env-primary font-medium text-env-primary-text focus-visible:outline-env-text'
                    : 'border border-env-border hover:border-env-text focus-visible:outline-env-primary'
                }`
                const run = () => {
                  a.onClick?.()
                  onClose()
                }
                return a.to ? (
                  <Link key={a.label} to={a.to} onClick={run} className={className}>
                    {a.label}
                  </Link>
                ) : (
                  <button key={a.label} type="button" onClick={run} className={className}>
                    {a.label}
                  </button>
                )
              })}
              {toast.sound && (
                <button
                  type="button"
                  aria-pressed={sound}
                  onClick={() => {
                    setSoundEnabled(!sound)
                    setSound(!sound)
                  }}
                  className={`${ACTION} gap-1.5 border border-env-border text-env-muted hover:border-env-text hover:text-env-text focus-visible:outline-env-primary`}
                >
                  <Icon name={sound ? 'bell' : 'bell-off'} size={15} />
                  {sound ? 'Sonido activado' : 'Activar sonido'}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="-mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-env-muted hover:text-env-text focus-visible:outline-2 focus-visible:outline-env-primary"
        >
          <Icon name="close" size={15} />
        </button>
      </div>
    </div>
  )
}

/**
 * Avisos emergentes de toda la app: salen por abajo a la derecha (en móvil, abajo y sobre la barra
 * de pestañas), apilados, con el estilo de los paneles y un icono propio por tipo.
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed right-4 bottom-[6.5rem] left-4 z-50 flex flex-col items-end gap-2.5 md:bottom-5 md:left-auto">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  )
}
