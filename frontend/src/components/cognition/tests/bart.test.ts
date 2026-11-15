import { describe, expect, it } from 'vitest'
import {
  BALLOONS,
  MAX_PUMPS,
  explosionPoints,
  optimalExpectedPerBalloon,
  pops,
  scoreBart,
} from './bart'

describe('BART', () => {
  it('genera puntos de explosión deterministas en 1..64', () => {
    const a = explosionPoints(42)
    expect(a).toHaveLength(BALLOONS)
    expect(explosionPoints(42)).toEqual(a)
    expect(explosionPoints(43)).not.toEqual(a)
    const many = explosionPoints(7, 5000)
    expect(Math.min(...many)).toBe(1)
    expect(Math.max(...many)).toBe(MAX_PUMPS)
    const mean = many.reduce((s, x) => s + x, 0) / many.length
    expect(mean).toBeGreaterThan(30)
    expect(mean).toBeLessThan(35)
  })

  it('revienta al alcanzar el punto de explosión', () => {
    expect(pops(4, 5)).toBe(false)
    expect(pops(5, 5)).toBe(true)
  })

  it('la ganancia óptima esperada es 16 por globo (cobrar a 32)', () => {
    expect(optimalExpectedPerBalloon()).toBe(16)
  })

  it('calcula métricas y puntuación', () => {
    const r = scoreBart([
      { pumps: 10, popped: false },
      { pumps: 20, popped: false },
      { pumps: 40, popped: true },
    ])
    expect(r.total_points).toBe(30)
    expect(r.adjusted_pumps).toBe(15)
    expect(r.pops).toBe(1)
    expect(r.score).toBe(Math.round((100 * 30) / 48))
  })

  it('no premia arriesgar siempre: todos explotados da 0', () => {
    const r = scoreBart(Array.from({ length: 12 }, () => ({ pumps: 60, popped: true })))
    expect(r).toMatchObject({ total_points: 0, adjusted_pumps: 0, pops: 12, score: 0 })
  })

  it('tiene tope en 100', () => {
    const r = scoreBart(Array.from({ length: 12 }, () => ({ pumps: 50, popped: false })))
    expect(r.score).toBe(100)
  })
})
