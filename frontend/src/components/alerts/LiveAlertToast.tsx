import { STATUS_COLORS } from '../ui/status'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getDevice } from '../../offline/device'
import { useEvents } from '../../realtime/events'
import type { RealtimeEvent } from '../../realtime/match'
import { beep, setSoundEnabled, soundEnabled, vibrate } from '../../realtime/notify'
import { useEnvironmentStore } from '../../store/environment'

/**
 * Aviso en vivo de alertas nuevas o escaladas de OTROS dispositivos (FE-29) para quien las
 * atiende (medic, commander, responder, psych, admin): aviso en pantalla, vibración y, si se
 * activa, sonido. "El astronauta pulsa SOS → la tablet del médico la muestra y vibra al instante".
 */
export function LiveAlertToast() {
  const { can } = useAuth()
  const envId = useEnvironmentStore((s) => s.envId)
  const [toast, setToast] = useState<RealtimeEvent | null>(null)
  const [sound, setSound] = useState(soundEnabled)
  const enabled = can('action:ack-alerts')

  useEvents({ types: ['alert.created', 'alert.escalated'], envId }, (e) => {
    if (!enabled || !e || e.device_id === getDevice().id) return
    setToast(e)
    vibrate()
    beep()
  })

  if (!enabled || !toast) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-xl border-2 bg-env-bg p-4 shadow-2xl"
      style={{ borderColor: STATUS_COLORS.critical }}
    >
      <span aria-hidden className="text-2xl leading-none">
        🚨
      </span>
      <div className="flex-1">
        <p className="font-semibold">
          {toast.type === 'alert.created' ? 'Nueva alerta' : 'Alerta escalada'}
        </p>
        <p className="text-sm">{toast.summary}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Link
            to={can('view:ground') && !can('view:members') ? '/ground' : '/alerts'}
            onClick={() => {
              if (toast.member_id != null)
                useEnvironmentStore.getState().selectMember(toast.member_id)
              setToast(null)
            }}
            className="rounded-md bg-env-primary px-3 py-1 font-medium text-env-primary-text"
          >
            Ver
          </Link>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="rounded-md border border-env-border px-3 py-1"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              setSoundEnabled(!sound)
              setSound(!sound)
            }}
            className="rounded-md border border-env-border px-3 py-1 text-env-muted"
            aria-pressed={sound}
          >
            {sound ? '🔔 Sonido activado' : '🔕 Activar sonido'}
          </button>
        </div>
      </div>
    </div>
  )
}
