import { can } from '../../auth/permissions'
import type { Role } from '../../auth/roles'

/**
 * Qué ofrecer cuando una página necesita un member y no hay ninguno elegido (FE-35):
 * - `pick`: quien puede elegir members (admin, medic, commander) y tiene entorno → selector;
 * - `choose-env`: admin sin entorno → pantalla de entornos;
 * - `ground`: responder y psych no eligen members a bordo → su consola `/ground`;
 * - `none`: nada útil que ofrecer (p. ej. un medic sin entorno asignado).
 */
export type NoMemberAction = 'pick' | 'choose-env' | 'ground' | 'none'

export function noMemberAction(role: Role | null, envId: string | null): NoMemberAction {
  if (can(role, 'view:members')) {
    if (envId) return 'pick'
    return can(role, 'view:environment-select') ? 'choose-env' : 'none'
  }
  if (can(role, 'view:ground')) return 'ground'
  return 'none'
}
