import type { Leaderboard } from '../../api/useGame'
import { capitalize } from '../../environments/useVocab'
import { dateLocale } from '../../i18n/lang'
import { useT } from '../../i18n/t'
import { AnimatedNumber } from './AnimatedNumber'

interface CrewBoardProps {
  board: Leaderboard
  crewWord: string
  /** Member actual, para resaltarlo. */
  memberId: number | null
}

/**
 * Tablero cooperativo (FE-18, docs/vision-and-scope.md): lo importante es el total de la
 * tripulación; cada barra es lo que aporta cada uno. Sin puestos ni medallas: no compiten
 * entre ellos. Orden alfabético para no sugerir un ranking.
 */
export function CrewBoard({ board, crewWord, memberId }: CrewBoardProps) {
  const t = useT()
  const members = [...board.members].sort((a, b) => a.name.localeCompare(b.name, dateLocale()))
  const total = Math.max(
    1,
    members.reduce((a, m) => a + m.points, 0),
  )

  return (
    <section className="hud-panel shrink-0">
      <h2 className="hud-panel-head">{t('{crew}: entre todos', { crew: capitalize(crewWord) })}</h2>
      <div className="px-4 py-3">
        <p className="font-display text-3xl font-semibold tabular-nums">
          <AnimatedNumber value={board.crew_points} />{' '}
          <span className="text-base font-normal text-env-muted">{t('puntos')}</span>
        </p>
        <ul className="mt-3 space-y-2">
          {members.map((m) => (
            <li key={m.member_id} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className={m.member_id === memberId ? 'font-semibold' : ''}>
                  {m.name}
                  {m.member_id === memberId && <span className="text-env-muted"> {t('(tú)')}</span>}
                </span>
                <span className="text-env-muted tabular-nums">
                  {t(
                    m.streak_days === 1
                      ? '{points} pts · {n} día de racha'
                      : '{points} pts · {n} días de racha',
                    { points: m.points, n: m.streak_days },
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-env-bg" aria-hidden>
                <div
                  className="h-full rounded-full bg-env-primary"
                  style={{ width: `${(m.points / total) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
