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

describe('pasos en inglés (FE-38)', () => {
  it('duraciones, repeticiones y fases', () => {
    expect(stepSeconds('Hold your breath for 4 seconds')).toBe(4)
    expect(stepSeconds('Walk 2 minutes')).toBe(120)
    expect(expandSteps(['Inhale 4 s', 'Repeat 2 cycles']).map((s) => s.cycle)).toEqual([
      { n: 1, of: 2 },
      { n: 2, of: 2 },
    ])
    expect(breathPhase('Breathe in through your nose')).toBe('in')
    expect(breathPhase('Inhale 4 s')).toBe('in')
    expect(breathPhase('Exhale slowly')).toBe('out')
    expect(breathPhase('Breathe out 6 s')).toBe('out')
    expect(breathPhase('Hold 4 s')).toBe('hold')
    expect(breathPhase('Keep your lungs empty for 4 seconds')).toBe('hold')
    expect(breathPhase('Walk 2 minutes')).toBeNull()
  })
})
