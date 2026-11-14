import type { Permission } from '../../auth/permissions'
import { ROUTE_PERMISSIONS } from '../../auth/permissions'
import type { Role } from '../../auth/roles'

/**
 * Navegación del estilo HUD (docs/design/hud-style.md §6): en móvil, 3 pestañas por rol + «Más»;
 * el resto de rutas se llega desde la pantalla «Más». En escritorio, todas en la barra lateral.
 */
export interface NavItem {
  to: string
  label: string
  /** Código mono de 3 letras (`ALR`, `CHK`…) para las filas de «Más». */
  code: string
  icon: IconName
}

export type IconName = 'panel' | 'measure' | 'missions' | 'more' | 'crew' | 'alerts' | 'list'

export function navItems(vocab: { crew: string; ground: string }): NavItem[] {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return [
    { to: '/dashboard', label: 'Panel', code: 'PNL', icon: 'panel' },
    { to: '/members', label: cap(vocab.crew), code: 'TRP', icon: 'crew' },
    { to: '/measure', label: 'Medir', code: 'MED', icon: 'measure' },
    { to: '/missions', label: 'Misiones', code: 'MSN', icon: 'missions' },
    { to: '/alerts', label: 'Alertas', code: 'ALR', icon: 'alerts' },
    { to: '/checkin', label: 'Check-in diario', code: 'CHK', icon: 'list' },
    { to: '/pvt', label: 'Test de vigilancia', code: 'PVT', icon: 'list' },
    { to: '/history', label: 'Historial', code: 'HST', icon: 'list' },
    { to: '/earth', label: 'La Tierra', code: 'ERT', icon: 'list' },
    { to: '/home', label: 'Mensaje a casa', code: 'MSJ', icon: 'list' },
    { to: '/ground', label: `Consola de ${vocab.ground}`, code: 'GND', icon: 'alerts' },
    { to: '/control', label: 'Centro de control', code: 'CTL', icon: 'panel' },
    { to: '/', label: 'Entornos', code: 'ENV', icon: 'list' },
  ]
}

/** Orden de preferencia de las pestañas de cada rol; se quedan las 3 primeras permitidas. */
const TAB_PREFERENCE: Record<Role, string[]> = {
  member: ['/dashboard', '/measure', '/missions'],
  medic: ['/members', '/alerts', '/measure'],
  commander: ['/members', '/alerts', '/missions'],
  responder: ['/ground', '/alerts', '/history'],
  psych: ['/ground', '/alerts', '/history'],
  family: ['/dashboard', '/alerts'],
  admin: ['/', '/control', '/dashboard'],
}

export const MORE: NavItem = { to: '/more', label: 'Más', code: 'MAS', icon: 'more' }

/** Rutas que puede ver el rol, en el orden de `navItems`. */
export function allowedItems(items: NavItem[], can: (p: Permission) => boolean): NavItem[] {
  return items.filter((i) => {
    const p = ROUTE_PERMISSIONS[i.to]
    return !p || can(p)
  })
}

/** Pestañas del móvil: hasta 3 del rol + «Más». */
export function tabsFor(role: Role | null, allowed: NavItem[]): NavItem[] {
  const pref = role ? TAB_PREFERENCE[role] : []
  const tabs = pref
    .map((to) => allowed.find((i) => i.to === to))
    .filter((i): i is NavItem => Boolean(i))
    .slice(0, 3)
  return [...tabs, MORE]
}
