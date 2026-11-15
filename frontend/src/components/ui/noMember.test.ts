import { describe, expect, it } from 'vitest'
import { noMemberAction } from './noMember'

describe('noMemberAction', () => {
  it('admin, medic y commander con entorno eligen member', () => {
    expect(noMemberAction('admin', 'mars')).toBe('pick')
    expect(noMemberAction('medic', 'mars')).toBe('pick')
    expect(noMemberAction('commander', 'iss')).toBe('pick')
  })

  it('admin sin entorno va a elegir entorno; un medic sin entorno no tiene adónde ir', () => {
    expect(noMemberAction('admin', null)).toBe('choose-env')
    expect(noMemberAction('medic', null)).toBe('none')
  })

  it('responder y psych van a su consola, no al selector de entornos (solo admin)', () => {
    expect(noMemberAction('responder', 'mars')).toBe('ground')
    expect(noMemberAction('psych', 'mars')).toBe('ground')
  })

  it('sin sesión, o un rol sin vista de members, no ofrece nada', () => {
    expect(noMemberAction(null, 'mars')).toBe('none')
    expect(noMemberAction('family', 'geriatric')).toBe('none')
  })
})
