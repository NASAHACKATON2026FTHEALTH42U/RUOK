import { describe, expect, it } from 'vitest'
import { joinUrl } from './qr'

describe('joinUrl', () => {
  it('login del servidor de a bordo, sin barras dobles', () => {
    expect(joinUrl('http://192.168.8.10:8000')).toBe('http://192.168.8.10:8000/login')
    expect(joinUrl('http://192.168.8.10:8000/')).toBe('http://192.168.8.10:8000/login')
  })
})
