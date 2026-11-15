/**
 * Usuarios de demo del login (solo con DEMO_MODE en el servidor; docs/auth-and-roles.md).
 * Lógica pura: qué usuarios se enseñan para un entorno y con qué contraseña entran.
 */
export interface DemoUserLike {
  username: string
  env_id?: string | null
}

/** Entorno con el que arranca el login si el dispositivo aún no tiene ninguno: la misión espacial. */
export const DEFAULT_LOGIN_ENV = 'mars'

/**
 * Los usuarios del entorno elegido y, al final, los globales (el operador del centro de
 * control no pertenece a ningún entorno). Los de otros entornos no aparecen.
 */
export function demoUsersFor<T extends DemoUserLike>(
  users: readonly T[],
  envId: string | null,
): T[] {
  const own = users.filter((u) => u.env_id != null && u.env_id === envId)
  const global = users.filter((u) => u.env_id == null)
  return [...own, ...global]
}

/** Contraseña de un usuario de demo: `ruok-<entorno>` (`ruok-admin` para los globales). */
export function demoPassword(user: DemoUserLike): string {
  return `ruok-${user.env_id ?? 'admin'}`
}

/**
 * Nombre para la lista: sin el «(Base marciana)» final, que sobra cuando la lista ya es solo
 * de ese entorno.
 */
export function shortDisplayName(displayName: string, envName: string | undefined): string {
  const suffix = envName ? ` (${envName})` : ''
  return suffix && displayName.endsWith(suffix) ? displayName.slice(0, -suffix.length) : displayName
}

/** Iniciales del avatar: sin el tratamiento abreviado ("Cmdr.", "Dra.") ni artículos, hasta dos letras. */
export function initials(name: string): string {
  // Sin artículos ni preposiciones: «Supervisión de planta» → SP.
  const words = name
    .split(/\s+/)
    .filter((w) => w && !w.endsWith('.') && !/^(de|del|la|las|el|los|y|e)$/i.test(w))
  return (
    words
      .slice(0, 2)
      .map((w) => w[0].toLocaleUpperCase('es'))
      .join('') || '?'
  )
}
