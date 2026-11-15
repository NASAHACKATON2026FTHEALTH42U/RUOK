import type { Role } from './roles'

/**
 * Matriz de acceso del front (FE-28): espejo de docs/auth-and-roles.md ("Matriz de acceso a
 * vistas"). Es el ÚNICO sitio del front con permisos; si cambia la matriz, se cambia aquí y en
 * el doc (y en backend/app/auth/permissions.py). Ocultar en la UI no es seguridad: el back
 * comprueba cada endpoint.
 */
export const PERMISSIONS = {
  // Vistas
  'view:environment-select': ['admin'],
  'view:members': ['medic', 'commander', 'admin'],
  'view:dashboard': ['member', 'medic', 'commander', 'family', 'admin'],
  'view:measure': ['member', 'medic', 'admin'],
  'view:checkin': ['member', 'admin'],
  'view:history': ['member', 'medic', 'commander', 'responder', 'psych', 'admin'],
  'view:missions': ['member', 'medic', 'commander', 'admin'],
  'view:alerts': ['member', 'medic', 'commander', 'responder', 'psych', 'family', 'admin'],
  'view:ground': ['responder', 'psych', 'admin'],
  // Mensaje a casa (FE-23). `family` (recibe/responde, P2) aún no existe en el backend.
  'view:home-messages': ['member', 'admin'],
  'view:control': ['admin'],
  // Acciones
  'action:sos': ['member', 'medic', 'commander', 'family', 'admin'],
  'action:measure-others': ['medic', 'admin'],
  'action:change-environment': ['admin'],
  'action:demo-panel': ['admin'],
  'action:escalate-alerts': ['member', 'medic', 'commander', 'admin'],
  'action:ack-alerts': ['medic', 'commander', 'responder', 'psych', 'admin'],
  'action:privacy': ['member'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role != null && (PERMISSIONS[permission] as readonly Role[]).includes(role)
}

/** Permiso de vista que exige cada ruta (las que no están aquí no requieren rol concreto). */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/': 'view:environment-select',
  '/members': 'view:members',
  '/dashboard': 'view:dashboard',
  '/measure': 'view:measure',
  '/checkin': 'view:checkin',
  '/pvt': 'view:checkin', // el test PVT va con el check-in (docs/auth-and-roles.md)
  '/meditation': 'view:checkin', // Meditación (FE-36): bienestar del member, como el check-in
  '/home': 'view:home-messages', // Mensaje a casa (FE-23): el hilo es solo del member
  '/history': 'view:history',
  '/missions': 'view:missions',
  '/alerts': 'view:alerts',
  '/ground': 'view:ground',
  '/control': 'view:control',
}

/**
 * Nombre visible del rol con el vocabulario del entorno (astronauta, enfermería, flight
 * surgeon…). Si el vocabulario no lo tiene, el `role_label` que da el servidor.
 */
export function userRoleLabel(
  role: Role,
  vocabulary: Record<string, string>,
  serverLabel: string,
): string {
  const key: Partial<Record<Role, string>> = {
    member: 'member',
    medic: 'medic',
    commander: 'commander',
    responder: 'ground',
    psych: 'psych',
  }
  const k = key[role]
  return (k && vocabulary[k]) || serverLabel
}
