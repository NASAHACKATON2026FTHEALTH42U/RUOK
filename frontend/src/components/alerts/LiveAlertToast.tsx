import type { Schema } from '../../api/client'
import { useEnvironments } from '../../api/useEnvironments'
import { useAuth } from '../../auth/useAuth'
import { getDevice } from '../../offline/device'
import { useEvents } from '../../realtime/events'
import { beep, vibrate } from '../../realtime/notify'
import { useEnvironmentStore } from '../../store/environment'
import { pushToast, type ToastTone } from '../../store/toasts'
import { categoryLabel, severityStyle } from './alertFormat'

type Payload = {
  category?: Schema<'AlertCategory'>
  severity?: Schema<'AlertSeverity'>
  title?: string | null
  text?: string
  level?: Schema<'NotificationLevel'>
  from_name?: string
}

/**
 * Avisos en vivo (no pinta nada: los deja en `Toaster`), con vibración y, si se activa, sonido,
 * de lo que llega de OTROS dispositivos:
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
  const staff = can('action:ack-alerts')
  const member = role === 'member'
  const admin = role === 'admin'
  const alertsRoute = can('view:ground') && !can('view:members') ? '/ground' : '/alerts'

  useEvents(
    {
      types: ['alert.created', 'alert.escalated', 'notification.sent'],
      envId: admin ? null : envId,
    },
    (e) => {
      if (!e || e.device_id === getDevice().id) return
      const p = e.payload as Payload

      if (e.type === 'notification.sent') {
        if (!member) return
        const tone: ToastTone =
          p.level === 'critical' ? 'critical' : p.level === 'warning' ? 'warning' : 'info'
        pushToast({
          tone,
          icon: 'mail',
          label: 'Notificación',
          title: p.title || 'Mensaje de control',
          body: p.text,
          meta: p.from_name ? `De ${p.from_name}` : undefined,
          actions: [{ label: 'Entendido', primary: true }],
          sticky: true,
        })
      } else {
        if (member ? e.user_id != null && e.user_id === user?.id : !staff) return // la creó él mismo
        const created = e.type === 'alert.created'
        const envList = envs.state === 'ready' ? envs.data : []
        const otherEnv =
          admin && e.env_id && e.env_id !== envId
            ? envList.find((x) => x.id === e.env_id)
            : undefined
        pushToast({
          tone: p.severity === 'warning' ? 'warning' : 'critical',
          icon: created ? 'alert' : 'escalate',
          label: otherEnv ? otherEnv.name : created ? 'Alerta' : 'Alerta escalada',
          title: member
            ? created
              ? 'Nueva alerta para ti'
              : 'Tu alerta ha cambiado'
            : created
              ? 'Nueva alerta'
              : 'Alerta escalada',
          body: member
            ? [
                p.category && categoryLabel(p.category),
                p.severity && severityStyle(p.severity).label,
              ]
                .filter(Boolean)
                .join(' · ')
            : e.summary,
          actions: [
            {
              label: 'Ver',
              to: alertsRoute,
              primary: true,
              onClick: () => {
                const store = useEnvironmentStore.getState()
                if (otherEnv) store.selectEnvironment(otherEnv)
                if (e.member_id != null && !member) store.selectMember(e.member_id)
              },
            },
          ],
          sticky: true,
          sound: true,
        })
      }
      vibrate()
      beep()
    },
  )

  return null
}
