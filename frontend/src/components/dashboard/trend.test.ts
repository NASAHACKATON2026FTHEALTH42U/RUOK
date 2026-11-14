import { describe, expect, it } from 'vitest'
import { bands, toPoints, yDomain } from './trend'

describe('toPoints', () => {
  it('ordena por fecha', () => {
    const p = toPoints([
      { taken_at: '2026-11-14T10:00:00Z', value: 2 },
      { taken_at: '2026-11-13T10:00:00Z', value: 1 },
    ])
    expect(p.map((x) => x.value)).toEqual([1, 2])
  })
})

describe('bands', () => {
  it('normal y warning, solo las que existen', () => {
    expect(bands({ normal: [90, 129], warning: [130, 159] })).toEqual([
      { kind: 'normal', y1: 90, y2: 129 },
      { kind: 'warning', y1: 130, y2: 159 },
    ])
    expect(bands({ normal: [3, 5] })).toHaveLength(1)
    expect(bands({ normal: [3] })).toHaveLength(0)
  })
})

describe('yDomain', () => {
  it('cubre datos y bandas con margen y números limpios', () => {
    const [lo, hi] = yDomain(
      [
        { t: 1, value: 118 },
        { t: 2, value: 171 },
      ],
      { normal: [90, 129], warning: [130, 159] },
    )
    expect(lo).toBeLessThanOrEqual(90)
    expect(hi).toBeGreaterThanOrEqual(171)
    expect(lo % 10).toBe(0)
    expect(hi % 10).toBe(0)
  })
  it('un único valor sin bandas no colapsa el eje', () => {
    const [lo, hi] = yDomain([{ t: 1, value: 5 }], {})
    expect(hi).toBeGreaterThan(lo)
  })
})
