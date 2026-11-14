import { describe, expect, it } from 'vitest'
import type { Assessment } from '../api/useAssessment'
import type { Indicator } from '../api/useIndicators'
import { applyProvisional, classify, mergeRanges, type Ranges } from './provisional'

// Mismos casos que backend/tests/test_assessment.py: front y back deben clasificar igual.
const BP: Ranges = { normal: [90, 129], warning: [130, 159], critical_low: 80, critical_high: 160 }
const SPO2: Ranges = { normal: [95, 100], warning: [90, 94], critical_low: 89 }
const MARS_BP: Ranges = { warning: [130, 140] }

describe('classify (espejo de services/assessment.py)', () => {
  it.each([
    [118, 'normal'],
    [129, 'normal'],
    [130, 'warning'],
    [159, 'warning'],
    [160, 'critical'],
    [85, 'warning'],
    [80, 'critical'],
  ])('tensión %d en la Tierra → %s', (v, expected) => {
    expect(classify(v, BP)).toBe(expected)
  })

  it('la misma tensión es crítica en Marte (override) y aviso en la Tierra', () => {
    expect(classify(150, mergeRanges(BP, MARS_BP))).toBe('critical')
    expect(classify(150, BP)).toBe('warning')
  })

  it.each([
    [97, 'normal'],
    [92, 'warning'],
    [89, 'critical'],
    [85, 'critical'],
  ])('SpO₂ %d (banda de aviso por abajo) → %s', (v, expected) => {
    expect(classify(v, SPO2)).toBe(expected)
  })

  it('sin rangos → unknown, nunca normal', () => {
    expect(classify(50, {})).toBe('unknown')
  })
})

describe('mergeRanges', () => {
  it('el override solo cambia sus claves y los null no borran el catálogo', () => {
    expect(mergeRanges(BP, { warning: [130, 140], normal: null, critical_high: null })).toEqual({
      normal: [90, 129],
      warning: [130, 140],
      critical_low: 80,
      critical_high: 160,
    })
  })
})

const indicator = (id: string, ranges: Ranges) => ({ id, ranges }) as unknown as Indicator

function assessmentWith(over: Partial<Assessment> = {}): Assessment {
  return {
    member_id: 1,
    env_id: 'mars',
    generated_at: '2026-11-14T10:00:00Z',
    overall_status: 'normal',
    liveness: 'active',
    last_seen_at: '2026-11-14T10:00:00Z',
    provisional: false,
    behavioral: null,
    systems: [
      {
        system_id: 'cardiovascular',
        status: 'normal',
        recommendations: [],
        escalation: null,
        indicators: [
          {
            indicator_id: 'bp_systolic',
            last_value: 120,
            unit: 'mmHg',
            taken_at: '2026-11-14T09:00:00Z',
            status: 'normal',
            trend: 'stable',
            baseline: null,
            range: {},
          },
        ],
      },
    ],
    ...over,
  } as unknown as Assessment
}

const catalog = [indicator('bp_systolic', BP)]
const mars = { threshold_overrides: { bp_systolic: MARS_BP } } as never

describe('applyProvisional', () => {
  it('una medición alta sin sincronizar pinta crítico y marca la evaluación como provisional', () => {
    const r = applyProvisional(
      assessmentWith(),
      [{ indicator_id: 'bp_systolic', value: 150, taken_at: '2026-11-14T11:00:00Z' }],
      catalog,
      mars,
    )
    const ind = r.assessment.systems[0].indicators[0]
    expect(ind).toMatchObject({ last_value: 150, status: 'critical' })
    expect(r.assessment.systems[0].status).toBe('critical')
    expect(r.assessment.overall_status).toBe('critical')
    expect(r.assessment.provisional).toBe(true)
    expect([...r.provisionalIds]).toEqual(['bp_systolic'])
  })

  it('usa la medición local más reciente de cada indicador', () => {
    const r = applyProvisional(
      assessmentWith(),
      [
        { indicator_id: 'bp_systolic', value: 150, taken_at: '2026-11-14T11:00:00Z' },
        { indicator_id: 'bp_systolic', value: 135, taken_at: '2026-11-14T12:00:00Z' },
      ],
      catalog,
      undefined,
    )
    expect(r.assessment.systems[0].indicators[0]).toMatchObject({
      last_value: 135,
      status: 'warning',
    })
  })

  it('una medición local más antigua que la del servidor no cambia nada', () => {
    const a = assessmentWith()
    const r = applyProvisional(
      a,
      [{ indicator_id: 'bp_systolic', value: 170, taken_at: '2026-11-14T08:00:00Z' }],
      catalog,
      mars,
    )
    expect(r.assessment).toBe(a)
    expect(r.provisionalIds.size).toBe(0)
  })

  it('sin contacto (liveness stale), el estado general no mejora respecto al del servidor', () => {
    const r = applyProvisional(
      assessmentWith({ liveness: 'stale', overall_status: 'unknown' }),
      [{ indicator_id: 'bp_systolic', value: 118, taken_at: '2026-11-14T11:00:00Z' }],
      catalog,
      undefined,
    )
    expect(r.assessment.overall_status).toBe('unknown')
  })
})
