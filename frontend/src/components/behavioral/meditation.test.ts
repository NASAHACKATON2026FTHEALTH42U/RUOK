import { describe, expect, it } from 'vitest'
import type { Intervention } from '../../api/useInterventions'
import { formatRemaining, meditationsOf } from './meditation'
import { playSoundscape, SOUNDSCAPES, soundscapeSupported } from './soundscapes'

const item = (id: string, category: string, duration_min: number) =>
  ({ id, title: id, category, duration_min, steps: ['x'], offline: true }) as Intervention

describe('meditación', () => {
  it('meditationsOf: solo las meditaciones, de la más corta a la más larga', () => {
    const list = [item('a', 'meditation', 5), item('b', 'stress', 4), item('c', 'meditation', 3)]
    expect(meditationsOf(list).map((i) => i.id)).toEqual(['c', 'a'])
  })

  it('formatRemaining: minutos y segundos (y horas si hace falta)', () => {
    expect(formatRemaining(0)).toBe('0:00')
    expect(formatRemaining(61_000)).toBe('1:01')
    expect(formatRemaining(20 * 60_000)).toBe('20:00')
    expect(formatRemaining(3_725_000)).toBe('1:02:05')
  })

  it('paisajes sonoros: ids únicos y, sin audio (Node), no rompe', () => {
    const ids = SOUNDSCAPES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(soundscapeSupported()).toBe(false)
    expect(playSoundscape('rain')).toBe(false)
  })
})
