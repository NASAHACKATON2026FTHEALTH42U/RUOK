import { describe, expect, it } from 'vitest'
import { can, type Permission } from '../../auth/permissions'
import type { Role } from '../../auth/roles'
import { allowedItems, menuFor, navItems, tabsFor } from './navigation'

const VOCAB = { crew: 'tripulación', ground: 'control de misión' }

function menu(role: Role) {
  const allowed = menuFor(
    role,
    allowedItems(navItems(VOCAB), (p: Permission) => can(role, p)),
  )
  return { items: allowed.map((i) => i.to), tabs: tabsFor(role, allowed).map((i) => i.to) }
}

describe('menú por rol', () => {
  it('el operador solo ve gestión y monitorización', () => {
    const { items, tabs } = menu('admin')
    expect(items).toEqual([
      '/control',
      '/control/simulate',
      '/alerts',
      '/members',
      '/control/log',
      '/control/users',
      '/control/devices',
      '/ground',
      '/settings',
    ])
    for (const selfCare of ['/measure', '/checkin', '/pvt', '/missions', '/meditation', '/home'])
      expect(items).not.toContain(selfCare)
    expect(tabs).toEqual(['/control', '/control/simulate', '/alerts', '/more'])
  })

  it('el resto de roles conserva todas sus vistas permitidas', () => {
    const { items } = menu('member')
    expect(items).toEqual(
      expect.arrayContaining(['/dashboard', '/measure', '/missions', '/checkin', '/meditation']),
    )
    expect(items).not.toContain('/control')
    expect(menu('medic').items).toContain('/members')
  })
})
