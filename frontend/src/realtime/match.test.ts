import { describe, expect, it } from 'vitest'
import { isNew, matches, streamUrl, type RealtimeEvent } from './match'

const ev = (over: Partial<RealtimeEvent>): RealtimeEvent =>
  ({
    id: 1,
    type: 'alert.created',
    at: '',
    env_id: 'mars',
    member_id: 1,
    user_id: null,
    device_id: null,
    ref_id: null,
    summary: '',
    payload: {},
    ...over,
  }) as RealtimeEvent

describe('matches', () => {
  it('tipos exactos y con comodín', () => {
    expect(matches(ev({ type: 'alert.escalated' }), { types: ['alert.*'] })).toBe(true)
    expect(matches(ev({ type: 'heartbeat' }), { types: ['alert.*'] })).toBe(false)
    expect(matches(ev({ type: 'link.state_changed' }), { types: ['link.state_changed'] })).toBe(
      true,
    )
  })
  it('filtra por member y entorno', () => {
    expect(matches(ev({ member_id: 2 }), { types: ['alert.*'], memberId: 1 })).toBe(false)
    expect(matches(ev({ env_id: 'moon' }), { types: ['alert.*'], envId: 'mars' })).toBe(false)
    expect(matches(ev({ member_id: null }), { types: ['alert.*'], memberId: 1 })).toBe(true)
  })
  it('el tic del polling refresca todo', () => {
    expect(matches(null, { types: ['alert.*'], memberId: 1 })).toBe(true)
  })
})

describe('isNew', () => {
  it('ignora ids ya vistos', () => {
    expect(isNew(5, 4)).toBe(true)
    expect(isNew(4, 4)).toBe(false)
  })
})

describe('streamUrl', () => {
  it('token y entorno en la query', () => {
    expect(streamUrl('', 'a b', 'mars')).toBe('/api/v1/events/stream?token=a+b&env_id=mars')
  })
})
