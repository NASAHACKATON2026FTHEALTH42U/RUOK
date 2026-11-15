import { describe, expect, it } from 'vitest'
import { buildTrials, EMOTIONS, faceShape, scoreEmotion, TRIALS } from './emotion'

/** Generador determinista para los tests. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('reconocimiento de emociones (FE-39)', () => {
  it('genera 10 ensayos con todas las emociones y sin dos iguales seguidos', () => {
    for (let seed = 1; seed < 50; seed++) {
      const trials = buildTrials(TRIALS, seeded(seed))
      expect(trials).toHaveLength(TRIALS)
      for (const e of EMOTIONS) expect(trials.some((t) => t.emotion === e.id)).toBe(true)
      for (let i = 1; i < trials.length; i++) {
        expect(trials[i]!.emotion).not.toBe(trials[i - 1]!.emotion)
      }
      for (const t of trials) {
        expect(t.intensity).toBeGreaterThanOrEqual(0.45)
        expect(t.intensity).toBeLessThanOrEqual(1)
      }
    }
  })

  it('la cara alegre sonríe y la triste no', () => {
    const joy = faceShape({ emotion: 'joy', intensity: 1, jitter: 0 })
    const sad = faceShape({ emotion: 'sadness', intensity: 1, jitter: 0 })
    expect(joy.mouthCurve).toBeGreaterThan(0)
    expect(sad.mouthCurve).toBeLessThan(0)
  })

  it('puntúa la precisión (85 %) y la velocidad (15 %)', () => {
    const all = (correct: boolean, rtMs: number) =>
      Array.from({ length: 10 }, () => ({ correct, rtMs }))
    expect(scoreEmotion(all(true, 500)).score).toBe(100)
    expect(scoreEmotion(all(true, 4000)).score).toBe(85)
    expect(scoreEmotion(all(false, 500)).score).toBe(0)
    expect(scoreEmotion([])).toEqual({ score: 0, correct: 0, total: 0, meanRtMs: 0 })
    const half = [...all(true, 1000).slice(0, 5), ...all(false, 1000).slice(0, 5)]
    const s = scoreEmotion(half)
    expect(s.correct).toBe(5)
    expect(s.meanRtMs).toBe(1000)
    expect(s.score).toBeGreaterThan(42)
    expect(s.score).toBeLessThan(50)
  })
})
