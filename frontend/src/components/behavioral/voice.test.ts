import { describe, expect, it } from 'vitest'
import voiceTexts from './voiceTexts.json'
import {
  emphasize,
  LEGACY_VOICE_KEY,
  prefFromStorage,
  runSequence,
  VOICE_KEY,
  type ClipResult,
} from './voice'

const store = (values: Record<string, string>) => (key: string) => values[key] ?? null
const noWait = () => Promise.resolve()

describe('prefFromStorage', () => {
  it('por defecto, la voz guía está encendida', () => {
    expect(prefFromStorage(store({}))).toBe(true)
  })

  it('lee la clave general', () => {
    expect(prefFromStorage(store({ [VOICE_KEY]: 'off' }))).toBe(false)
    expect(prefFromStorage(store({ [VOICE_KEY]: 'on' }))).toBe(true)
  })

  it('sin la clave general, respeta la antigua de las meditaciones', () => {
    expect(prefFromStorage(store({ [LEGACY_VOICE_KEY]: 'off' }))).toBe(false)
  })

  it('la clave general manda sobre la antigua', () => {
    expect(prefFromStorage(store({ [VOICE_KEY]: 'on', [LEGACY_VOICE_KEY]: 'off' }))).toBe(true)
  })
})

describe('runSequence', () => {
  it('dice las frases en orden y se salta las que no tienen audio', async () => {
    const said: string[] = []
    const play = async (t: string): Promise<ClipResult> => {
      if (t === 'b') return 'missing'
      said.push(t)
      return true
    }
    const ok = await runSequence(['a', 'b', 'c'], play, { cancelled: () => false, sleep: noWait })
    expect(said).toEqual(['a', 'c'])
    expect(ok).toBe(true)
  })

  it('pausa entre frases, no después de la última', async () => {
    const pauses: number[] = []
    await runSequence(['a', 'b'], async () => true, {
      cancelled: () => false,
      gapMs: 300,
      sleep: async (ms) => {
        pauses.push(ms)
      },
    })
    expect(pauses).toEqual([300])
  })

  it('para si se corta (otra voz o «Parar») y no sigue con las demás', async () => {
    const said: string[] = []
    let cut = false
    const play = async (t: string): Promise<ClipResult> => {
      said.push(t)
      if (t === 'b') {
        cut = true
        return false
      }
      return true
    }
    const ok = await runSequence(['a', 'b', 'c'], play, { cancelled: () => cut, sleep: noWait })
    expect(said).toEqual(['a', 'b'])
    expect(ok).toBe(false)
  })

  it('false si ninguna frase tiene audio', async () => {
    const ok = await runSequence(['a'], async () => 'missing', {
      cancelled: () => false,
      sleep: noWait,
    })
    expect(ok).toBe(false)
  })
})

describe('emphasize', () => {
  it('resalta lo que va entre comillas angulares, sin ellas', () => {
    expect(emphasize('Cuando diga «¡Pulsa!», toca')).toEqual([
      { text: 'Cuando diga ', strong: false },
      { text: '¡Pulsa!', strong: true },
      { text: ', toca', strong: false },
    ])
  })

  it('sin comillas, el texto tal cual', () => {
    expect(emphasize('Sin énfasis')).toEqual([{ text: 'Sin énfasis', strong: false }])
  })
})

describe('voiceTexts.json', () => {
  it('trae las instrucciones de la PVT: una entradilla y los pasos', () => {
    expect(voiceTexts.pvt.length).toBeGreaterThanOrEqual(3)
    expect(voiceTexts.pvt.every((t) => typeof t === 'string' && t.trim() !== '')).toBe(true)
  })
})
