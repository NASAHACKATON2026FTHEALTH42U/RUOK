import { describe, expect, it } from 'vitest'
import { buildPvtBatch, classifyResponse, randomIsi, summarize } from './pvt'

describe('randomIsi', () => {
  it('queda entre 2 y 10 s', () => {
    expect(randomIsi(() => 0)).toBe(2000)
    expect(randomIsi(() => 0.5)).toBe(6000)
    expect(randomIsi(() => 0.999999)).toBe(10000)
  })
})

describe('classifyResponse', () => {
  it('< 100 ms es falso inicio, > 500 ms es lapso', () => {
    expect(classifyResponse(80)).toBe('false_start')
    expect(classifyResponse(100)).toBe('ok')
    expect(classifyResponse(500)).toBe('ok')
    expect(classifyResponse(501)).toBe('lapse')
  })
})

describe('summarize', () => {
  it('media de las válidas, lapsos y falsos inicios', () => {
    expect(summarize([250, 300, 650, 50], 2)).toEqual({
      responses: 3,
      meanRtMs: 400,
      lapses: 1,
      falseStarts: 3,
    })
  })
  it('sin respuestas válidas: media null', () => {
    expect(summarize([], 1)).toEqual({ responses: 0, meanRtMs: null, lapses: 0, falseStarts: 1 })
  })
})

describe('buildPvtBatch', () => {
  let n = 0
  const makeId = () => `id-${++n}`

  it('dos mediciones con source pvt, misma hora y nota de resumen', () => {
    n = 0
    const batch = buildPvtBatch(
      { responses: 4, meanRtMs: 312, lapses: 1, falseStarts: 0 },
      'demo',
      't',
      makeId,
    )
    expect(batch).toEqual([
      {
        id: 'id-1',
        indicator_id: 'pvt_mean_rt_ms',
        value: 312,
        taken_at: 't',
        source: 'pvt',
        note: 'Versión demo (30 s) · 4 respuestas · 0 falsos inicios',
      },
      {
        id: 'id-2',
        indicator_id: 'pvt_lapses',
        value: 1,
        taken_at: 't',
        source: 'pvt',
        note: 'Versión demo (30 s) · 4 respuestas · 0 falsos inicios',
      },
    ])
  })

  it('acota al rango de entrada del catálogo (evita un 422)', () => {
    const batch = buildPvtBatch(
      { responses: 1, meanRtMs: 2600, lapses: 1, falseStarts: 0 },
      'full',
      't',
      makeId,
      { pvt_mean_rt_ms: { min: 100, max: 2000 } },
    )
    expect(batch[0].value).toBe(2000)
  })

  it('sin respuestas válidas no hay lote', () => {
    expect(
      buildPvtBatch(
        { responses: 0, meanRtMs: null, lapses: 0, falseStarts: 3 },
        'demo',
        't',
        makeId,
      ),
    ).toEqual([])
  })
})
