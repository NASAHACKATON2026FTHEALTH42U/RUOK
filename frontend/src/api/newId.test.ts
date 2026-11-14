import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId, UUID_V4_RE } from './newId'

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('genera UUID v4 válidos y distintos', () => {
    const ids = Array.from({ length: 1000 }, newId)
    for (const id of ids) expect(id).toMatch(UUID_V4_RE)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('funciona sin contexto seguro (sin crypto.randomUUID)', () => {
    // Simula un móvil que entra por http://192.168.x.x: getRandomValues sí, randomUUID no.
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
    })
    expect(newId()).toMatch(UUID_V4_RE)
  })
})
