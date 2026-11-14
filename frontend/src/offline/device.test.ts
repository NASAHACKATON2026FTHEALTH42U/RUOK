import { describe, expect, it } from 'vitest'
import { resolveDevice, sanitizeName, uuidFromName, type KeyValueStorage } from './device'

const mem = (): KeyValueStorage & { m: Map<string, string> } => {
  const m = new Map<string, string>()
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('resolveDevice', () => {
  it('dispositivo real: genera un id una vez y lo reutiliza', () => {
    const local = mem()
    let n = 0
    const make = () => `00000000-0000-4000-8000-00000000000${++n}`
    const a = resolveDevice('', local, mem(), make)
    const b = resolveDevice('', local, mem(), make)
    expect(a).toEqual({ id: a.id, name: null, mode: 'device' })
    expect(b.id).toBe(a.id)
  })

  it('?device=<nombre>: UUID determinista y guardado en la pestaña', () => {
    const session = mem()
    const a = resolveDevice('?device=Tablet Médico', mem(), session)
    expect(a.name).toBe('tablet-medico')
    expect(a.mode).toBe('tab')
    expect(a.id).toMatch(UUID)
    expect(a.id).toBe(uuidFromName('tablet-medico'))
    // al navegar sin el parámetro, la pestaña conserva su dispositivo
    expect(resolveDevice('', mem(), session)).toEqual(a)
  })

  it('dos nombres distintos son dispositivos distintos', () => {
    const a = resolveDevice('?device=a', mem(), mem())
    const b = resolveDevice('?device=b', mem(), mem())
    expect(a.id).not.toBe(b.id)
  })

  it('?device=tab crea un dispositivo nuevo por pestaña', () => {
    const a = resolveDevice('?device=tab', mem(), mem())
    const b = resolveDevice('?device=tab', mem(), mem())
    expect(a.id).not.toBe(b.id)
    expect(a.mode).toBe('tab')
  })
})

describe('sanitizeName', () => {
  it('normaliza acentos, espacios y longitud', () => {
    expect(sanitizeName('  Móvil A!! ')).toBe('movil-a')
    expect(sanitizeName('x'.repeat(60))).toHaveLength(40)
  })
})
