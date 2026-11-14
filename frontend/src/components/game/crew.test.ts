import { describe, expect, it } from 'vitest'
import { cleanKudos, memberName, missionStatus, type CrewMissionLike } from './crew'

const mission = (over: Partial<CrewMissionLike>): CrewMissionLike => ({
  id: 'group_game',
  title: 'Juego de grupo',
  points: 40,
  min_participants: 3,
  participants: [],
  completed: false,
  ...over,
})

describe('missionStatus', () => {
  it('cuenta los apuntados y los que faltan', () => {
    expect(missionStatus(mission({}), 1)).toEqual({
      joined: false,
      missing: 3,
      label: '0/3 apuntados · faltan 3',
    })
    const s = missionStatus(mission({ participants: [1, 2] }), 1)
    expect(s.joined).toBe(true)
    expect(s.label).toBe('2/3 apuntados · falta 1')
  })

  it('completada: los puntos son para todos', () => {
    const s = missionStatus(mission({ participants: [1, 2, 4], completed: true }), 5)
    expect(s.joined).toBe(false)
    expect(s.label).toBe('Completada · +40 puntos para todos')
  })

  it('sin member activo nadie está apuntado', () => {
    expect(missionStatus(mission({ participants: [1] }), null).joined).toBe(false)
  })
})

describe('memberName', () => {
  const names = new Map([[2, 'Ing. Okafor']])
  it('tú, el nombre o «alguien»', () => {
    expect(memberName(1, names, 1)).toBe('tú')
    expect(memberName(2, names, 1)).toBe('Ing. Okafor')
    expect(memberName(9, names, 1)).toBe('alguien')
  })
})

describe('cleanKudos', () => {
  it('recorta, rechaza vacíos y limita a 200', () => {
    expect(cleanKudos('  ¡Gracias!  ')).toBe('¡Gracias!')
    expect(cleanKudos('  ')).toBeNull()
    expect(cleanKudos('x'.repeat(300))).toHaveLength(200)
  })
})
