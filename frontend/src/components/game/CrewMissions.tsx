import type { CrewMission } from '../../api/useGame'
import { useT } from '../../i18n/t'
import { missionStatus } from './crew'

interface CrewMissionsProps {
  missions: CrewMission[]
  /** Member activo (para saber si ya está apuntado). */
  memberId: number | null
  /** Puede apuntarse (member o admin); el resto solo mira. */
  canJoin: boolean
  /** Misión que se está enviando ahora. */
  busyId: string | null
  onJoin: (mission: CrewMission) => void
}

/**
 * Misiones de tripulación de hoy (FE-24, docs/behavioral-health.md "Gamificación cooperativa"):
 * se completan cuando se apuntan los que hacen falta y los puntos son para todos.
 */
export function CrewMissions({ missions, memberId, canJoin, busyId, onJoin }: CrewMissionsProps) {
  const t = useT()
  return (
    <section className="hud-panel shrink-0">
      <h2 className="hud-panel-head">{t('Misiones de grupo')}</h2>
      <ul className="divide-y divide-env-border/60">
        {missions.map((m) => {
          const s = missionStatus(m, memberId)
          return (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {m.title} <span className="font-normal text-env-muted">· {m.points} pts</span>
                </p>
                <p className="text-xs text-env-muted">
                  {m.completed && <span aria-hidden>✓ </span>}
                  {s.label}
                </p>
              </div>
              {s.joined ? (
                <span className="shrink-0 text-xs text-env-muted">
                  <span aria-hidden>✓ </span>
                  {t('Apuntado')}
                </span>
              ) : (
                canJoin &&
                !m.completed && (
                  <button
                    type="button"
                    onClick={() => onJoin(m)}
                    disabled={busyId !== null}
                    className="min-h-11 shrink-0  border border-env-border px-3 text-sm hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary disabled:opacity-60"
                  >
                    {busyId === m.id ? t('Apuntando…') : t('Me apunto')}
                  </button>
                )
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
