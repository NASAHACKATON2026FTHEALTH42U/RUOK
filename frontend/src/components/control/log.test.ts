import { describe, expect, it } from 'vitest'
import type { RealtimeEvent } from '../../realtime/match'
import { filterLog, LOG_TYPES, toneOf } from './log'

const ev = (id: number, type: RealtimeEvent['type'], member_id: number | null = 1) =>
  ({
    id,
    type,
    at: '2026-11-15T08:00:00Z',
    env_id: 'mars',
    member_id,
    user_id: null,
    device_id: null,
    ref_id: null,
    summary: type,
    payload: {},
  }) as RealtimeEvent

describe('registro del centro de control', () => {
  it('deja fuera lo ruidoso y entra lo importante', () => {
    expect(LOG_TYPES).toContain('alert.resolved')
    expect(LOG_TYPES).toContain('user.created')
    expect(LOG_TYPES).toContain('notification.sent')
    expect(LOG_TYPES).not.toContain('heartbeat')
    expect(LOG_TYPES).not.toContain('measurement.created')
  })

  it('filtra por grupo y por member', () => {
    const all = [ev(1, 'alert.created'), ev(2, 'alert.resolved', 2), ev(3, 'heartbeat')]
    expect(filterLog(all, '', null).map((e) => e.id)).toEqual([1, 2])
    expect(filterLog(all, 'resolved', null).map((e) => e.id)).toEqual([2])
    expect(filterLog(all, '', 1).map((e) => e.id)).toEqual([1])
  })

  it('lo resuelto se distingue de lo que pide atención', () => {
    expect(toneOf(ev(1, 'alert.resolved'))).toBe('resolved')
    expect(toneOf(ev(1, 'alert.created'))).toBe('attention')
    expect(toneOf(ev(1, 'user.created'))).toBe('neutral')
  })
})
