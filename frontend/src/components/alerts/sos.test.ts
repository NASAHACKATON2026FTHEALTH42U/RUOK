import { describe, expect, it } from 'vitest'
import { defaultSeverity, defaultTarget, protocolAppliesTo, roleLabel, targets } from './sos'

const marte = { member: 'astronauta', crew: 'tripulación', ground: 'flight surgeon' }
const hospital = { member: 'paciente', crew: 'planta', ground: 'médico', medic: 'enfermería' }

describe('destinos', () => {
  it('sin self y por defecto el siguiente nivel', () => {
    expect(targets(['self', 'crew', 'ground'])).toEqual(['crew', 'ground'])
    expect(defaultTarget(['self', 'caregiver', 'doctor', 'family'])).toBe('caregiver')
    expect(defaultTarget(['self'])).toBeNull()
  })
})

describe('roleLabel', () => {
  it('usa el vocabulario del entorno', () => {
    expect(roleLabel('ground', marte)).toBe('flight surgeon')
    expect(roleLabel('nurse', hospital)).toBe('enfermería')
    expect(roleLabel('doctor', hospital)).toBe('médico')
  })
  it('sin vocabulario, un texto en español; nunca el slug si se conoce', () => {
    expect(roleLabel('family', marte)).toBe('familia')
    expect(roleLabel('caregiver', {})).toBe('cuidador')
    expect(roleLabel('otro', {})).toBe('otro')
  })
})

describe('defaultSeverity', () => {
  it('una emergencia es emergency; el resto empieza en warning', () => {
    expect(defaultSeverity('emergency')).toBe('emergency')
    expect(defaultSeverity('psychological')).toBe('warning')
  })
})

describe('protocolAppliesTo', () => {
  it('"Necesito hablar" solo muestra lo neuro-conductual', () => {
    expect(protocolAppliesTo('psychological', 'neuro_behavioral')).toBe(true)
    expect(protocolAppliesTo('psychological', 'cardiovascular')).toBe(false)
    expect(protocolAppliesTo('emergency', 'cardiovascular')).toBe(true)
  })
})
