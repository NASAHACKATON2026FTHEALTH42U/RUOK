import { useEffect } from 'react'
import { useSession } from '../auth/session'
import { useEnvironmentStore } from '../store/environment'
import { startRealtime } from './events'

/**
 * Abre el stream de eventos con la sesión y lo reabre si cambian el token o el entorno. El
 * operador (admin) lo abre SIN filtro de entorno: así le llega el aviso de una alerta de cualquier
 * entorno aunque esté mirando otro, y cada vista filtra por el entorno activo en el cliente.
 */
export function RealtimeConnector() {
  const token = useSession((s) => (s.status === 'authenticated' ? s.token : null))
  const role = useSession((s) => s.user?.role ?? null)
  const storeEnvId = useEnvironmentStore((s) => s.envId)
  const envId = role === 'admin' ? null : storeEnvId
  useEffect(() => {
    startRealtime(token, envId, role === 'admin')
    return () => startRealtime(null, null, false)
  }, [token, envId, role])
  return null
}
