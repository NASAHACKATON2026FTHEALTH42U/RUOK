/**
 * Tests cognitivos (FE-39), inspirados en la batería «Cognition» de la NASA. Cada test es un
 * componente que se monta a pantalla completa y, al acabar, llama a `onFinish` con su resultado.
 * Son **orientativos**: no son una prueba clínica ni crean alertas.
 */
export type CognitiveTestId = 'emotion' | 'line' | 'matrix' | 'bart' | 'digits'

export interface CognitiveResult {
  /** Puntuación principal en 0–100 (más es mejor), para comparar entre sesiones. */
  score: number
  /** Texto corto del resultado ya traducido (p. ej. «8 de 10 aciertos · 1,2 s de media»). */
  summary: string
  /** Métricas extra del test (aciertos, tiempo medio en ms…), por si se quieren ver luego. */
  metrics: Record<string, number>
}

export interface CognitiveTestProps {
  /** Se llama una vez, al terminar el test. */
  onFinish: (result: CognitiveResult) => void
  /** Salir sin terminar. */
  onCancel: () => void
}
