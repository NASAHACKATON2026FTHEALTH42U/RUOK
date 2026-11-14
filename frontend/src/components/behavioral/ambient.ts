/**
 * Sonido ambiente opcional para la galería Earth view (FE-25): un rumor suave tipo oleaje
 * generado con Web Audio (ruido marrón filtrado con una ondulación lenta). Sin archivos: no
 * ocupa espacio y funciona sin internet. Nunca rompe si el navegador no tiene audio.
 */
let ctx: AudioContext | null = null
let stopFn: (() => void) | null = null

export function startAmbient(): boolean {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
    stopAmbient()
    const c = ctx
    // 4 s de ruido marrón en bucle
    const buffer = c.createBuffer(1, c.sampleRate * 4, c.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      data[i] = last * 3.5
    }
    const src = c.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = c.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 500
    // Oleaje: el volumen sube y baja cada ~8 s
    const gain = c.createGain()
    gain.gain.value = 0.12
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.12
    const lfoGain = c.createGain()
    lfoGain.gain.value = 0.06
    lfo.connect(lfoGain).connect(gain.gain)
    src.connect(filter).connect(gain).connect(c.destination)
    src.start()
    lfo.start()
    stopFn = () => {
      src.stop()
      lfo.stop()
      src.disconnect()
      gain.disconnect()
    }
    return true
  } catch {
    return false
  }
}

export function stopAmbient(): void {
  try {
    stopFn?.()
  } catch {
    // ya parado
  }
  stopFn = null
}
