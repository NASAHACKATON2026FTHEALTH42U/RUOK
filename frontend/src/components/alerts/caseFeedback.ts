/**
 * Seguimiento de un caso abierto (FE-38): qué decirle al member mientras quien gestiona su aviso
 * lo revisa. Las alertas no se cierran solas (docs/alerts-and-escalation.md): aunque el member
 * mejore, el aviso sigue abierto hasta que lo cierra el siguiente nivel. Sin este mensaje parece
 * que medirse otra vez o seguir las recomendaciones no sirve de nada.
 */
import type { Alert } from '../../api/useAlerts'

const OPEN: readonly string[] = ['open', 'escalated', 'acknowledged']
/** Gravedad comparable (0 = lo peor); la emergencia cuenta como crítico. */
const RANK: Record<string, number> = {
  emergency: 0,
  critical: 0,
  warning: 1,
  unknown: 2,
  normal: 3,
}

/** Palabra de cada estado o gravedad, en minúscula, para las frases. */
export const STATE_WORD: Record<string, string> = {
  emergency: 'emergencia',
  critical: 'crítico',
  warning: 'atención',
  normal: 'normal',
  unknown: 'sin datos',
}

export interface CaseFeedback {
  tone: 'improving' | 'reviewing'
  title: string
  text: string
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1)

/**
 * El aviso abierto más grave de un sistema y qué decir: si el sistema está mejor que cuando saltó
 * el aviso, se celebra; si no, se explica que lo están revisando. null si no hay aviso abierto.
 */
export function caseFeedback(
  alerts: readonly Alert[],
  systemId: string,
  current: string | undefined,
  names: { system: string; role: (role: string) => string },
): CaseFeedback | null {
  const alert = alerts
    .filter((a) => a.system_id === systemId && OPEN.includes(a.status))
    .sort(
      (a, b) =>
        (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3) ||
        b.created_at.localeCompare(a.created_at),
    )[0]
  if (!alert) return null
  const who = names.role(alert.target_role)
  const improved =
    current !== undefined &&
    current !== 'unknown' &&
    (RANK[current] ?? 0) > (RANK[alert.severity] ?? 3)
  if (improved)
    return {
      tone: 'improving',
      title: 'Nos alegra ver que estás mejor',
      text: `${names.system} ha pasado de ${STATE_WORD[alert.severity] ?? alert.severity} a ${
        STATE_WORD[current] ?? current
      }. ${cap(who)} sigue revisando tu caso y cerrará el aviso cuando lo confirme.`,
    }
  return {
    tone: 'reviewing',
    title: 'Estamos revisando tu caso',
    text:
      alert.status === 'acknowledged'
        ? `${cap(who)} ha visto tu aviso y lo está revisando. Sigue las recomendaciones; si empeoras, pulsa SOS.`
        : `Tu aviso ha llegado a ${who}. Sigue las recomendaciones y vuelve a medirte; si empeoras, pulsa SOS.`,
  }
}
