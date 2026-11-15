/** Lógica pura de la sección Meditación (FE-36). */
import type { Intervention } from '../../api/useInterventions'

/** Categoría de las meditaciones guiadas en `interventions.json`. */
export const MEDITATION_CATEGORY = 'meditation'

/** Las meditaciones guiadas del catálogo, de la más corta a la más larga. */
export function meditationsOf(interventions: readonly Intervention[]): Intervention[] {
  return interventions
    .filter((i) => i.category === MEDITATION_CATEGORY)
    .sort((a, b) => a.duration_min - b.duration_min)
}

/** Temporizador del paisaje sonoro, en minutos (0 = sin límite). */
export const TIMER_OPTIONS = [0, 10, 20, 30, 45] as const

/** Tiempo que queda, "mm:ss" (o "h:mm:ss" si pasa de una hora). */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mmss = `${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`
  return h ? `${h}:${mmss}` : mmss
}
