import { describe, expect, it } from 'vitest'
import {
  countdown,
  escalationTargets,
  mergeMemberAlerts,
  severityStyle,
  sortAlerts,
} from './alertFormat'

describe('escalationTargets', () => {
  it('solo niveles por encima del actual, sin self', () => {
    expect(escalationTargets(['self', 'crew', 'ground'], 'self')).toEqual(['crew', 'ground'])
    expect(escalationTargets(['self', 'crew', 'ground'], 'crew')).toEqual(['ground'])
    expect(escalationTargets(['self', 'crew', 'ground'], 'ground')).toEqual([])
    expect(escalationTargets(['self', 'caregiver', 'doctor', 'family'], 'caregiver')).toEqual([
      'doctor',
      'family',
    ])
  })
})

describe('countdown', () => {
  const now = Date.parse('2026-11-14T10:00:00Z')
  it('minutos y segundos hasta la ETA', () => {
    expect(countdown('2026-11-14T10:14:00Z', now)).toBe('14:00')
    expect(countdown('2026-11-14T10:00:05Z', now)).toBe('0:05')
    expect(countdown('2026-11-14T11:02:03Z', now)).toBe('1:02:03')
  })
  it('null si la ETA ya pasó', () => {
    expect(countdown('2026-11-14T09:59:00Z', now)).toBeNull()
  })
})

describe('severityStyle', () => {
  it('emergency se pinta como crítico, nunca verde', () => {
    expect(severityStyle('emergency').status).toBe('critical')
    expect(severityStyle('warning').status).toBe('warning')
  })
})

describe('sortAlerts', () => {
  it('abiertas y graves primero, resueltas al final', () => {
    const list = [
      {
        id: 'a',
        status: 'resolved',
        severity: 'emergency' as const,
        created_at: '2026-11-14T12:00:00Z',
      },
      { id: 'b', status: 'open', severity: 'warning' as const, created_at: '2026-11-14T11:00:00Z' },
      {
        id: 'c',
        status: 'escalated',
        severity: 'critical' as const,
        created_at: '2026-11-14T10:00:00Z',
      },
    ]
    expect(sortAlerts(list).map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('mergeMemberAlerts', () => {
  const a = (
    id: string,
    severity: 'warning' | 'critical' | 'emergency',
    status = 'open',
    at = '2026-11-14T10:00:00Z',
  ) => ({
    id,
    severity,
    status,
    created_at: at,
  })

  it('junta las alertas de todos los members con su nombre, las graves primero', () => {
    const merged = mergeMemberAlerts([
      { memberId: 1, memberName: 'Vega', alerts: [a('v1', 'warning')] },
      {
        memberId: 2,
        memberName: 'Okafor',
        alerts: [a('o1', 'emergency'), a('o2', 'critical', 'resolved')],
      },
      { memberId: 3, memberName: 'Haddad', alerts: [] },
    ])
    expect(merged.map((x) => [x.id, x.memberName])).toEqual([
      ['o1', 'Okafor'],
      ['v1', 'Vega'],
      ['o2', 'Okafor'],
    ])
    expect(merged[1].memberId).toBe(1)
  })

  it('sin members o sin alertas, lista vacía', () => {
    expect(mergeMemberAlerts([])).toEqual([])
    expect(mergeMemberAlerts([{ memberId: 1, memberName: 'Vega', alerts: [] }])).toEqual([])
  })
})
