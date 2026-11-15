import { afterEach, describe, expect, it } from 'vitest'
import { useLangStore } from '../../i18n/lang'
import {
  buildThread,
  cleanText,
  describeState,
  secondsLeft,
  transitProgress,
  type HomeMessage,
  type ThreadItem,
} from './homeMessages'

const T0 = '2026-11-14T10:00:00Z'
const at = (min: number) => new Date(Date.parse(T0) + min * 60_000).toISOString()

const msg = (over: Partial<HomeMessage>): HomeMessage => ({
  id: 'a',
  member_id: 1,
  direction: 'up',
  text: 'Hola',
  sender: null,
  in_reply_to: null,
  sent_at: T0,
  eta: at(14),
  delivered_at: null,
  state: 'in_transit',
  ...over,
})

const item = (over: Partial<ThreadItem>): ThreadItem => ({
  id: 'a',
  direction: 'up',
  text: 'Hola',
  sender: null,
  sentAt: T0,
  eta: at(14),
  deliveredAt: null,
  state: 'in_transit',
  ...over,
})

describe('buildThread', () => {
  it('ordena por envío y añade lo que sigue en el dispositivo', () => {
    const thread = buildThread(
      [msg({ id: 'b', sent_at: at(5) }), msg({ id: 'a' })],
      [{ id: 'c', text: 'Sin red', created_at: at(9), failed: false }],
    )
    expect(thread.map((t) => [t.id, t.state])).toEqual([
      ['a', 'in_transit'],
      ['b', 'in_transit'],
      ['c', 'local'],
    ])
  })

  it('si el servidor ya lo tiene, manda su estado y no se duplica', () => {
    const thread = buildThread(
      [msg({ id: 'a', state: 'queued' })],
      [{ id: 'a', text: 'Hola', created_at: T0, failed: false }],
    )
    expect(thread).toHaveLength(1)
    expect(thread[0].state).toBe('queued')
  })

  it('marca lo rechazado por el servidor', () => {
    const [t] = buildThread([], [{ id: 'x', text: 'Hola', created_at: T0, failed: true }])
    expect(t.state).toBe('failed')
  })
})

describe('estado de cada mensaje', () => {
  it('en tránsito: cuenta atrás hasta la ETA, también tras un fast-forward', () => {
    expect(describeState(item({}), new Date(T0)).label).toBe('En tránsito · llega en 14 min')
    expect(describeState(item({}), new Date(at(13.5))).label).toBe('En tránsito · llega en 30 s')
    expect(describeState(item({}), new Date(at(20))).label).toBe('En tránsito · llegando')
  })

  it('en cola con LOS, sin ETA que prometer', () => {
    const d = describeState(item({ state: 'queued' }), new Date(T0))
    expect(d.label).toBe('En cola · sin enlace')
    expect(d.tone).toBe('none')
  })

  it('entregado: en casa si es mío, recibido si es la respuesta', () => {
    const up = describeState(item({ state: 'delivered', deliveredAt: at(14) }), new Date(at(15)))
    expect(up.label).toMatch(/^Entregado en casa \d\d:\d\d$/)
    expect(up.tone).toBe('ok')
    const down = describeState(
      item({ direction: 'down', state: 'delivered', deliveredAt: at(40) }),
      new Date(at(41)),
    )
    expect(down.label).toMatch(/^Recibido \d\d:\d\d$/)
  })

  it('nunca da por enviado lo que sigue en el dispositivo', () => {
    const d = describeState(item({ state: 'local', eta: null }), new Date(T0))
    expect(d.label).toContain('Guardado en este dispositivo')
    expect(d.tone).toBe('none')
    expect(describeState(item({ state: 'failed', eta: null }), new Date(T0)).tone).toBe('crit')
  })
})

describe('tiempos', () => {
  it('secondsLeft no baja de cero', () => {
    expect(secondsLeft(at(1), new Date(T0))).toBe(60)
    expect(secondsLeft(at(1), new Date(at(5)))).toBe(0)
  })

  it('transitProgress va de 0 a 1', () => {
    expect(transitProgress(T0, at(10), new Date(T0))).toBe(0)
    expect(transitProgress(T0, at(10), new Date(at(5)))).toBe(0.5)
    expect(transitProgress(T0, at(10), new Date(at(30)))).toBe(1)
    expect(transitProgress(T0, T0, new Date(T0))).toBe(1) // sin retardo (Tierra)
  })
})

describe('cleanText', () => {
  it('recorta espacios, rechaza vacíos y limita a 500', () => {
    expect(cleanText('  hola  ')).toBe('hola')
    expect(cleanText('   \n ')).toBeNull()
    expect(cleanText('x'.repeat(600))).toHaveLength(500)
  })
})

describe('en inglés (FE-38)', () => {
  afterEach(() => useLangStore.getState().setLang('es'))

  it('traduce el texto del estado', () => {
    useLangStore.getState().setLang('en')
    expect(describeState(item({ state: 'queued', eta: null }), new Date(T0)).label).toBe(
      'Queued · no link',
    )
    expect(describeState(item({ state: 'local', eta: null }), new Date(T0)).label).toContain(
      'Saved on this device',
    )
  })
})
