import { describe, expect, it } from 'vitest'
import { breathPhase, expandSteps, stepSeconds } from './intervention'

describe('stepSeconds', () => {
  it('lee segundos y minutos del texto', () => {
    expect(stepSeconds('Inhala 4 s')).toBe(4)
    expect(stepSeconds('Camina 2 min')).toBe(120)
    expect(stepSeconds('Respira 1,5 min')).toBe(90)
    expect(stepSeconds('Escribe tres cosas buenas de hoy')).toBeNull()
  })
})

describe('expandSteps', () => {
  it('respiración en caja: 4 pasos × 4 ciclos', () => {
    const steps = expandSteps([
      'Inhala 4 s',
      'Mantén 4 s',
      'Exhala 4 s',
      'Mantén 4 s',
      'Repite 4 ciclos',
    ])
    expect(steps).toHaveLength(16)
    expect(steps[0]).toEqual({ text: 'Inhala 4 s', seconds: 4, cycle: { n: 1, of: 4 } })
    expect(steps[4]).toEqual({ text: 'Inhala 4 s', seconds: 4, cycle: { n: 2, of: 4 } })
    expect(steps[15]).toEqual({ text: 'Mantén 4 s', seconds: 4, cycle: { n: 4, of: 4 } })
  })

  it('sin repetición: los pasos tal cual, los que no tienen tiempo son manuales', () => {
    expect(expandSteps(['Siéntate cómodo', 'Respira 1 min'])).toEqual([
      { text: 'Siéntate cómodo', seconds: null, cycle: null },
      { text: 'Respira 1 min', seconds: 60, cycle: null },
    ])
  })

  it('una repetición sin pasos previos se trata como texto', () => {
    expect(expandSteps(['Repite 3 veces'])).toEqual([
      { text: 'Repite 3 veces', seconds: null, cycle: null },
    ])
  })
})

describe('breathPhase', () => {
  it('inhala, mantén y exhala', () => {
    expect(breathPhase('Inhala 4 s')).toBe('in')
    expect(breathPhase('Mantén 4 s')).toBe('hold')
    expect(breathPhase('Exhala 4 s')).toBe('out')
    expect(breathPhase('Camina 2 min')).toBeNull()
  })
})
