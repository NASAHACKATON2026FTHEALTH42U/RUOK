/**
 * Reconocimiento de emociones (FE-39): lógica pura (ensayos, geometría de la cara y puntuación),
 * separada del componente para poder testearla.
 */
export type Emotion = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral'

/** Orden de los botones; la etiqueta es el texto en español (se traduce con t()). */
export const EMOTIONS: { id: Emotion; label: string }[] = [
  { id: 'joy', label: 'Alegría' },
  { id: 'sadness', label: 'Tristeza' },
  { id: 'anger', label: 'Ira' },
  { id: 'fear', label: 'Miedo' },
  { id: 'surprise', label: 'Sorpresa' },
  { id: 'neutral', label: 'Neutral' },
]

export const TRIALS = 10
/** Tiempo de referencia para la parte de velocidad: a partir de aquí, 0 puntos de velocidad. */
export const SLOW_MS = 3000
/** Por debajo de este tiempo medio, la velocidad puntúa entera. */
export const FAST_MS = 600

export interface Trial {
  emotion: Emotion
  /** 0.45–1: lo marcada que está la expresión. */
  intensity: number
  /** Pequeña variación individual (-1..1) para que no haya dos caras iguales. */
  jitter: number
}

/** Parámetros de dibujo de la cara (unidades del viewBox 200×200). */
export interface FaceShape {
  /** Desplazamiento vertical del extremo interior / exterior de las cejas (negativo = arriba). */
  browInner: number
  browOuter: number
  /** Curvatura de la ceja (negativo = arco hacia arriba). */
  browArch: number
  /** Apertura del ojo (radio vertical). */
  eyeOpen: number
  /** Ancho de la boca. */
  mouthWidth: number
  /** Curva de la boca: positivo = comisuras arriba (sonrisa). */
  mouthCurve: number
  /** Apertura de la boca. */
  mouthOpen: number
}

const NEUTRAL: FaceShape = {
  browInner: 0,
  browOuter: 0,
  browArch: -2,
  eyeOpen: 7,
  mouthWidth: 44,
  mouthCurve: 0,
  mouthOpen: 0,
}

/** Expresión plena de cada emoción (rasgos prototípicos de Ekman, simplificados). */
const FULL: Record<Emotion, FaceShape> = {
  neutral: NEUTRAL,
  joy: {
    browInner: -2,
    browOuter: -3,
    browArch: -4,
    eyeOpen: 4.5,
    mouthWidth: 58,
    mouthCurve: 15,
    mouthOpen: 8,
  },
  sadness: {
    browInner: -9,
    browOuter: 5,
    browArch: 1,
    eyeOpen: 5.5,
    mouthWidth: 40,
    mouthCurve: -11,
    mouthOpen: 0,
  },
  anger: {
    browInner: 10,
    browOuter: -4,
    browArch: 1,
    eyeOpen: 4.5,
    mouthWidth: 38,
    mouthCurve: -4,
    mouthOpen: 2,
  },
  fear: {
    browInner: -11,
    browOuter: -4,
    browArch: 2,
    eyeOpen: 11,
    mouthWidth: 52,
    mouthCurve: -6,
    mouthOpen: 9,
  },
  surprise: {
    browInner: -14,
    browOuter: -13,
    browArch: -8,
    eyeOpen: 11.5,
    mouthWidth: 22,
    mouthCurve: 0,
    mouthOpen: 24,
  },
}

/** Forma de la cara para un ensayo: interpola desde la neutra según la intensidad. */
export function faceShape(trial: Trial): FaceShape {
  const target = FULL[trial.emotion]
  const k = trial.emotion === 'neutral' ? 0 : trial.intensity
  const j = trial.jitter
  const mix = (key: keyof FaceShape) => NEUTRAL[key] + (target[key] - NEUTRAL[key]) * k
  return {
    browInner: mix('browInner') + j * 1.2,
    browOuter: mix('browOuter') - j * 0.8,
    browArch: mix('browArch'),
    eyeOpen: Math.max(3, mix('eyeOpen') + j * 0.6),
    mouthWidth: mix('mouthWidth') + j * 3,
    mouthCurve: mix('mouthCurve') + j * 1.5,
    mouthOpen: Math.max(0, mix('mouthOpen')),
  }
}

/** Ensayos: cada emoción al menos una vez, el resto al azar, sin dos iguales seguidos. */
export function buildTrials(n = TRIALS, rng: () => number = Math.random): Trial[] {
  const ids = EMOTIONS.map((e) => e.id)
  const pool: Emotion[] = [...ids]
  while (pool.length < n) pool.push(ids[Math.floor(rng() * ids.length)]!)
  // Orden aleatorio sin dos iguales seguidos: en cada paso, una emoción distinta de la anterior
  // (si una quedara en mayoría, va primero para no forzar una repetición al final).
  const order: Emotion[] = []
  while (pool.length > 0) {
    const last = order[order.length - 1]
    const candidates = pool.map((_, i) => i).filter((i) => pool[i] !== last)
    const counts = new Map<Emotion, number>()
    for (const e of pool) counts.set(e, (counts.get(e) ?? 0) + 1)
    const urgent = candidates.find((i) => counts.get(pool[i]!)! * 2 > pool.length)
    const pick =
      urgent ??
      (candidates.length > 0
        ? candidates[Math.floor(rng() * candidates.length)]!
        : Math.floor(rng() * pool.length))
    order.push(pool[pick]!)
    pool.splice(pick, 1)
  }
  return order.slice(0, n).map((emotion) => ({
    emotion,
    intensity: 0.45 + rng() * 0.55,
    jitter: rng() * 2 - 1,
  }))
}

export interface Answer {
  correct: boolean
  rtMs: number
}

export interface EmotionScore {
  score: number
  correct: number
  total: number
  meanRtMs: number
}

/** Puntuación 0–100: 85 % precisión + 15 % velocidad (media entre 0,6 s y 3 s), esta última en proporción a los aciertos. */
export function scoreEmotion(answers: Answer[]): EmotionScore {
  const total = answers.length
  if (total === 0) return { score: 0, correct: 0, total: 0, meanRtMs: 0 }
  const correct = answers.filter((a) => a.correct).length
  const meanRtMs = Math.round(answers.reduce((s, a) => s + a.rtMs, 0) / total)
  const accuracy = correct / total
  const speed = Math.min(1, Math.max(0, (SLOW_MS - meanRtMs) / (SLOW_MS - FAST_MS)))
  // Sin aciertos no hay puntos de velocidad (pulsar al azar muy rápido no debe puntuar).
  const score = Math.round(100 * (0.85 * accuracy + 0.15 * speed * accuracy))
  return { score, correct, total, meanRtMs }
}
