import { describe, expect, it } from 'vitest'
import { activityOptions, buildHeartbeat, detectDeviceKind } from './heartbeat'

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
