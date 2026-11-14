import { describe, expect, it } from 'vitest'
import { formatHazard, formatTrend, formatValue } from './format'

describe('formatTrend', () => {
  it('flecha y texto para cada tendencia', () => {
    expect(formatTrend('rising')).toEqual({ arrow: '↑', label: 'Subiendo' })
    expect(formatTrend('falling').label).toBe('Bajando')
    expect(formatTrend('stable').label).toBe('Estable')
    expect(formatTrend('insufficient_data').label).toBe('Sin tendencia')
  })
})

describe('formatHazard', () => {
  it('traduce los peligros conocidos y deja el resto', () => {
    expect(formatHazard('gravity')).toBe('Gravedad alterada')
    expect(formatHazard('noise')).toBe('noise')
  })
})

describe('formatValue', () => {
  it('número con unidad y coma decimal', () => {
    expect(formatValue(142, 'mmHg')).toBe('142 mmHg')
    expect(formatValue(36.75, '°C')).toBe('36,8 °C')
  })
  it('escala 1-5', () => {
    expect(formatValue(3, '1-5')).toBe('3 / 5')
  })
  it('sin valor', () => {
    expect(formatValue(null, 'mmHg')).toBe('—')
  })
})
