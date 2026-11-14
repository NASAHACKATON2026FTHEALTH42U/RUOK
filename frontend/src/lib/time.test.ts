import { describe, expect, it } from 'vitest'
import { formatAgo } from './time'

const now = new Date('2026-11-14T10:12:30Z')

describe('formatAgo', () => {
  it('menos de un minuto', () => {
    expect(formatAgo('2026-11-14T10:12:00Z', now)).toBe('hace menos de 1 min')
  })
  it('minutos', () => {
    expect(formatAgo('2026-11-14T10:00:00Z', now)).toBe('hace 12 min')
  })
  it('horas y minutos', () => {
    expect(formatAgo('2026-11-14T08:00:00Z', now)).toBe('hace 2 h 12 min')
    expect(formatAgo('2026-11-14T08:12:30Z', now)).toBe('hace 2 h')
  })
  it('días', () => {
    expect(formatAgo('2026-11-11T10:00:00Z', now)).toBe('hace 3 d')
  })
  it('una fecha futura (relojes desfasados) no da negativos', () => {
    expect(formatAgo('2026-11-14T11:00:00Z', now)).toBe('hace menos de 1 min')
  })
})
