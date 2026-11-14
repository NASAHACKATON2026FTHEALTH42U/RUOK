import { describe, expect, it } from 'vitest'
import type { RealtimeEvent } from '../../realtime/match'
import { EMPTY_FILTERS, filterEvents, formatDuration, groupOf, mergeEvents } from './feed'

const ev = (id: number, over: Partial<RealtimeEvent> = {}): RealtimeEvent =>
  ({
    id,
    type: 'alert.created',
    at: '',
    env_id: 'mars',
    member_id: 1,
    user_id: 7,
    device_id: 'd1',
    ref_id: null,
    summary: '',
    payload: {},
    ...over,
  }) as RealtimeEvent

describe('mergeEvents', () => {
  it('sin duplicados, del más reciente al más antiguo y con tope', () => {
    const r = mergeEvents([ev(2), ev(1)], [ev(3), ev(2)], 2)
    expect(r.map((e) => e.id)).toEqual([3, 2])
  })
})

describe('filterEvents', () => {
  const list = [
    ev(1),
    ev(2, { env_id: 'moon' }),
    ev(3, { type: 'measurement.created', user_id: 9, device_id: 'd2' }),
  ]
  it('sin filtros, todo', () => {
    expect(filterEvents(list, EMPTY_FILTERS)).toHaveLength(3)
  })
  it('por entorno, usuario, dispositivo y grupo', () => {
    expect(filterEvents(list, { ...EMPTY_FILTERS, envId: 'moon' }).map((e) => e.id)).toEqual([2])
    expect(filterEvents(list, { ...EMPTY_FILTERS, userId: '9' }).map((e) => e.id)).toEqual([3])
    expect(filterEvents(list, { ...EMPTY_FILTERS, deviceId: 'd2' }).map((e) => e.id)).toEqual([3])
    expect(filterEvents(list, { ...EMPTY_FILTERS, group: 'alert' }).map((e) => e.id)).toEqual([
      1, 2,
    ])
  })
})

describe('groupOf / formatDuration', () => {
  it('grupo del tipo', () => {
    expect(groupOf('link.state_changed')).toBe('link')
  })
  it('duraciones', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(200)).toBe('3 min 20 s')
    expect(formatDuration(120)).toBe('2 min')
  })
})
