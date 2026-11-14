import { describe, expect, it } from 'vitest'
import { answeredCount, buildCheckinBatch, CHECKIN_INDICATORS, faceFor } from './checkin'

describe('faceFor', () => {
  it('más es mejor: 1 triste, 5 contento', () => {
    expect(faceFor(1, false)).toBe('😞')
    expect(faceFor(5, false)).toBe('😄')
  })
  it('más es peor (estrés, soledad): la escala se invierte', () => {
    expect(faceFor(1, true)).toBe('😄')
    expect(faceFor(5, true)).toBe('😞')
    expect(faceFor(3, true)).toBe('😐')
  })
  it('acota valores fuera de 1–5', () => {
    expect(faceFor(0, false)).toBe('😞')
    expect(faceFor(9, false)).toBe('😄')
  })
})

describe('answeredCount', () => {
  it('cuenta solo las respondidas', () => {
    expect(answeredCount({ mood: 4, stress: 2 }, CHECKIN_INDICATORS)).toBe(2)
    expect(answeredCount({}, CHECKIN_INDICATORS)).toBe(0)
  })
})

describe('buildCheckinBatch', () => {
  let n = 0
  const makeId = () => `id-${++n}`

  it('una medición por respuesta, con source checkin, misma hora y nota', () => {
    n = 0
    const batch = buildCheckinBatch(
      { mood: 4, loneliness: 2 },
      CHECKIN_INDICATORS,
      '  día largo  ',
      '2026-11-14T10:00:00.000Z',
      makeId,
    )
    expect(batch).toEqual([
      {
        id: 'id-1',
        indicator_id: 'mood',
        value: 4,
        taken_at: '2026-11-14T10:00:00.000Z',
        source: 'checkin',
        note: 'día largo',
      },
      {
        id: 'id-2',
        indicator_id: 'loneliness',
        value: 2,
        taken_at: '2026-11-14T10:00:00.000Z',
        source: 'checkin',
        note: 'día largo',
      },
    ])
  })

  it('sin nota → null; respeta el orden de las preguntas', () => {
    const batch = buildCheckinBatch(
      { crew_relation: 5, mood: 3 },
      CHECKIN_INDICATORS,
      '   ',
      't',
      makeId,
    )
    expect(batch.map((m) => m.indicator_id)).toEqual(['mood', 'crew_relation'])
    expect(batch.every((m) => m.note === null)).toBe(true)
  })
})
