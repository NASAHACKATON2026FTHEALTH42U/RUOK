import { describe, expect, it } from 'vitest'
import { cellKey, makePuzzles, PUZZLE_COUNT, scoreOf } from './matrix'

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1)

describe('matrix reasoning generator', () => {
  it('is deterministic given a seed', () => {
    expect(makePuzzles(42)).toEqual(makePuzzles(42))
    expect(makePuzzles(42)).not.toEqual(makePuzzles(43))
  })

  it('every puzzle has exactly one correct option and distinct distractors', () => {
    for (const seed of SEEDS) {
      const puzzles = makePuzzles(seed)
      expect(puzzles).toHaveLength(PUZZLE_COUNT)
      for (const p of puzzles) {
        expect(p.grid).toHaveLength(9)
        expect(p.options.length).toBeGreaterThanOrEqual(4)
        expect(p.options.length).toBeLessThanOrEqual(6)
        const answerKey = cellKey(p.grid[8])
        const keys = p.options.map(cellKey)
        expect(new Set(keys).size).toBe(keys.length)
        expect(keys.filter((k) => k === answerKey)).toHaveLength(1)
        expect(keys[p.answer]).toBe(answerKey)
      }
    }
  })

  it('difficulty grows from 1 rule to 3 rules', () => {
    const puzzles = makePuzzles(7)
    const ruleCount = (i: number) =>
      Object.values(puzzles[i].rules).filter((r) => r !== 'const').length
    expect(ruleCount(0)).toBe(1)
    expect(ruleCount(PUZZLE_COUNT - 1)).toBe(3)
  })

  it('rules hold across rows and columns', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      for (const p of makePuzzles(seed)) {
        const at = (r: number, c: number) => p.grid[r * 3 + c]
        for (const attr of ['shape', 'count', 'fill'] as const) {
          const rule = p.rules[attr]
          for (let r = 0; r < 3; r++) {
            const row = [0, 1, 2].map((c) => at(r, c)[attr])
            const col = [0, 1, 2].map((c) => at(c, r)[attr])
            if (rule === 'const' || rule === 'row') expect(new Set(row).size).toBe(1)
            if (rule === 'const' || rule === 'col') expect(new Set(col).size).toBe(1)
            if (rule === 'diag' || rule === 'anti') {
              expect(new Set(row).size).toBe(3)
              expect(new Set(col).size).toBe(3)
            }
          }
        }
      }
    }
  })

  it('scores accuracy (80) plus speed (20 vs 20 s)', () => {
    expect(scoreOf(8, 8, 0)).toBe(100)
    expect(scoreOf(8, 8, 20_000)).toBe(80)
    expect(scoreOf(4, 8, 10_000)).toBe(50)
    expect(scoreOf(0, 8, 40_000)).toBe(0)
    expect(scoreOf(0, 0, 0)).toBe(0)
  })
})
