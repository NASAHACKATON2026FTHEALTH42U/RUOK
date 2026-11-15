import { describe, expect, it } from 'vitest'
import { DEFAULT_LOGIN_ENV, demoPassword, demoUsersFor, shortDisplayName } from './demoUsers'

const USERS = [
  { username: 'ruiz', env_id: 'earth' },
  { username: 'vega', env_id: 'mars' },
  { username: 'medic-mars', env_id: 'mars' },
  { username: 'lindqvist', env_id: 'iss' },
  { username: 'admin', env_id: null },
]

describe('demoUsersFor', () => {
  it('solo los del entorno y, al final, los globales', () => {
    expect(demoUsersFor(USERS, 'mars').map((u) => u.username)).toEqual([
      'vega',
      'medic-mars',
      'admin',
    ])
  })

  it('sin entorno elegido solo quedan los globales', () => {
    expect(demoUsersFor(USERS, null).map((u) => u.username)).toEqual(['admin'])
  })

  it('el entorno por defecto es la misión espacial', () => {
    expect(DEFAULT_LOGIN_ENV).toBe('mars')
  })
})

describe('demoPassword', () => {
  it('ruok-<entorno>, o ruok-admin para los globales', () => {
    expect(demoPassword({ username: 'vega', env_id: 'mars' })).toBe('ruok-mars')
    expect(demoPassword({ username: 'admin', env_id: null })).toBe('ruok-admin')
    expect(demoPassword({ username: 'admin' })).toBe('ruok-admin')
  })
})

describe('shortDisplayName', () => {
  it('quita el entorno del final y deja el resto igual', () => {
    expect(shortDisplayName('Oficial médico (Base marciana)', 'Base marciana')).toBe(
      'Oficial médico',
    )
    expect(shortDisplayName('Cmdr. Vega', 'Base marciana')).toBe('Cmdr. Vega')
    expect(shortDisplayName('Operador', undefined)).toBe('Operador')
  })
})
