import { useCallback, useEffect, useState } from 'react'
import type { Schema } from '../../api/client'
import { getDevice } from '../../offline/device'
import { sendHeartbeat, useOutboxStore } from '../../offline/outbox'
import { useActivityStore } from '../../store/activity'
import { buildHeartbeat, currentDeviceKind, HEARTBEAT_MS } from './heartbeat'

type Liveness = Schema<'Liveness'>

/**
 * Heartbeat del dispositivo del member (FE-15): cada 15 s envía la actividad actual, los
 * pendientes del outbox y la última sincronización. Con la pestaña oculta (pantalla bloqueada)
 * no se fuerza el envío: el navegador la suspende y el servidor pasa a `stale`, que es lo
 * correcto. Al volver a la pestaña o cambiar de actividad se envía uno al instante.
 *
 * `checkinRequired` viene del servidor: true → mostrar el modal "R U OK?".
 */
export function useHeartbeat(memberId: number | null) {
  const activity = useActivityStore((s) => s.activity)
  const [liveness, setLiveness] = useState<Liveness | null>(null)
  const [checkinRequired, setCheckinRequired] = useState(false)

  const beat = useCallback(async () => {
    if (memberId === null || document.visibilityState === 'hidden') return
    const { pending, lastSyncAt } = useOutboxStore.getState()
    try {
      const r = await sendHeartbeat(
        memberId,
        buildHeartbeat({
          deviceId: getDevice().id,
          activity,
          pendingOutbox: pending,
          lastSyncAt,
          deviceKind: currentDeviceKind(),
        }),
      )
      setLiveness(r.liveness)
      setCheckinRequired(r.checkin_required)
    } catch {
      // Sin conexión o error del servidor: no se reintenta ni se encola (ver outbox.ts).
    }
  }, [memberId, activity])

  useEffect(() => {
    if (memberId === null) return
    void beat()
    const id = window.setInterval(() => void beat(), HEARTBEAT_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void beat()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [memberId, beat])

  /** Tras responder al "R U OK?": oculta el modal y avisa al servidor con un heartbeat nuevo. */
  const answered = useCallback(() => {
    setCheckinRequired(false)
    void beat()
  }, [beat])

  return { liveness, checkinRequired, answered }
}
