import { describe, expect, it } from 'vitest'
import {
  advance,
  digitMs,
  generateSequence,
  initialState,
  isReverse,
  MAX_LENGTH,
  scoreFromSpan,
  type SpanState,
} from './digits'

function run(results: boolean[]): SpanState {
  let s = initialState()
  for (const ok of results) s = advance(s, ok)
  return s
}

describe('generateSequence', () => {
  it('genera la longitud pedida, con dígitos 0–9 y sin repeticiones seguidas', () => {
    for (let n = 0; n < 200; n++) {
      const seq = generateSequence(10)
      expect(seq).toHaveLength(10)
      seq.forEach((d, i) => {
        expect(d).toBeGreaterThanOrEqual(0)
        expect(d).toBeLessThanOrEqual(9)
        if (i > 0) expect(d).not.toBe(seq[i - 1])
      })
    }
  })

  it('no repite aunque el azar sea fijo', () => {
    for (const r of [0, 0.5, 0.9999]) {
      const seq = generateSequence(6, () => r)
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1])
    }
  })
})

describe('isReverse', () => {
  it('acepta solo la serie invertida', () => {
    expect(isReverse([3, 1, 4], [4, 1, 3])).toBe(true)
    expect(isReverse([3, 1, 4], [3, 1, 4])).toBe(false)
    expect(isReverse([3, 1, 4], [4, 1])).toBe(false)
  })
})

describe('advance', () => {
  it('sube de longitud si al menos uno de los dos intentos es correcto', () => {
    const s = run([false, true])
    expect(s).toMatchObject({ length: 4, trial: 0, span: 3, trials: 2, correct: 1, done: false })
  })

  it('acaba con dos fallos en la misma longitud', () => {
    const s = run([true, true, false, false])
    expect(s).toMatchObject({ span: 3, trials: 4, correct: 2, done: true })
  })

  it('sin superar ninguna longitud, el span es 0', () => {
    expect(run([false, false])).toMatchObject({ span: 0, done: true })
  })

  it('acaba en la longitud máxima', () => {
    const s = run(Array(2 * (MAX_LENGTH - 2)).fill(true))
    expect(s).toMatchObject({ span: MAX_LENGTH, done: true })
  })
})

describe('scoreFromSpan y ritmo', () => {
  it('3 → 20 … 9+ → 100', () => {
    expect(scoreFromSpan(0)).toBe(0)
    expect(scoreFromSpan(3)).toBe(20)
    expect(scoreFromSpan(6)).toBe(60)
    expect(scoreFromSpan(9)).toBe(100)
    expect(scoreFromSpan(10)).toBe(100)
  })

  it('va algo más rápido en series largas', () => {
    expect(digitMs(3)).toBe(900)
    expect(digitMs(10)).toBeLessThan(900)
    expect(digitMs(10)).toBeGreaterThanOrEqual(700)
  })
})
