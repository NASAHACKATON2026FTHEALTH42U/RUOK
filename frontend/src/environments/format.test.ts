import { describe, expect, it } from 'vitest'
import { formatDelay, formatGravity, formatKind } from './format'

describe('formatKind', () => {
  it('traduce el tipo de entorno', () => {
    expect(formatKind('space')).toBe('Espacio')
    expect(formatKind('earth')).toBe('Tierra')
  })
})

describe('formatGravity', () => {
  it('marca la microgravedad', () => {
    expect(formatGravity(0)).toBe('0 g · microgravedad')
  })
  it('usa coma decimal', () => {
    expect(formatGravity(0.38)).toBe('0,38 g')
    expect(formatGravity(1)).toBe('1 g')
  })
})

describe('formatDelay', () => {
  it('sin retardo en la Tierra', () => {
    expect(formatDelay(0)).toBe('Sin retardo')
  })
  it('por debajo de 5 s es tiempo real (Luna)', () => {
    expect(formatDelay(1)).toBe('≈1 s · tiempo real')
  })
  it('a partir de 5 s es diferido', () => {
    expect(formatDelay(5)).toBe('5 s · diferido')
  })
  it('en minutos para Marte', () => {
    expect(formatDelay(840)).toBe('14 min · diferido')
  })
})
