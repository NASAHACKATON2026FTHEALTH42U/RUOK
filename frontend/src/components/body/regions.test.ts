import { describe, expect, it } from 'vitest'
import { buildRegions, formatSinceLabel, isFigureStale } from './regions'

const systems = [
  { id: 'cardiovascular', name: 'Cardiovascular', svg_region: 'heart' },
  { id: 'musculoskeletal', name: 'Musculoesquelético', svg_region: 'bones' },
  { id: 'radiation', name: 'Radiación', svg_region: 'halo' },
  { id: 'otro', name: 'Otro', svg_region: 'tail' },
]

describe('buildRegions', () => {
  it('cruza la región del catálogo con el estado de la evaluación', () => {
    const r = buildRegions(systems, [
      { system_id: 'cardiovascular', status: 'warning' },
      { system_id: 'radiation', status: 'critical' },
    ])
    expect(r.find((x) => x.region === 'heart')?.status).toBe('warning')
    expect(r.find((x) => x.region === 'halo')?.status).toBe('critical')
  })

  it('un sistema sin evaluación es unknown (nunca verde)', () => {
    const r = buildRegions(systems, [])
    expect(r.find((x) => x.region === 'bones')?.status).toBe('unknown')
  })

  it('ignora regiones que la figura no dibuja', () => {
    expect(buildRegions(systems, []).map((x) => x.systemId)).not.toContain('otro')
  })
})

describe('isFigureStale', () => {
  it('stale y lost apagan la figura; active no', () => {
    expect(isFigureStale('active')).toBe(false)
    expect(isFigureStale('stale')).toBe(true)
    expect(isFigureStale('lost')).toBe(true)
  })
})

describe('formatSinceLabel', () => {
  const now = new Date('2026-11-14T10:12:30Z')
  it('en minutos', () => {
    expect(formatSinceLabel('2026-11-14T10:00:00Z', now)).toBe('Sin datos desde hace 12 min')
  })
  it('en horas', () => {
    expect(formatSinceLabel('2026-11-14T08:00:00Z', now)).toBe('Sin datos desde hace 2 h 12 min')
  })
  it('sin fecha', () => {
    expect(formatSinceLabel(null, now)).toBe('Sin datos')
  })
})
