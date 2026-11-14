import type { Schema } from '../api/client'

export type Role = Schema<'Role'>

/**
 * Vista inicial de cada rol tras el login (FE-27, docs/auth-and-roles.md):
 * member → su dashboard; medic y commander → lista de members de su entorno;
 * responder y psych → consola /ground; admin → selector de entorno; family → dashboard.
 */
export function homeFor(role: Role): string {
  switch (role) {
    case 'member':
    case 'family':
      return '/dashboard'
    case 'medic':
    case 'commander':
      return '/members'
    case 'responder':
    case 'psych':
      return '/ground'
    case 'admin':
      return '/'
  }
}

/** ¿Sigue vigente un token que caduca en `expIso`? (con 30 s de margen) */
export function isValid(expIso: string, nowMs: number): boolean {
  return Date.parse(expIso) - 30_000 > nowMs
}
