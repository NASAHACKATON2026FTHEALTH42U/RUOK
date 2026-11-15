import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Schema } from '../../api/client'
import { useEnvironments } from '../../api/useEnvironments'
import { useAuth } from '../../auth/useAuth'
import { getDevice } from '../../offline/device'
import { useEvents } from '../../realtime/events'
import type { RealtimeEvent } from '../../realtime/match'
import { beep, setSoundEnabled, soundEnabled, vibrate } from '../../realtime/notify'
import { useEnvironmentStore } from '../../store/environment'
import { STATUS_COLORS } from '../ui/status'
import { categoryLabel, severityStyle } from './alertFormat'

type Payload = {
  category?: Schema<'AlertCategory'>
  severity?: Schema<'AlertSeverity'>
  title?: string | null
  text?: string
  level?: Schema<'NotificationLevel'>
  from_name?: string
}

/** Color del borde: la gravedad de la alerta o el nivel de la notificación. */
function toneColor(e: RealtimeEvent): string {
  const p = e.payload as Payload
  if (e.type === 'notification.sent')
    return p.level === 'critical'
      ? STATUS_COLORS.critical
      : p.level === 'warning'
        ? STATUS_COLORS.warning
        : 'var(--env-primary)'
  return p.severity === 'warning' ? STATUS_COLORS.warning : STATUS_COLORS.critical
}

/**
 * Aviso en vivo (sale por abajo a la derecha; en móvil, abajo y sobre la barra de pestañas), con
 * vibración y (si se activa) sonido, de lo que llega de OTROS dispositivos:
 * - Quien atiende alertas (medic, commander, responder, psych): las nuevas o escaladas de su
 *   entorno. "El astronauta pulsa SOS → la tablet del médico la muestra y vibra al instante".
 * - El operador (admin): las de cualquier entorno, con su nombre, para no perder ninguna aunque
 *   esté mirando otro; «Ver» cambia a ese entorno.
 * - El member: las alertas que otros (el operador, el staff o el sistema) crean para él y las
 *   notificaciones personalizadas que le envían.
 */
export function LiveAlertToast() {
  const { can, role, user } = useAuth()
  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const [toast, setToast] = useState<RealtimeEvent | null>(null)
  const [sound, setSound] = useState(soundEnabled)
  const staff = can('action:ack-alerts')
  const member = role === 'member'
  const admin = role === 'admin'

  useEvents(
    {
      types: ['alert.created', 'alert.escalated', 'notification.sent'],
      envId: admin ? null : envId,
    },
    (e) => {
      if (!e || e.device_id === getDevice().id) return
      if (e.type === 'notification.sent') {
        if (!member) return
      } else if (member) {
        if (e.user_id != null && e.user_id === user?.id) return // la creó él mismo
      } else if (!staff) return
      setToast(e)
      vibrate()
      beep()
    },
  )

  if (!toast || !(staff || member)) return null
  const p = toast.payload as Payload
  const envList = envs.state === 'ready' ? envs.data : []
  const otherEnv =
    admin && toast.env_id && toast.env_id !== envId
      ? envList.find((e) => e.id === toast.env_id)
      : undefined
  const isNotice = toast.type === 'notification.sent'

  const title = isNotice
    ? p.title || 'Notificación'
    : member
      ? toast.type === 'alert.created'
        ? 'Nueva alerta para ti'
        : 'Tu alerta ha cambiado'
      : toast.type === 'alert.created'
        ? 'Nueva alerta'
        : 'Alerta escalada'
  const body = isNotice
    ? p.text
    : member
      ? [p.category && categoryLabel(p.category), p.severity && severityStyle(p.severity).label]
          .filter(Boolean)
          .join(' · ')
      : toast.summary

  return (
    <div
      role="alert"
      className="toast-in fixed right-4 bottom-[6.5rem] left-4 z-50 flex items-start gap-3 border-2 bg-env-bg p-4 shadow-2xl md:bottom-5 md:left-auto md:w-[28rem] md:max-w-[calc(100vw-2rem)]"
      style={{ borderColor: toneColor(toast) }}
    >
      <span aria-hidden className="text-2xl leading-none">
        {isNotice ? '✉' : '🚨'}
      </span>
      <div className="min-w-0 flex-1">
        {otherEnv && <p className="hud-label">{otherEnv.name}</p>}
        <p className="font-semibold">{title}</p>
        {body && <p className="text-sm">{body}</p>}
        {isNotice && p.from_name && (
          <p className="mt-0.5 text-xs text-env-muted">De {p.from_name}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {isNotice ? (
            <button
              type="button"
              onClick={() => setToast(null)}
              className="bg-env-primary px-3 py-1 font-medium text-env-primary-text"
            >
              Entendido
            </button>
          ) : (
            <Link
              to={can('view:ground') && !can('view:members') ? '/ground' : '/alerts'}
              onClick={() => {
                const store = useEnvironmentStore.getState()
                if (otherEnv) store.selectEnvironment(otherEnv)
                if (toast.member_id != null && !member) store.selectMember(toast.member_id)
                setToast(null)
              }}
              className="bg-env-primary px-3 py-1 font-medium text-env-primary-text"
            >
              Ver
            </Link>
          )}
          {!isNotice && (
            <button
              type="button"
              onClick={() => setToast(null)}
              className="border border-env-border px-3 py-1"
            >
              Cerrar
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!sound)
              setSound(!sound)
            }}
            className="border border-env-border px-3 py-1 text-env-muted"
            aria-pressed={sound}
          >
            {sound ? '🔔 Sonido activado' : '🔕 Activar sonido'}
          </button>
        </div>
      </div>
    </div>
  )
}
