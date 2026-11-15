import { describe, expect, it } from 'vitest'
import { segments } from './rangeScale'

describe('RangeScale (tramos)', () => {
  it('frecuencia cardiaca: crítico, aviso, normal, aviso y crítico en orden', () => {
    const r = { normal: [50, 100], warning: [101, 130], critical_low: 40, critical_high: 130 }
    const order = segments(r, [30, 150]).map((s) => s.status)
    expect(order[0]).toBe('critical')
    expect(order).toContain('normal')
    expect(order[order.length - 1]).toBe('critical')
  })

  it('SpO2: por debajo de 90 crítico y 95–100 normal', () => {
    const r = { normal: [95, 100], warning: [90, 94], critical_low: 90, critical_high: null }
    const segs = segments(r, [85, 100])
    expect(segs[0].status).toBe('critical')
    expect(segs[segs.length - 1].status).toBe('normal')
  })
})
