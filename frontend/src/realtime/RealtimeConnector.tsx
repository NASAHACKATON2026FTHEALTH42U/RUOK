import { useEffect } from 'react'
import { useSession } from '../auth/session'
import { useEnvironmentStore } from '../store/environment'
import { startRealtime } from './events'

/** Abre el stream de eventos con la sesión y lo reabre si cambian el token o el entorno. */
export function RealtimeConnector() {
  const token = useSession((s) => (s.status === 'authenticated' ? s.token : null))
  const role = useSession((s) => s.user?.role ?? null)
  const envId = useEnvironmentStore((s) => s.envId)
  useEffect(() => {
    startRealtime(token, envId, role === 'admin')
    return () => startRealtime(null, null, false)
  }, [token, envId, role])
  return null
}
