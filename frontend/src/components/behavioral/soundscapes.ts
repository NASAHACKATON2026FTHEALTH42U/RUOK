/**
 * Paisajes sonoros de la sección Meditación (FE-36), generados en el navegador con Web Audio:
 * sin archivos (no ocupan espacio, no dependen de internet ni de licencias) y en bucle sin
 * cortes. Sin AudioWorklet, que exige HTTPS: los móviles entran por HTTP en la red local.
 * Nunca rompe la app: si el navegador no tiene audio, las funciones devuelven false.
 */

export type SoundscapeId = 'ocean' | 'rain' | 'wind' | 'forest' | 'fire' | 'bowl'

export const SOUNDSCAPES: readonly { id: SoundscapeId; name: string; description: string }[] = [
  { id: 'ocean', name: 'Océano', description: 'Olas lentas en la orilla' },
  { id: 'rain', name: 'Lluvia', description: 'Lluvia suave y constante' },
  { id: 'wind', name: 'Viento', description: 'Una brisa que va y viene' },
  { id: 'forest', name: 'Bosque', description: 'Hojas y pájaros a lo lejos' },
  { id: 'fire', name: 'Hoguera', description: 'Un fuego que crepita' },
  { id: 'bowl', name: 'Cuenco', description: 'Un tono cálido y sostenido' },
]

type Stop = () => void
type Noise = 'white' | 'pink' | 'brown'

let ctx: AudioContext | null = null
let master: GainNode | null = null
// Entre los paisajes y el volumen general: baja el paisaje mientras habla la voz guía.
let duck: GainNode | null = null
// Salida de la voz guía (FE-37): pasa por el volumen general, pero no por `duck`.
let voice: GainNode | null = null
let current: { id: SoundscapeId; out: GainNode; stop: Stop } | null = null
let volume = 0.6
const buffers = new Map<Noise, AudioBuffer>()

/** El contexto de audio (se crea al primer uso, siempre tras un gesto del usuario). */
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = volume
      master.connect(ctx.destination)
      duck = ctx.createGain()
      duck.connect(master)
      voice = ctx.createGain()
      voice.gain.value = 1.3
      voice.connect(master)
      // Safari 17+: que suene aunque el iPhone tenga el interruptor de silencio.
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
      if (session) session.type = 'playback'
    }
    void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 8 s de ruido blanco, rosa (Paul Kellet) o marrón, generado una vez y reutilizado. */
function noise(c: AudioContext, kind: Noise): AudioBuffer {
  const cached = buffers.get(kind)
  if (cached) return cached
  const length = c.sampleRate * 8
  const buffer = c.createBuffer(1, length, c.sampleRate)
  const d = buffer.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  let last = 0
  for (let i = 0; i < length; i++) {
    const w = Math.random() * 2 - 1
    if (kind === 'white') d[i] = w
    else if (kind === 'brown') {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else {
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
  }
  buffers.set(kind, buffer)
  return buffer
}

/** Ruido en bucle, empezando en un punto al azar (para que dos capas no coincidan). */
function loop(c: AudioContext, kind: Noise): AudioBufferSourceNode {
  const src = c.createBufferSource()
  src.buffer = noise(c, kind)
  src.loop = true
  src.start(0, Math.random() * 7)
  return src
}

function filter(c: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = q
  return f
}

function gain(c: AudioContext, value: number) {
  const g = c.createGain()
  g.gain.value = value
  return g
}

/** Oscilador lento que mueve un parámetro (oleaje, ráfagas): valor ± profundidad. */
function lfo(c: AudioContext, frequency: number, depth: number, target: AudioParam) {
  const osc = c.createOscillator()
  osc.frequency.value = frequency
  const g = gain(c, depth)
  osc.connect(g).connect(target)
  osc.start()
  return osc
}

/** Llama a `fn` cada cierto tiempo al azar entre `min` y `max` ms, hasta que se pare. */
function every(min: number, max: number, fn: () => void): Stop {
  let timer = 0
  let alive = true
  const tick = () => {
    if (!alive) return
    try {
      fn()
    } catch {
      // un evento suelto que falle no para el paisaje
    }
    timer = window.setTimeout(tick, min + Math.random() * (max - min))
  }
  timer = window.setTimeout(tick, min)
  return () => {
    alive = false
    window.clearTimeout(timer)
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Ráfaga corta de ruido filtrado (gota, chasquido) con envolvente rápida. */
function burst(
  c: AudioContext,
  out: AudioNode,
  type: BiquadFilterType,
  frequency: number,
  peak: number,
  length: number,
) {
  const t = c.currentTime
  const src = c.createBufferSource()
  src.buffer = noise(c, 'white')
  const f = filter(c, type, frequency, 2.5)
  const g = gain(c, 0)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + length)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 7, length + 0.02)
}

/** Construye cada paisaje sobre `out` y devuelve cómo pararlo. */
const BUILD: Record<SoundscapeId, (c: AudioContext, out: GainNode) => Stop> = {
  // Ruido marrón grave con una ondulación lenta (las olas) y algo de espuma.
  ocean: (c, out) => {
    const waves = gain(c, 0.55)
    const swell = lfo(c, 0.09, 0.4, waves.gain)
    const sea = loop(c, 'brown')
    sea
      .connect(filter(c, 'lowpass', 520))
      .connect(waves)
      .connect(out)
    const foam = gain(c, 0.04)
    const foamSwell = lfo(c, 0.09, 0.035, foam.gain)
    const spray = loop(c, 'white')
    spray
      .connect(filter(c, 'bandpass', 2500, 0.6))
      .connect(foam)
      .connect(out)
    return () => [sea, spray, swell, foamSwell].forEach((n) => n.stop())
  },
  // Lluvia de fondo (ruido rosa filtrado) y gotas sueltas.
  rain: (c, out) => {
    const bed = loop(c, 'pink')
    bed
      .connect(filter(c, 'highpass', 500))
      .connect(filter(c, 'lowpass', 9000))
      .connect(gain(c, 0.35))
      .connect(out)
    const stopDrops = every(25, 90, () =>
      burst(c, out, 'bandpass', rand(2500, 6000), rand(0.04, 0.16), 0.06),
    )
    return () => {
      stopDrops()
      bed.stop()
    }
  },
  // Ruido rosa por un filtro que sube y baja despacio (ráfagas) y un fondo grave.
  wind: (c, out) => {
    const band = filter(c, 'bandpass', 520, 0.9)
    const sweep = lfo(c, 0.05, 280, band.frequency)
    const gust = gain(c, 0.5)
    const gusts = lfo(c, 0.07, 0.3, gust.gain)
    const air = loop(c, 'pink')
    air.connect(band).connect(gust).connect(out)
    const low = loop(c, 'brown')
    low
      .connect(filter(c, 'lowpass', 200))
      .connect(gain(c, 0.15))
      .connect(out)
    return () => [air, low, sweep, gusts].forEach((n) => n.stop())
  },
  // Hojas (ruido suave), un fondo grave y trinos de pájaro a ratos, a izquierda o derecha.
  forest: (c, out) => {
    const leaves = gain(c, 0.06)
    const rustle = lfo(c, 0.2, 0.03, leaves.gain)
    const air = loop(c, 'pink')
    air
      .connect(filter(c, 'bandpass', 3000, 0.5))
      .connect(leaves)
      .connect(out)
    const low = loop(c, 'brown')
    low
      .connect(filter(c, 'lowpass', 400))
      .connect(gain(c, 0.08))
      .connect(out)
    const stopBirds = every(1800, 5200, () => {
      const pan = c.createStereoPanner ? c.createStereoPanner() : null
      if (pan) {
        pan.pan.value = rand(-0.7, 0.7)
        pan.connect(out)
      }
      const notes = 2 + Math.floor(Math.random() * 4)
      const f0 = rand(2200, 3800)
      for (let n = 0; n < notes; n++) {
        const t = c.currentTime + n * rand(0.11, 0.16)
        const osc = c.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(f0, t)
        osc.frequency.exponentialRampToValueAtTime(f0 * rand(1.2, 1.6), t + 0.07)
        const g = gain(c, 0)
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.07, t + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
        osc.connect(g).connect(pan ?? out)
        osc.start(t)
        osc.stop(t + 0.1)
      }
    })
    return () => {
      stopBirds()
      ;[air, low, rustle].forEach((n) => n.stop())
    }
  },
  // Rumor grave que respira y chasquidos sueltos.
  fire: (c, out) => {
    const roar = gain(c, 0.35)
    const flicker = lfo(c, 0.3, 0.1, roar.gain)
    const base = loop(c, 'brown')
    base
      .connect(filter(c, 'lowpass', 280))
      .connect(roar)
      .connect(out)
    const stopCrackles = every(40, 260, () => {
      const count = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i++)
        burst(c, out, 'highpass', rand(1500, 3500), rand(0.06, 0.25), rand(0.004, 0.015))
    })
    return () => {
      stopCrackles()
      ;[base, flicker].forEach((n) => n.stop())
    }
  },
  // Tono sostenido de cuenco: unos parciales suaves con un leve trémolo.
  bowl: (c, out) => {
    const body = gain(c, 1)
    const tremolo = lfo(c, 0.15, 0.08, body.gain)
    body.connect(out)
    const partials = [
      [196, 0.12],
      [392.8, 0.05],
      [588.9, 0.03],
      [785.5, 0.015],
    ].map(([f, g]) => {
      const osc = c.createOscillator()
      osc.frequency.value = f
      osc.connect(gain(c, g)).connect(body)
      osc.start()
      return osc
    })
    return () => [...partials, tremolo].forEach((n) => n.stop())
  },
}

/** ¿Hay audio en este navegador? */
export function soundscapeSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext,
    )
  )
}

/** Empieza (o cambia a) un paisaje con un fundido. false si no hay audio. */
export function playSoundscape(id: SoundscapeId): boolean {
  const c = audio()
  if (!c || !master) return false
  if (current?.id === id) return true
  try {
    stopSoundscape(1200)
    const out = gain(c, 0)
    out.connect(duck ?? master)
    const stop = BUILD[id](c, out)
    out.gain.setValueAtTime(0, c.currentTime)
    out.gain.linearRampToValueAtTime(1, c.currentTime + 1.5)
    current = { id, out, stop }
    return true
  } catch {
    return false
  }
}

/** Para el paisaje que suena, con un fundido de `fadeMs` (el temporizador usa uno largo). */
export function stopSoundscape(fadeMs = 1200): void {
  const playing = current
  current = null
  if (!playing || !ctx) return
  try {
    const t = ctx.currentTime
    playing.out.gain.cancelScheduledValues(t)
    playing.out.gain.setValueAtTime(playing.out.gain.value, t)
    playing.out.gain.linearRampToValueAtTime(0, t + fadeMs / 1000)
  } catch {
    // ya parado
  }
  window.setTimeout(() => {
    try {
      playing.stop()
      playing.out.disconnect()
    } catch {
      // ya parado
    }
  }, fadeMs + 100)
}

/** Volumen general (0–1). */
export function setSoundscapeVolume(value: number): void {
  volume = Math.max(0, Math.min(1, value))
  if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05)
}

/** Campana de cuenco: marca el inicio, cada paso y el final de una meditación guiada. */
export function playBell(): void {
  const c = audio()
  if (!c || !master) return
  try {
    const t = c.currentTime
    const partials: [number, number, number][] = [
      [220, 0.22, 6],
      [607.2, 0.1, 4],
      [1188, 0.05, 2.5],
    ]
    for (const [f, peak, decay] of partials) {
      const osc = c.createOscillator()
      osc.frequency.value = f
      const g = gain(c, 0)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(peak, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      osc.connect(g).connect(master)
      osc.start(t)
      osc.stop(t + decay + 0.1)
    }
  } catch {
    // sin campana no pasa nada
  }
}

/** Baja el paisaje mientras habla la voz guía (y lo vuelve a subir), con un fundido corto. */
export function duckSoundscape(on: boolean): void {
  if (!ctx || !duck) return
  duck.gain.setTargetAtTime(on ? 0.3 : 1, ctx.currentTime, 0.25)
}

/** Contexto de audio y salida para la voz guía (null si no hay audio). */
export function voiceOutput(): { ctx: AudioContext; out: GainNode } | null {
  const c = audio()
  return c && voice ? { ctx: c, out: voice } : null
}
