import { describe, expect, it } from 'vitest'
import { effectiveRanges, presetValue, scenariosFor, type Ranges } from './simulate'

const HR: Ranges = { normal: [60, 100], warning: [50, 120], critical_low: 40, critical_high: 140 }
const SPO2: Ranges = {
  normal: [95, 100],
  warning: [92, 100],
  critical_low: 90,
  critical_high: null,
}

describe('escenarios por entorno y member', () => {
  it('solo los del entorno y, con member, solo los suyos', () => {
    expect(scenariosFor('mars', null).map((s) => s.id)).toEqual(['mars_sleep_bp', 'eva_no_contact'])
    expect(scenariosFor('hospital', null)).toEqual([])
    expect(scenariosFor('mars', 2)).toEqual([])
    expect(scenariosFor('geriatric', 17).map((s) => s.id)).toEqual(['geriatric_fall_risk'])
  })
})

describe('valor propuesto para provocar una medición', () => {
  it('normal dentro del rango; aviso entre normal y crítico; crítico fuera', () => {
    const normal = presetValue(HR, false, 'normal')
    const warning = presetValue(HR, false, 'warning')
    const critical = presetValue(HR, false, 'critical')
    expect(normal).toBeGreaterThanOrEqual(60)
    expect(normal).toBeLessThanOrEqual(100)
    expect(warning).toBeGreaterThan(100)
    expect(warning).toBeLessThanOrEqual(120)
    expect(critical).toBeGreaterThan(140)
  })

  it('si lo malo es bajar (solo crítico bajo), va hacia abajo', () => {
    expect(presetValue(SPO2, false, 'warning')).toBeLessThan(95)
    expect(presetValue(SPO2, false, 'critical')).toBeLessThan(90)
  })

  it('respeta el mínimo, el máximo y el paso de la entrada', () => {
    const scale: Ranges = { normal: [3, 5], warning: [2, 5], critical_low: 1, critical_high: null }
    expect(presetValue(scale, false, 'critical', { min: 1, max: 5, step: 1 })).toBe(1)
  })

  it('los umbrales del entorno pisan los del indicador', () => {
    expect(effectiveRanges(HR, { normal: [50, 90] }).normal).toEqual([50, 90])
    expect(effectiveRanges(HR, null)).toBe(HR)
  })
})
