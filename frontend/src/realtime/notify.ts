/**
 * Vibración y sonido ante una alerta (FE-29). Son opcionales y NUNCA rompen: por HTTP en la red
 * local no hay "contexto seguro" y algunos navegadores no los permiten.
 */

const SOUND_KEY = 'ruok-alert-sound'

export function vibrate(pattern: number[] = [200, 100, 200]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // no disponible
  }
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    return false
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // sin almacenamiento: solo dura esta sesión
  }
}

let ctx: AudioContext | null = null

/** Dos pitidos cortos con Web Audio (sin archivos ni CDN). Solo si el usuario lo activó. */
export function beep(): void {
  if (!soundEnabled()) return
  try {
    ctx ??= new AudioContext()
    for (const [i, freq] of [880, 660].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.value = 0.15
      osc.connect(gain).connect(ctx.destination)
      const t = ctx.currentTime + i * 0.25
      osc.start(t)
      osc.stop(t + 0.18)
    }
  } catch {
    // audio no disponible
  }
}
