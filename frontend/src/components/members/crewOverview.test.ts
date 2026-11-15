import { describe, expect, it } from 'vitest'
import {
  countLabel,
  crewCounts,
  densityFor,
  memberDisplayState,
  pickIndividual,
  sortByUrgency,
  systemsDigest,
  urgencyRank,
} from './crewOverview'

type M = Parameters<typeof sortByUrgency>[0][number] & { id: number }
const m = (
  id: number,
  name: string,
  overall_status: M['overall_status'],
  liveness: M['liveness'] = 'active',
  open_alerts = 0,
): M => ({ id, name, overall_status, liveness, open_alerts })

describe('densityFor', () => {
  it('tarjetas ricas con pocos, compactas con más y filas con muchos', () => {
    expect(densityFor(1)).toBe('rich')
    expect(densityFor(4)).toBe('rich')
    expect(densityFor(5)).toBe('compact')
    expect(densityFor(12)).toBe('compact')
    expect(densityFor(13)).toBe('rows')
  })
})

describe('memberDisplayState', () => {
  it('sin datos frescos, "normal" pasa a "sin datos" (nunca verde)', () => {
    expect(memberDisplayState({ overall_status: 'normal', liveness: 'stale' })).toBe('unknown')
    expect(memberDisplayState({ overall_status: 'normal', liveness: 'lost' })).toBe('unknown')
    expect(memberDisplayState({ overall_status: 'normal', liveness: 'active' })).toBe('normal')
  })
  it('un problema se mantiene aunque el liveness esté degradado', () => {
    expect(memberDisplayState({ overall_status: 'critical', liveness: 'lost' })).toBe('critical')
    expect(memberDisplayState({ overall_status: 'warning', liveness: 'stale' })).toBe('warning')
  })
})

describe('urgencyRank y sortByUrgency', () => {
  it('sin contacto cuenta como lo más urgente', () => {
    expect(urgencyRank({ overall_status: 'normal', liveness: 'lost' })).toBe(0)
    expect(urgencyRank({ overall_status: 'unknown', liveness: 'stale' })).toBe(2)
  })
  it('crítico, atención, sin datos y normal; a igual urgencia, más alertas y por nombre', () => {
    const list = [
      m(1, 'Zoe', 'normal'),
      m(2, 'Ana', 'warning'),
      m(3, 'Bea', 'critical', 'active', 1),
      m(4, 'Carla', 'critical', 'active', 3),
      m(5, 'Dani', 'unknown'),
      m(6, 'Eva', 'normal', 'lost'),
      m(7, 'Abel', 'warning'),
    ]
    expect(sortByUrgency(list).map((x) => x.name)).toEqual([
      'Carla',
      'Bea',
      'Eva',
      'Abel',
      'Ana',
      'Dani',
      'Zoe',
    ])
    expect(list[0].name).toBe('Zoe') // no muta la lista original
  })
})

describe('crewCounts', () => {
  it('cuenta por estado resumido, sin contacto aparte y las alertas abiertas', () => {
    const c = crewCounts([
      m(1, 'A', 'critical', 'active', 2),
      m(2, 'B', 'normal', 'lost', 1),
      m(3, 'C', 'normal'),
      m(4, 'D', 'warning', 'stale'),
    ])
    expect(c).toEqual({
      total: 4,
      byState: { critical: 1, warning: 1, unknown: 1, normal: 1 },
      lost: 1,
      openAlerts: 3,
    })
  })
})

describe('systemsDigest', () => {
  const ind = (
    indicator_id: string,
    status: 'normal' | 'warning' | 'critical' | 'unknown',
    last_value: number | null = 1,
  ) => ({
    indicator_id,
    status,
    last_value,
    unit: 'u',
  })
  it('lo que hay que mirar (lo peor primero, con su indicador), en rango y sin datos', () => {
    const d = systemsDigest([
      { system_id: 'eyes', status: 'unknown', indicators: [ind('acuity', 'unknown', null)] },
      {
        system_id: 'sleep',
        status: 'warning',
        indicators: [ind('quality', 'normal'), ind('hours', 'warning', 4.5)],
      },
      { system_id: 'heart', status: 'normal', indicators: [ind('hr', 'normal')] },
      {
        system_id: 'bones',
        status: 'critical',
        indicators: [ind('density', 'warning', 2), ind('pain', 'critical', 9), ind('x', 'warning')],
      },
      { system_id: 'muscle', status: 'normal', indicators: [] },
    ])
    expect(d.flagged).toEqual([
      {
        systemId: 'bones',
        status: 'critical',
        indicator: { id: 'pain', value: 9, unit: 'u' },
        more: 2,
      },
      {
        systemId: 'sleep',
        status: 'warning',
        indicator: { id: 'hours', value: 4.5, unit: 'u' },
        more: 0,
      },
    ])
    expect(d.inRange).toEqual(['heart', 'muscle'])
    expect(d.noData).toEqual(['eyes'])
  })
  it('un sistema en atención sin indicador fuera de rango no inventa uno', () => {
    const d = systemsDigest([{ system_id: 'neuro', status: 'warning', indicators: [] }])
    expect(d.flagged).toEqual([{ systemId: 'neuro', status: 'warning', indicator: null, more: 0 }])
  })
})

describe('pickIndividual', () => {
  const list = [m(1, 'Ana', 'normal'), m(2, 'Bea', 'critical'), m(3, 'Carla', 'warning')]
  it('el member activo si es de este entorno', () => {
    expect(pickIndividual(list, 3)).toBe(3)
  })
  it('si no (otro entorno o ninguno), el más urgente', () => {
    expect(pickIndividual(list, 99)).toBe(2)
    expect(pickIndividual(list, null)).toBe(2)
    expect(pickIndividual([], null)).toBeNull()
  })
})

describe('countLabel', () => {
  it('singular y plural', () => {
    expect(countLabel('critical', 1)).toBe('1 crítico')
    expect(countLabel('critical', 2)).toBe('2 críticos')
    expect(countLabel('normal', 3)).toBe('3 normales')
    expect(countLabel('lost', 2)).toBe('2 sin contacto')
  })
})
