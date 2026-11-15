import { describe, expect, it } from 'vitest'
import { can, PERMISSIONS, ROUTE_PERMISSIONS, userRoleLabel, type Permission } from './permissions'
import { homeFor, type Role } from './roles'

const ROLES: Role[] = ['member', 'medic', 'commander', 'responder', 'psych', 'family', 'admin']

/** La matriz de docs/auth-and-roles.md, rol por rol (✅ o 👁️ = puede; 🔒 o — = no). */
const MATRIX: Record<Permission, Role[]> = {
  'view:environment-select': ['admin'],
  'view:members': ['medic', 'commander', 'admin'],
  'view:dashboard': ['member', 'medic', 'commander', 'family', 'admin'],
  'view:measure': ['member', 'medic', 'admin'],
  'view:checkin': ['member', 'admin'],
  'view:history': ['member', 'medic', 'commander', 'responder', 'psych', 'admin'],
  'view:missions': ['member', 'medic', 'commander', 'admin'],
  'view:alerts': ['member', 'medic', 'commander', 'responder', 'psych', 'family', 'admin'],
  'view:ground': ['responder', 'psych', 'admin'],
  // «Mensaje a casa»: el doc también da acceso a `family` (recibe/responde), que aún no
  // existe en el backend (BE-22: home:read y home:write solo para member y admin).
  'view:home-messages': ['member', 'admin'],
  'view:control': ['admin'],
  'action:sos': ['member', 'medic', 'commander', 'family', 'admin'],
  'action:measure-others': ['medic', 'admin'],
  'action:change-environment': ['admin'],
  'action:demo-panel': ['admin'],
  'action:escalate-alerts': ['member', 'medic', 'commander', 'admin'],
  'action:ack-alerts': ['medic', 'commander', 'responder', 'psych', 'admin'],
  'action:privacy': ['member'],
}

describe('matriz de permisos', () => {
  it('cubre todos los permisos de la matriz del doc', () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(MATRIX).sort())
  })
  for (const [perm, allowed] of Object.entries(MATRIX) as [Permission, Role[]][]) {
    it(`${perm}: solo ${allowed.join(', ')}`, () => {
      for (const role of ROLES) expect(can(role, perm)).toBe(allowed.includes(role))
    })
  }
  it('sin rol no se puede nada', () => {
    expect(can(null, 'view:alerts')).toBe(false)
  })
  it('la vista inicial de cada rol siempre está permitida (no hay bucles de redirección)', () => {
    for (const role of ROLES) {
      const perm = ROUTE_PERMISSIONS[homeFor(role)]
      expect(perm === undefined || can(role, perm)).toBe(true)
    }
  })
})

describe('userRoleLabel', () => {
  const marte = {
    member: 'astronauta',
    medic: 'oficial médico',
    ground: 'flight surgeon',
    psych: 'psicólogo BHP',
  }
  it('usa el vocabulario del entorno', () => {
    expect(userRoleLabel('member', marte, 'x')).toBe('astronauta')
    expect(userRoleLabel('responder', marte, 'x')).toBe('flight surgeon')
  })
  it('sin vocabulario, la etiqueta del servidor', () => {
    expect(userRoleLabel('admin', marte, 'operador')).toBe('operador')
    expect(userRoleLabel('commander', marte, 'comandante')).toBe('comandante')
  })
})
