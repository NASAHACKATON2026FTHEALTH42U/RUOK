import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Permission } from '../../auth/permissions'
import { homeFor } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'

/**
 * Ruta con permiso (FE-28): si el rol no lo tiene, redirige a SU vista inicial. Va dentro de
 * RequireSession, así que aquí siempre hay sesión. Ocultar no es seguridad: el back también
 * comprueba cada endpoint.
 */
export function RequireRole({
  permission,
  children,
}: {
  permission: Permission
  children: ReactNode
}) {
  const { role, can } = useAuth()
  if (!role) return null
  if (!can(permission)) return <Navigate to={homeFor(role)} replace />
  return <>{children}</>
}
