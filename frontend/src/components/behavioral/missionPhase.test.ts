import { describe, expect, it } from 'vitest'
import { missionPhase } from './missionPhase'

// 100 días exactos: del 1 de enero al 10 de abril de 2027 (ambos incluidos).
const mission = { start: '2027-01-01', end: '2027-04-10' }
const at = (iso: string) => new Date(iso)

describe('missionPhase', () => {
  it('antes del inicio', () => {
    expect(missionPhase(mission, at('2026-12-30T12:00:00Z'))).toEqual({
      status: 'before',
      daysToStart: 2,
      totalDays: 100,
    })
  })

  it('primer día: día 1, primer cuarto', () => {
    const p = missionPhase(mission, at('2027-01-01T00:00:00Z'))
    expect(p).toMatchObject({ status: 'active', day: 1, totalDays: 100, daysLeft: 99, quarter: 1 })
  })

  it('mitad exacta: entra en el tercer cuarto', () => {
    const p = missionPhase(mission, at('2027-02-20T00:00:00Z')) // día 51
    expect(p).toMatchObject({ status: 'active', day: 51, quarter: 3 })
    expect(p?.status === 'active' && p.progress).toBe(0.5)
  })

  it('justo antes de la mitad: aún segundo cuarto', () => {
    expect(missionPhase(mission, at('2027-02-19T23:59:00Z'))).toMatchObject({ quarter: 2 })
  })

  it('al 75 %: cuarto cuarto', () => {
    expect(missionPhase(mission, at('2027-03-17T00:00:00Z'))).toMatchObject({ quarter: 4 })
  })

  it('el último día cuenta como misión activa; el siguiente, terminada', () => {
    expect(missionPhase(mission, at('2027-04-10T23:00:00Z'))).toMatchObject({
      status: 'active',
      day: 100,
      daysLeft: 0,
      quarter: 4,
    })
    expect(missionPhase(mission, at('2027-04-11T00:00:00Z'))).toEqual({
      status: 'ended',
      totalDays: 100,
    })
  })

  it('fechas inválidas → null', () => {
    expect(missionPhase({ start: 'x', end: '2027-01-01' }, at('2027-01-01T00:00:00Z'))).toBeNull()
    expect(missionPhase({ start: '2027-02-01', end: '2027-01-01' }, new Date())).toBeNull()
  })
})
