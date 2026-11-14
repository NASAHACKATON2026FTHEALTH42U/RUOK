import { describe, expect, it } from 'vitest'
import { backoffMs, classify, isDue } from './backoff'

describe('backoffMs', () => {
  it('exponencial con tope de 60 s', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([2000, 4000, 8000, 16000])
    expect(backoffMs(20)).toBe(60000)
  })
})

describe('classify', () => {
  it('2xx (incluido duplicado) se da por enviado', () => {
    expect(classify(200)).toBe('done')
    expect(classify(201)).toBe('done')
  })
  it('sin red y errores temporales se reintentan', () => {
    for (const s of [0, 408, 429, 500, 503]) expect(classify(s)).toBe('retry')
  })
  it('un 401 pausa y nunca borra', () => {
    expect(classify(401)).toBe('pause')
  })
  it('otros 4xx quedan como fallidos (409 = mismo id con contenido distinto)', () => {
    expect(classify(409)).toBe('failed')
    expect(classify(422)).toBe('failed')
  })
})

describe('isDue', () => {
  it('solo pendientes cuyo reintento ya llegó', () => {
    const now = Date.parse('2026-11-14T10:00:00Z')
    expect(isDue({ status: 'pending', next_retry_at: '2026-11-14T09:59:00Z' }, now)).toBe(true)
    expect(isDue({ status: 'pending', next_retry_at: '2026-11-14T10:01:00Z' }, now)).toBe(false)
    expect(isDue({ status: 'failed', next_retry_at: '2026-11-14T09:00:00Z' }, now)).toBe(false)
  })
})
