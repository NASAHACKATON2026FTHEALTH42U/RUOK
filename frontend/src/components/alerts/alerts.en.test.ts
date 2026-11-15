import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Alert } from '../../api/useAlerts'
import { useLangStore } from '../../i18n/lang'
import { linkBanner } from '../ground/ground'
import {
  actorLabel,
  categoryLabel,
  eventStyle,
  isCategoryLabel,
  severityStyle,
  statusLabel,
} from './alertFormat'
import { caseFeedback } from './caseFeedback'
import { CATEGORIES, roleLabel } from './sos'
import { translate } from '../../i18n/t'

/** Las etiquetas de las alertas, en inglés (FE-38): ninguna se queda en español. */
describe('alertas en inglés', () => {
  beforeEach(() => useLangStore.getState().setLang('en'))
  afterEach(() => useLangStore.getState().setLang('es'))

  it('etiquetas de categoría, severidad, estado, evento y actor', () => {
    expect(categoryLabel('physical')).toBe('Physical discomfort')
    expect(severityStyle('warning').label).toBe('Warning')
    expect(statusLabel('acknowledged')).toBe('Acknowledged')
    expect(eventStyle('queued').label).toBe('Queued on the link')
    expect(actorLabel('responder')).toBe('response team')
    for (const c of CATEGORIES) expect(translate(c.label)).not.toBe(c.label)
  })

  it('el mensaje igual a la categoría no se repite, en cualquier idioma', () => {
    expect(isCategoryLabel('Malestar físico', 'physical')).toBe(true)
    expect(isCategoryLabel('Physical discomfort', 'physical')).toBe(true)
    expect(isCategoryLabel('Me duele', 'physical')).toBe(false)
  })

  it('rol: vocabulario del entorno o nombre por defecto traducido', () => {
    expect(roleLabel('crew', { crew: 'crew' })).toBe('crew')
    expect(roleLabel('nurse', {})).toBe('nursing')
  })

  it('seguimiento del caso y banner del enlace', () => {
    const alert = {
      system_id: 'cardio',
      status: 'acknowledged',
      severity: 'critical',
      target_role: 'crew',
      created_at: '2026-11-14T10:00:00Z',
    } as Alert
    const fb = caseFeedback([alert], 'cardio', 'normal', { system: 'Heart', role: () => 'team' })
    expect(fb?.title).toBe("We're glad to see you're better")
    expect(fb?.text).toContain('Heart has gone from critical to normal. Team is still reviewing')
    const banner = linkBanner(
      { state: 'online', delay_s: 0, queued: 0, since: null } as never,
      '2026-11-14T10:00:00Z',
      new Date('2026-11-14T10:05:00Z'),
    )
    expect(banner.text).toMatch(/^Link online\. Data as of \d\d:\d\d \(5 min ago\)\.$/)
  })
})
