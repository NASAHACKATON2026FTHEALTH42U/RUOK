import { useCallback } from 'react'
import { can as canRole, type Permission } from './permissions'
import { useEnvironmentStore } from '../store/environment'
import { useSession } from './session'

/** Usuario y permisos de la sesión actual (FE-28). `can()` es false sin sesión. */
export function useAuth() {
  const user = useSession((s) => s.user)
  const authenticated = useSession((s) => s.status === 'authenticated')
  const role = authenticated ? (user?.role ?? null) : null
  const can = useCallback((p: Permission) => canRole(role, p), [role])
  return { user: authenticated ? user : null, role, authenticated, can }
}

/**
 * Member cuyos datos se muestran o se miden: un `member` SIEMPRE el suyo (aunque el store
 * tuviera otro); el resto de roles, el que hayan elegido (lista de members, selector).
 */
export function useActiveMemberId(): number | null {
  const { role, user } = useAuth()
  const selected = useEnvironmentStore((s) => s.memberId)
  return role === 'member' ? (user?.member_id ?? null) : selected
}
