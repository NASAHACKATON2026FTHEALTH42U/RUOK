import { describe, expect, it } from 'vitest'
import { fanAngles, LINE_TRIALS, levelFor, makeTrial, scoreLine } from './line'

describe('orientación de líneas (FE-39)', () => {
  it('el abanico tiene 9–11 líneas a 15–18° y sin orientaciones repetidas', () => {
    for (let i = 0; i < LINE_TRIALS; i++) {
      const level = levelFor(i)
      const angles = fanAngles(level)
      expect(angles.length).toBeGreaterThanOrEqual(9)
      expect(angles.length).toBeLessThanOrEqual(11)
      expect(level.step).toBeGreaterThanOrEqual(15)
      expect(level.step).toBeLessThanOrEqual(18)
      expect(Math.min(...angles)).toBeGreaterThan(0)
      expect(Math.max(...angles)).toBeLessThan(180)
    }
  })

  it('la dificultad crece: líneas más juntas y objetivo más corto', () => {
    expect(levelFor(9).step).toBeLessThan(levelFor(0).step)
    expect(levelFor(9).length).toBeLessThan(levelFor(0).length)
  })

  it('la respuesta está en el abanico y no se repite seguida', () => {
    const rng = () => 0
    const first = makeTrial(0, null, rng)
    const second = makeTrial(1, first.answer, rng)
    expect(second.answer).not.toBe(first.answer)
    expect(second.answer).toBeLessThan(second.angles.length)
  })

  it('puntúa 85 % aciertos + 15 % rapidez frente a 5 s', () => {
    expect(scoreLine([])).toEqual({ score: 0, correct: 0, total: 0, meanRtMs: 0 })
    const all = Array.from({ length: 10 }, () => ({ correct: true, rtMs: 0 }))
    expect(scoreLine(all).score).toBe(100)
    const half = Array.from({ length: 10 }, (_, i) => ({ correct: i < 5, rtMs: 2500 }))
    expect(scoreLine(half)).toEqual({ score: 50, correct: 5, total: 10, meanRtMs: 2500 })
    const slow = Array.from({ length: 10 }, () => ({ correct: true, rtMs: 9000 }))
    expect(scoreLine(slow).score).toBe(85)
  })
})
