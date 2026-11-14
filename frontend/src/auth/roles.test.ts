import { describe, expect, it } from 'vitest'
import { homeFor, isValid } from './roles'

describe('homeFor', () => {
  it('cada rol llega a su vista inicial', () => {
    expect(homeFor('member')).toBe('/dashboard')
    expect(homeFor('medic')).toBe('/members')
    expect(homeFor('commander')).toBe('/members')
    expect(homeFor('responder')).toBe('/ground')
    expect(homeFor('psych')).toBe('/ground')
    expect(homeFor('admin')).toBe('/')
    expect(homeFor('family')).toBe('/dashboard')
  })
})

describe('isValid', () => {
  const now = Date.parse('2026-11-14T10:00:00Z')
  it('vigente si caduca después (con margen)', () => {
    expect(isValid('2026-11-14T22:00:00Z', now)).toBe(true)
    expect(isValid('2026-11-14T10:00:10Z', now)).toBe(false)
    expect(isValid('2026-11-14T09:00:00Z', now)).toBe(false)
  })
})
