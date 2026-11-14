import { describe, expect, it } from 'vitest'
import { canSeeDetails, linkBanner } from './ground'

const now = new Date('2026-11-14T14:20:00')
const asOf = '2026-11-14T14:19:00'

describe('linkBanner', () => {
  it('con retardo: el estado de hace N min', () => {
    const b = linkBanner({ state: 'delayed', delay_s: 840, queued: 0, since: asOf }, asOf, now)
    expect(b.tone).toBe('delayed')
    expect(b.text).toContain('Estás viendo el estado de hace 14 min')
  })
  it('LOS: DESCONOCIDO desde cuándo, nunca en vivo', () => {
    const b = linkBanner(
      { state: 'los', delay_s: 840, queued: 2, since: '2026-11-14T14:02:00' },
      asOf,
      now,
    )
    expect(b.tone).toBe('unknown')
    expect(b.text).toContain('Enlace caído desde las 14:02')
    expect(b.text).toContain('DESCONOCIDO')
  })
  it('en línea', () => {
    expect(
      linkBanner({ state: 'online', delay_s: 0, queued: 0, since: asOf }, asOf, now).tone,
    ).toBe('live')
  })
})

describe('canSeeDetails', () => {
  const psy = { category: 'psychological', severity: 'warning' }
  it('el responder no ve el detalle de una alerta psicológica', () => {
    expect(canSeeDetails(psy, 'responder', false)).toBe(false)
  })
  it('sí el psych, en emergencia o si el member comparte', () => {
    expect(canSeeDetails(psy, 'psych', false)).toBe(true)
    expect(canSeeDetails({ ...psy, severity: 'emergency' }, 'responder', false)).toBe(true)
    expect(canSeeDetails(psy, 'responder', true)).toBe(true)
  })
  it('el resto de categorías, siempre', () => {
    expect(canSeeDetails({ category: 'symptom', severity: 'warning' }, 'responder', false)).toBe(
      true,
    )
  })
})
