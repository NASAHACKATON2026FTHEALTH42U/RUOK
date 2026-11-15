import { afterEach, describe, expect, it } from 'vitest'
import { EN } from './en'
import { useLangStore } from './lang'
import { translate } from './t'

afterEach(() => useLangStore.getState().setLang('es'))

describe('i18n (FE-38)', () => {
  it('en español devuelve el texto tal cual y rellena los huecos', () => {
    expect(translate('Hace {n} min', { n: 5 })).toBe('Hace 5 min')
  })

  it('en inglés usa el diccionario y, si falta, el español', () => {
    useLangStore.getState().setLang('en')
    expect(translate('Texto que no está en el diccionario')).toBe(
      'Texto que no está en el diccionario',
    )
    const [es, en] = Object.entries(EN)[0] ?? ['Ajustes', 'Ajustes']
    expect(translate(es)).toBe(en)
  })

  it('cada entrada tiene traducción y conserva los huecos {…} del español', () => {
    for (const [es, en] of Object.entries(EN)) {
      expect(en.trim(), es).not.toBe('')
      const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
      expect(holes(en), es).toBe(holes(es))
    }
  })
})
