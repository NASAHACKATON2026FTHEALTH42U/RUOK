import { describe, expect, it } from 'vitest'
import { activityHint, activityOptions, buildHeartbeat, detectDeviceKind } from './heartbeat'

describe('detectDeviceKind', () => {
  it('ratón → ordenador; táctil estrecho → móvil; táctil ancho → tablet', () => {
    expect(detectDeviceKind(false, 390)).toBe('desktop')
    expect(detectDeviceKind(true, 390)).toBe('mobile')
    expect(detectDeviceKind(true, 820)).toBe('tablet')
  })
})

describe('buildHeartbeat', () => {
  it('lleva device_id, actividad, outbox pendiente, última sincronización y tipo', () => {
    expect(
      buildHeartbeat({
        deviceId: 'd1',
        activity: 'eva',
        pendingOutbox: 3,
        lastSyncAt: '2026-11-14T10:00:00Z',
        deviceKind: 'mobile',
      }),
    ).toEqual({
      device_id: 'd1',
      activity: 'eva',
      pending_outbox: 3,
      last_sync_at: '2026-11-14T10:00:00Z',
      device_kind: 'mobile',
    })
  })
  it('nunca envía un pending_outbox negativo (el contrato exige >= 0)', () => {
    const hb = buildHeartbeat({
      deviceId: 'd1',
      activity: 'normal',
      pendingOutbox: -1,
      lastSyncAt: null,
      deviceKind: 'desktop',
    })
    expect(hb.pending_outbox).toBe(0)
    expect(hb.last_sync_at).toBeNull()
  })
})

describe('activityOptions', () => {
  it('EVA en el espacio, "actividad de riesgo" en la Tierra', () => {
    expect(activityOptions(true).map((o) => o.label)).toEqual(['Normal', 'EVA', 'Sueño'])
    expect(activityOptions(false)[1]).toEqual({ id: 'eva', label: 'Actividad de riesgo' })
  })
})

describe('activityHint', () => {
  const liveness = {
    stale_after_s: 300,
    lost_after_s: 900,
    eva_stale_after_s: 30,
    eva_lost_after_s: 120,
    sleep_factor: 3,
    ruok_timeout_s: 120,
    morning_checkin_by: null,
    warning_escalate_after_s: 21600,
  }

  it('usa los umbrales del perfil del entorno', () => {
    expect(activityHint('normal', true, liveness)).toContain('5 min sin dar señal')
    expect(activityHint('eva', true, liveness)).toContain('a los 30 s sin señal')
    expect(activityHint('eva', true, liveness)).toContain('a los 2 min')
    expect(activityHint('sleep', true, liveness)).toContain('×3 (15 min sin señal)')
  })

  it('EVA en el espacio; «actividad de riesgo» en la Tierra', () => {
    expect(activityHint('eva', true, liveness)).toMatch(/^Salida al exterior \(EVA\)/)
    expect(activityHint('eva', false, liveness)).toMatch(/^Actividad de riesgo/)
  })

  it('sin perfil cargado, sin números', () => {
    for (const a of ['normal', 'eva', 'sleep'] as const) {
      expect(activityHint(a, true)).not.toMatch(/\d/)
    }
  })
})
