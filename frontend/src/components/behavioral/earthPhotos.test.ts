import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EARTH_PHOTOS, step } from './earthPhotos'

const publicDir = fileURLToPath(new URL('../../../public', import.meta.url))

describe('EARTH_PHOTOS', () => {
  it('cada foto está empaquetada en public/ (funciona sin internet)', () => {
    for (const p of EARTH_PHOTOS) expect(existsSync(publicDir + p.src), p.src).toBe(true)
  })
  it('ninguna foto apunta fuera de la app', () => {
    for (const p of EARTH_PHOTOS) expect(p.src.startsWith('/earth/')).toBe(true)
  })
})

describe('step', () => {
  it('avanza y retrocede dando la vuelta', () => {
    expect(step(5, 1, 6)).toBe(0)
    expect(step(0, -1, 6)).toBe(5)
    expect(step(2, 1, 6)).toBe(3)
  })
})
