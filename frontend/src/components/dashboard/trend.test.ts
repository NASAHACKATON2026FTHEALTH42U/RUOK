import { describe, expect, it } from 'vitest'
import {
  bands,
  commonUnit,
  initialSlots,
  normalPct,
  toggleSlot,
  toPoints,
  yDomain,
  yTicks,
} from './trend'

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

describe('yTicks', () => {
  it('marcas redondas y equiespaciadas dentro del dominio', () => {
    expect(yTicks([40, 140])).toEqual([40, 60, 80, 100, 120, 140])
    expect(yTicks([80, 160])).toEqual([80, 100, 120, 140, 160])
  })
})

describe('gráfica con varios indicadores', () => {
  it('normalPct: posición en el rango normal (0–100 %), fuera de él por debajo o por encima', () => {
    expect(normalPct(75, { normal: [50, 100] })).toBe(50)
    expect(normalPct(40, { normal: [50, 100] })).toBe(-20)
    expect(normalPct(526, { normal: [100, 354] })).toBe(167.7)
    expect(normalPct(5, {})).toBeNull()
    expect(normalPct(5, { normal: [3, 3] })).toBeNull()
  })

  it('commonUnit: la unidad si todas coinciden; si no, null', () => {
    expect(commonUnit(['mmHg', 'mmHg'])).toBe('mmHg')
    expect(commonUnit(['lpm', 'mmHg'])).toBeNull()
    expect(commonUnit([])).toBeNull()
  })

  it('initialSlots: las pedidas (si existen) o las primeras', () => {
    expect(initialSlots(['a', 'b', 'c', 'd', 'e'], undefined, 4)).toEqual({
      a: 0,
      b: 1,
      c: 2,
      d: 3,
    })
    expect(initialSlots(['a', 'b', 'c'], ['c'], 6)).toEqual({ c: 0 })
    expect(initialSlots(['a', 'b'], ['x'], 4)).toEqual({ a: 0, b: 1 })
  })

  it('toggleSlot: los demás conservan su color; al menos una y como mucho max', () => {
    const s = { a: 0, b: 1, c: 2 }
    expect(toggleSlot(s, 'b', 6)).toEqual({ a: 0, c: 2 })
    expect(toggleSlot({ a: 0, c: 2 }, 'd', 6)).toEqual({ a: 0, c: 2, d: 1 })
    expect(toggleSlot({ a: 0 }, 'a', 6)).toEqual({ a: 0 })
    expect(toggleSlot({ a: 0, b: 1 }, 'c', 2)).toEqual({ a: 0, b: 1 })
  })
})
