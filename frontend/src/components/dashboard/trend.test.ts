import { describe, expect, it } from 'vitest'
import { forecastByIndicator } from '../../api/mocks/fixtures.gen'
import {
  bands,
  commonUnit,
  forecastNote,
  forecastSummary,
  initialSlots,
  normalPct,
  toggleSlot,
  toPoints,
  withForecast,
  yDomain,
  yTicks,
  type Forecast,
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

/**
 * Tensión de Vega tras el escenario `mars_sleep_bp`: en atención y subiendo hacia crítico.
 * Parte de la previsión de ejemplo de los mocks (generada con el contrato) y fija aquí todo lo
 * que miran los tests: si el contrato gana un campo, estos datos lo siguen llevando.
 */
const FORECAST: Forecast = {
  ...forecastByIndicator.bp_systolic,
  member_id: 1,
  indicator_id: 'bp_systolic',
  unit: 'mmHg',
  status: 'ok',
  horizon_days: 7,
  step_days: 1,
  history_days: 30,
  current_status: 'warning',
  points: [
    { at: '2026-11-16T06:00:00Z', value: 138.6, low: 128.89, high: 148.31, status: 'warning' },
    { at: '2026-11-17T06:00:00Z', value: 139.88, low: 126.14, high: 153.62, status: 'warning' },
    { at: '2026-11-18T06:00:00Z', value: 140.9, low: 124.08, high: 157.73, status: 'critical' },
  ],
  change: { status: 'critical', at: '2026-11-18T06:00:00Z', in_days: 3 },
  backtest_mae: 9.13,
  last_value_unusual: false,
}
const NO_FORECAST: Forecast = {
  ...FORECAST,
  status: 'insufficient_data',
  step_days: null,
  history_days: 5,
  points: [],
  change: null,
  backtest_mae: null,
}
const HISTORY = toPoints([
  { taken_at: '2026-11-13T06:00:00Z', value: 133 },
  { taken_at: '2026-11-14T06:00:00Z', value: 135 },
  { taken_at: '2026-11-15T06:00:00Z', value: 137 },
])

describe('withForecast', () => {
  it('una sola serie: lo medido con `value`; lo previsto con `forecast` y su banda, sin `value`', () => {
    const rows = withForecast(HISTORY, FORECAST)
    expect(rows).toHaveLength(6)
    expect(rows.slice(0, 2)).toEqual(HISTORY.slice(0, 2))
    for (const r of rows.slice(3)) expect(r.value).toBeUndefined()
    expect(rows[3]).toEqual({
      t: Date.parse('2026-11-16T06:00:00Z'),
      forecast: 138.6,
      band: [128.89, 148.31],
    })
    expect(rows.map((r) => r.t)).toEqual([...rows.map((r) => r.t)].sort((a, b) => a - b))
  })

  it('la línea prevista (y su banda) arranca en el último punto medido', () => {
    const joint = withForecast(HISTORY, FORECAST)[2]
    expect(joint).toEqual({ ...HISTORY[2], forecast: 137, band: [137, 137] })
  })

  it('sin previsión que dibujar devuelve los mismos puntos', () => {
    expect(withForecast(HISTORY, null)).toBe(HISTORY)
    expect(withForecast(HISTORY, undefined)).toBe(HISTORY)
    expect(withForecast(HISTORY, NO_FORECAST)).toBe(HISTORY)
    expect(withForecast(HISTORY, { ...FORECAST, status: 'stale' })).toBe(HISTORY)
    expect(withForecast(HISTORY, { ...FORECAST, points: [] })).toBe(HISTORY)
  })

  it('descarta lo previsto que no es posterior al último dato (previsión anterior a esa medición)', () => {
    const newer = [...HISTORY, { t: Date.parse('2026-11-17T06:00:00Z'), value: 141 }]
    const rows = withForecast(newer, FORECAST)
    expect(rows.filter((r) => r.value === undefined).map((r) => r.forecast)).toEqual([140.9])
    const latest = [...HISTORY, { t: Date.parse('2026-11-19T06:00:00Z'), value: 141 }]
    expect(withForecast(latest, FORECAST)).toBe(latest)
  })

  it('sin mediciones en el periodo quedan solo los puntos previstos', () => {
    const rows = withForecast([], FORECAST)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.value === undefined && r.band !== undefined)).toBe(true)
  })
})

describe('yDomain con previsión', () => {
  const range = { normal: [90, 129], warning: [130, 140] }

  it('cubre los valores esperados y su intervalo: nada queda cortado', () => {
    const [lo, hi] = yDomain(withForecast(HISTORY, FORECAST), range)
    expect(lo).toBeLessThanOrEqual(90)
    expect(hi).toBeGreaterThanOrEqual(157.73)
    // Sin previsión, el eje es el de siempre (más corto).
    expect(yDomain(HISTORY, range)[1]).toBeLessThan(hi)
  })

  it('un intervalo que llega a 0 no lleva el eje a valores negativos', () => {
    const sleep: Forecast = {
      ...FORECAST,
      points: [{ at: '2026-11-16T06:00:00Z', value: 1.9, low: 0, high: 5.5, status: 'critical' }],
    }
    const rows = withForecast([{ t: Date.parse('2026-11-15T06:00:00Z'), value: 3.5 }], sleep)
    const [lo, hi] = yDomain(rows, { normal: [7, 10], warning: [4, 6.9] })
    expect(lo).toBe(0)
    expect(hi).toBeGreaterThanOrEqual(10)
  })
})

describe('forecastSummary', () => {
  it('cambio a un estado peor', () => {
    expect(forecastSummary(FORECAST)).toEqual({
      tone: 'worse',
      text: 'A este ritmo, el valor esperado pasaría a «Crítico» en ~3 días.',
    })
    const toWarning: Forecast = {
      ...FORECAST,
      current_status: 'normal',
      change: { status: 'warning', at: '2026-11-16T06:00:00Z', in_days: 1 },
    }
    expect(forecastSummary(toWarning)).toEqual({
      tone: 'worse',
      text: 'A este ritmo, el valor esperado pasaría a «Atención» en ~1 día.',
    })
  })

  it('cambio a un estado mejor', () => {
    const better: Forecast = {
      ...FORECAST,
      current_status: 'warning',
      change: { status: 'normal', at: '2026-11-17T06:00:00Z', in_days: 2 },
    }
    expect(forecastSummary(better)).toEqual({
      tone: 'better',
      text: 'A este ritmo, el valor esperado volvería a «Normal» en ~2 días.',
    })
    const lessBad: Forecast = {
      ...FORECAST,
      current_status: 'critical',
      change: { status: 'warning', at: '2026-11-16T06:00:00Z', in_days: 1 },
    }
    expect(forecastSummary(lessBad)).toEqual({
      tone: 'better',
      text: 'A este ritmo, el valor esperado bajaría a «Atención» en ~1 día.',
    })
  })

  it('sin cambio de estado en el horizonte', () => {
    expect(forecastSummary({ ...FORECAST, change: null })).toEqual({
      tone: 'steady',
      text: 'El valor esperado seguiría en «Atención» los próximos 7 días.',
    })
    expect(
      forecastSummary({ ...FORECAST, change: null, current_status: 'normal', horizon_days: 14 }),
    ).toEqual({
      tone: 'steady',
      text: 'El valor esperado seguiría en «Normal» los próximos 14 días.',
    })
    expect(forecastSummary({ ...FORECAST, change: null, horizon_days: 1 }).text).toBe(
      'El valor esperado seguiría en «Atención» el próximo día.',
    )
  })

  it('con el estado actual desconocido no se nombra ningún estado', () => {
    expect(forecastSummary({ ...FORECAST, change: null, current_status: 'unknown' })).toEqual({
      tone: 'steady',
      text: 'Sin cambios de estado previstos en los próximos 7 días.',
    })
  })

  it('con la última medición inusual no anuncia ningún cambio: espera a que se repita', () => {
    const odd: Forecast = {
      ...FORECAST,
      current_status: 'critical',
      last_value_unusual: true,
      change: null,
    }
    expect(forecastSummary(odd)).toEqual({
      tone: 'unusual',
      text: 'El último valor se sale de lo habitual: la previsión espera a que se repita para seguirlo.',
    })
    // Sin previsión no hay nada que matizar: manda el motivo por el que no la hay.
    expect(forecastSummary({ ...NO_FORECAST, last_value_unusual: true }).tone).toBe('none')
  })

  it('sin previsión explica por qué (sin datos = desconocido)', () => {
    expect(forecastSummary(NO_FORECAST)).toEqual({
      tone: 'none',
      text: 'Aún no hay datos suficientes para prever: hacen falta al menos 7 mediciones regulares.',
    })
    expect(forecastSummary({ ...NO_FORECAST, status: 'stale' })).toEqual({
      tone: 'none',
      text: 'Sin mediciones recientes: registra una nueva para ver la previsión.',
    })
  })
})

describe('forecastNote', () => {
  it('estimación, días de mediciones y error reciente en la unidad del indicador', () => {
    expect(forecastNote(FORECAST)).toBe(
      'Estimación estadística, no es un diagnóstico · basada en 30 días de mediciones · error medio reciente ±9,1 mmHg',
    )
  })

  it('omite las partes sin dato', () => {
    expect(forecastNote({ ...FORECAST, backtest_mae: null })).toBe(
      'Estimación estadística, no es un diagnóstico · basada en 30 días de mediciones',
    )
    expect(forecastNote({ ...FORECAST, backtest_mae: null, history_days: 0 })).toBe(
      'Estimación estadística, no es un diagnóstico',
    )
  })

  it('escalas 1-5 en puntos; un error pequeño no se queda en «±0»', () => {
    const mood: Forecast = { ...FORECAST, unit: '1-5', backtest_mae: 0.42 }
    expect(forecastNote(mood)).toContain('error medio reciente ±0,4 puntos')
    expect(forecastNote({ ...mood, backtest_mae: 0.02 })).toContain('±0,02 puntos')
    expect(forecastNote({ ...mood, backtest_mae: 0 })).toContain('±0 puntos')
  })
})
