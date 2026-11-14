import { describe, expect, it } from 'vitest'
import { dayProgress, formatDue, sortTasks, taskLink, withLocalCompletions } from './game'

const t = (id: string, over: Partial<Parameters<typeof taskLink>[0]> = {}) => ({
  id,
  task_type: 'measure_bp',
  points: 10,
  due: 'morning',
  completed: false,
  indicator_id: null,
  ...over,
})

describe('withLocalCompletions', () => {
  it('marca las completadas en el dispositivo y deja el resto', () => {
    const r = withLocalCompletions([t('a'), t('b')], new Set(['b']))
    expect(r.map((x) => x.completed)).toEqual([false, true])
  })
})

describe('dayProgress', () => {
  it('cuenta tareas y puntos hechos', () => {
    expect(dayProgress([t('a', { completed: true }), t('b', { points: 20 })])).toEqual({
      done: 1,
      total: 2,
      points: 10,
      totalPoints: 30,
    })
  })
})

describe('sortTasks', () => {
  it('pendientes primero y por momento del día', () => {
    const r = sortTasks([
      t('done', { completed: true }),
      t('any', { due: 'any' }),
      t('morning', { due: 'morning' }),
    ])
    expect(r.map((x) => x.id)).toEqual(['morning', 'any', 'done'])
  })
})

describe('formatDue y taskLink', () => {
  it('etiquetas y enlaces', () => {
    expect(formatDue('afternoon')).toBe('Tarde')
    expect(formatDue('night_shift')).toBe('night_shift')
    expect(taskLink(t('c', { task_type: 'checkin', indicator_id: 'mood' }))).toBe('/checkin')
    expect(taskLink(t('p', { task_type: 'pvt' }))).toBe('/pvt')
    expect(taskLink(t('m', { indicator_id: 'bp_systolic' }))).toBe('/measure?indicator=bp_systolic')
    expect(taskLink(t('x', { task_type: 'resistive_exercise' }))).toBeNull()
  })
})
