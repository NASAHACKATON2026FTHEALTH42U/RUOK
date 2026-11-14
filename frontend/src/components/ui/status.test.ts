import { describe, expect, it } from 'vitest'
import { bySeverity, livenessState, STATUS_COLORS, statusStyle, type DisplayState } from './status'

const ALL: DisplayState[] = ['normal', 'warning', 'critical', 'unknown', 'stale', 'lost']

describe('statusStyle', () => {
  it('unknown, stale y lost nunca van en el color nominal y van rayados', () => {
    for (const s of ['unknown', 'stale', 'lost'] as const) {
      expect(statusStyle(s).color).not.toBe(STATUS_COLORS.normal)
      expect(statusStyle(s).striped).toBe(true)
    }
  })

  it('solo normal usa el color nominal (cian)', () => {
    const nominal = ALL.filter((s) => statusStyle(s).color === STATUS_COLORS.normal)
    expect(nominal).toEqual(['normal'])
  })

  it('cada estado tiene etiqueta y símbolo (no depende solo del color)', () => {
    for (const s of ALL) {
      expect(statusStyle(s).label.length).toBeGreaterThan(0)
      expect(statusStyle(s).glyph).toBeTruthy()
    }
  })

  it('estados distintos se distinguen sin color (etiqueta + símbolo)', () => {
    const keys = ALL.map((s) => `${statusStyle(s).label}|${statusStyle(s).glyph}`)
    expect(new Set(keys).size).toBe(ALL.length)
  })
})

describe('livenessState', () => {
  it('active no se señala; stale y lost sí', () => {
    expect(livenessState('active')).toBeNull()
    expect(livenessState('stale')).toBe('stale')
    expect(livenessState('lost')).toBe('lost')
  })
})

describe('bySeverity', () => {
  it('crítico, atención, sin datos y normal', () => {
    const list = ['normal', 'unknown', 'critical', 'warning'] as const
    expect([...list].sort(bySeverity)).toEqual(['critical', 'warning', 'unknown', 'normal'])
  })
})
