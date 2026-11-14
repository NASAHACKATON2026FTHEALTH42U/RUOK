import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../auth/session'

/**
 * Sin sesión válida → /login (recordando a dónde se iba). Con la sesión caducada (401 o `exp`)
 * se avisa en el login; nada se borra. Los permisos por rol son de FE-28.
 */
export function RequireSession() {
  const status = useSession((s) => s.status)
  const location = useLocation()
  if (status === 'loading') return null
  if (status !== 'authenticated') {
    const next = encodeURIComponent(location.pathname + location.search)
    return (
      <Navigate to={`/login?next=${next}${status === 'expired' ? '&expired=1' : ''}`} replace />
    )
  }
  return <Outlet />
}
