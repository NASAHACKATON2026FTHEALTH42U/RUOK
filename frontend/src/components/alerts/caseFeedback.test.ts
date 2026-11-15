import { describe, expect, it } from 'vitest'
import type { Alert } from '../../api/useAlerts'
import { caseFeedback } from './caseFeedback'

const alert = (over: Partial<Alert>): Alert =>
  ({
    id: 'a',
    system_id: 'neuro_behavioral',
    severity: 'critical',
    status: 'escalated',
    target_role: 'ground',
    created_at: '2026-11-15T02:28:00Z',
    ...over,
  }) as Alert
const names = { system: 'Neuro-conductual', role: () => 'flight surgeon' }

describe('caseFeedback', () => {
  it('mejor que cuando saltó el aviso: se celebra y se explica quién lo cierra', () => {
    const f = caseFeedback([alert({})], 'neuro_behavioral', 'warning', names)
    expect(f?.tone).toBe('improving')
    expect(f?.title).toBe('Nos alegra ver que estás mejor')
    expect(f?.text).toContain('de crítico a atención')
    expect(f?.text).toContain('Flight surgeon sigue revisando tu caso')
  })

  it('igual o peor: lo están revisando', () => {
    expect(caseFeedback([alert({})], 'neuro_behavioral', 'critical', names)?.tone).toBe('reviewing')
    expect(
      caseFeedback([alert({ status: 'acknowledged' })], 'neuro_behavioral', 'critical', names)
        ?.text,
    ).toContain('ha visto tu aviso')
  })

  it('sin datos no cuenta como mejora; sin aviso abierto del sistema, nada', () => {
    expect(caseFeedback([alert({})], 'neuro_behavioral', 'unknown', names)?.tone).toBe('reviewing')
    expect(
      caseFeedback([alert({ status: 'resolved' })], 'neuro_behavioral', 'normal', names),
    ).toBeNull()
    expect(
      caseFeedback([alert({ system_id: 'eyes' })], 'neuro_behavioral', 'normal', names),
    ).toBeNull()
  })
})
