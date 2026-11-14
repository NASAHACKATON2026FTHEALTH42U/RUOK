/**
 * Fase de misión (FE-21, docs/behavioral-health.md): progreso a partir de `environment.mission`
 * y detección del "tercer cuarto", el bajón de moral observado en misiones largas
 * (Mars-500, [S10] en docs/sources.md).
 */

export interface Mission {
  /** Fecha de inicio `YYYY-MM-DD` (incluida). */
  start: string
  /** Fecha de fin `YYYY-MM-DD` (incluida). */
  end: string
}

export type MissionPhase =
  | { status: 'before'; daysToStart: number; totalDays: number }
  | {
      status: 'active'
      /** Día de misión, empezando en 1. */
      day: number
      totalDays: number
      daysLeft: number
      /** 0–1. */
      progress: number
      /** 1–4. */
      quarter: 1 | 2 | 3 | 4
    }
  | { status: 'ended'; totalDays: number }

const DAY_MS = 86_400_000

/** `YYYY-MM-DD` → medianoche UTC (las fechas del contrato no llevan hora ni zona). */
function parseDay(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/**
 * Dónde está la misión en `now` (usa `serverNow()`: la demo acelera el reloj).
 * `null` si las fechas no son válidas.
 */
export function missionPhase(mission: Mission, now: Date): MissionPhase | null {
  const start = parseDay(mission.start)
  const endExclusive = parseDay(mission.end) + DAY_MS
  if (!Number.isFinite(start) || !Number.isFinite(endExclusive) || endExclusive <= start) {
    return null
  }
  const totalDays = Math.round((endExclusive - start) / DAY_MS)
  const t = now.getTime()
  if (t < start)
    return { status: 'before', daysToStart: Math.ceil((start - t) / DAY_MS), totalDays }
  if (t >= endExclusive) return { status: 'ended', totalDays }

  const progress = (t - start) / (endExclusive - start)
  const day = Math.floor((t - start) / DAY_MS) + 1
  return {
    status: 'active',
    day,
    totalDays,
    daysLeft: totalDays - day,
    progress,
    quarter: (Math.min(Math.floor(progress * 4), 3) + 1) as 1 | 2 | 3 | 4,
  }
}
