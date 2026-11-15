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
  icon: IconName
}

export type IconName =
  'panel' | 'measure' | 'missions' | 'more' | 'crew' | 'alerts' | 'list' | 'meditation'

export function navItems(vocab: { crew: string; ground: string }): NavItem[] {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return [
    { to: '/dashboard', label: 'Panel', icon: 'panel' },
    { to: '/members', label: cap(vocab.crew), icon: 'crew' },
    { to: '/measure', label: 'Medir', icon: 'measure' },
    { to: '/missions', label: 'Misiones', icon: 'missions' },
    { to: '/alerts', label: 'Alertas', icon: 'alerts' },
    { to: '/checkin', label: 'Check-in diario', icon: 'list' },
    { to: '/pvt', label: 'Test de vigilancia', icon: 'list' },
    { to: '/history', label: 'Historial', icon: 'list' },
    { to: '/meditation', label: 'Meditación', icon: 'meditation' },
    { to: '/home', label: 'Mensaje a casa', icon: 'list' },
    { to: '/ground', label: `Consola de ${vocab.ground}`, icon: 'alerts' },
    { to: '/control', label: 'Centro de control', icon: 'panel' },
    { to: '/control/simulate', label: 'Simulación', icon: 'missions' },
    { to: '/control/users', label: 'Usuarios', icon: 'crew' },
    { to: '/control/devices', label: 'Dispositivos', icon: 'list' },
    { to: '/control/log', label: 'Registro', icon: 'list' },
    { to: '/', label: 'Entornos', icon: 'list' },
    { to: '/settings', label: 'Ajustes', icon: 'list' },
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
  admin: ['/control', '/control/simulate', '/alerts'],
}

export const MORE: NavItem = { to: '/more', label: 'Más', icon: 'more' }

/**
 * Menú del operador (admin): gestión, monitorización y pruebas del entorno activo, sin las
 * opciones de autocuidado de un member (medir, check-in, misiones, meditación…). Los permisos no
 * cambian: esas vistas se abren desde la ficha de cada member.
 */
const OPERATOR_MENU = [
  '/control',
  '/control/simulate',
  '/alerts',
  '/members',
  '/control/log',
  '/control/users',
  '/control/devices',
  '/ground',
  '/settings',
]

/**
 * Secciones del operador que ocupan el alto disponible: la página no hace scroll, lo hacen sus
 * paneles (eventos en vivo, registro, usuarios, dispositivos).
 */
export const OPERATOR_FILL_ROUTES = [
  '/control',
  '/control/log',
  '/control/users',
  '/control/devices',
  '/ground', // la consola de tierra (responder, psych y operador)
]

/** Entradas del menú del rol: todas las permitidas, salvo el operador, que tiene el suyo. */
export function menuFor(role: Role | null, allowed: NavItem[]): NavItem[] {
  if (role !== 'admin') return allowed
  return OPERATOR_MENU.map((to) => allowed.find((i) => i.to === to)).filter((i): i is NavItem =>
    Boolean(i),
  )
}

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
