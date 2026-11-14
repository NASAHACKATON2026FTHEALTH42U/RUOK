import { describe, expect, it } from 'vitest'
import { describeLink, formatDelay } from './link'

const base = { delay_s: 0, queued: 0, since: '2026-11-14T14:02:00' }

describe('describeLink', () => {
  it('en línea', () => {
    expect(describeLink({ ...base, state: 'online' })).toEqual({
      icon: '●',
      short: 'En línea',
      long: 'en línea',
    })
  })
  it('con retardo y cola', () => {
    expect(describeLink({ ...base, state: 'delayed', delay_s: 840, queued: 2 }).long).toBe(
      'con retardo · 14 min · 2 en cola',
    )
  })
  it('sin enlace: desde cuándo', () => {
    expect(describeLink({ ...base, state: 'los' }).long).toBe('sin enlace (LOS) desde las 14:02')
  })
  it('sin datos: desconocido, nunca el último estado', () => {
    expect(describeLink(null).long).toBe('estado desconocido')
  })
})

describe('formatDelay', () => {
  it('segundos y minutos', () => {
    expect(formatDelay(1.3)).toBe('1 s')
    expect(formatDelay(840)).toBe('14 min')
  })
})
