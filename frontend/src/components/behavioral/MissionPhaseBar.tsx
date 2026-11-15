import { Link } from 'react-router-dom'
import { missionPhase, type Mission } from './missionPhase'

interface MissionPhaseBarProps {
  mission: Mission
  /** Hora de referencia: `serverNow()` (la demo acelera el reloj). */
  now: Date
  /** Si el usuario puede abrir el check-in (rol member/admin): enlace en el aviso. */
  canCheckIn: boolean
  /**
   * Una sola línea (panel de escritorio): el cuarto actual va en el texto y la barra solo
   * lleva las marcas de cada cuarto. Misma información, la mitad de alto.
   */
  compact?: boolean
}

const fmtDate = (s: string) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

/**
 * Barra de fase de misión (FE-21): día N de M, progreso con marcas en cada cuarto y, al entrar
 * en el tercer cuarto, un aviso proactivo del "fenómeno del tercer cuarto" (docs/behavioral-health.md).
 * El color de la barra es el primario del entorno, nunca el del semáforo: no es un estado de salud.
 */
export function MissionPhaseBar({
  mission,
  now,
  canCheckIn,
  compact = false,
}: MissionPhaseBarProps) {
  const phase = missionPhase(mission, now)
  if (!phase) return null

  const range = `${fmtDate(mission.start)} – ${fmtDate(mission.end)}`

  if (phase.status !== 'active') {
    return (
      <p
        className={`text-sm text-env-muted ${
          compact
            ? 'hud-panel px-3.5 py-2.5'
            : 'rounded-xl border border-env-border bg-env-surface px-4 py-3'
        }`}
      >
        <span className="font-medium text-env-text">Fase de misión:</span>{' '}
        {phase.status === 'before'
          ? `empieza en ${phase.daysToStart} ${phase.daysToStart === 1 ? 'día' : 'días'}`
          : 'misión terminada'}{' '}
        · {range}
      </p>
    )
  }

  const pct = Math.round(phase.progress * 100)
  const thirdQuarter = phase.quarter === 3

  const days = `${phase.daysLeft} ${phase.daysLeft === 1 ? 'día' : 'días'}`

  const bar = (
    <div
      role="progressbar"
      aria-label="Progreso de la misión"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`Día ${phase.day} de ${phase.totalDays}, ${phase.quarter}.º cuarto`}
      className={`relative overflow-hidden rounded-full bg-env-bg ${
        compact ? 'h-2 min-w-40 flex-1' : 'h-2.5'
      }`}
    >
      <div className="h-full rounded-full bg-env-primary" style={{ width: `${pct}%` }} />
      {[25, 50, 75].map((q) => (
        <span
          key={q}
          aria-hidden
          className="absolute top-0 h-full w-px bg-env-border"
          style={{ left: `${q}%` }}
        />
      ))}
    </div>
  )

  const note = thirdQuarter && (
    <div
      className={`rounded-lg border border-env-border bg-env-bg text-sm ${compact ? 'mt-2.5 px-3 py-2' : 'p-3'}`}
      role="note"
    >
      <p className="font-medium">
        <span aria-hidden>◔ </span>Has entrado en el tercer cuarto de la misión
      </p>
      <p className="mt-1 text-env-muted">
        En misiones largas es frecuente un bajón de ánimo pasada la mitad (el «fenómeno del tercer
        cuarto»). Es normal: mantén las rutinas, cuida el sueño y apóyate en el equipo.
      </p>
      {canCheckIn && (
        <Link to="/checkin" className="mt-2 inline-block font-medium underline hover:text-env-text">
          Hacer el check-in de hoy
        </Link>
      )}
    </div>
  )

  if (compact) {
    return (
      <section aria-label="Fase de misión" className="hud-panel px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <p className="shrink-0">
            <span className="font-medium">Fase de misión</span>{' '}
            <span className="text-env-muted">
              · Día {phase.day} de {phase.totalDays} ·{' '}
              <span className="font-semibold text-env-text">{phase.quarter}.º cuarto</span>
            </span>
          </p>
          {bar}
          <p className="shrink-0 text-env-muted tabular-nums">
            {pct} % · quedan {days} · {range}
          </p>
        </div>
        {note}
      </section>
    )
  }

  return (
    <section
      aria-label="Fase de misión"
      className="space-y-3 rounded-xl border border-env-border bg-env-surface px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p>
          <span className="font-medium">Fase de misión</span>{' '}
          <span className="text-env-muted">
            · Día {phase.day} de {phase.totalDays} · quedan {days}
          </span>
        </p>
        <p className="text-env-muted tabular-nums">
          {pct} % · {range}
        </p>
      </div>

      {bar}
      <div aria-hidden className="grid grid-cols-4 text-center text-[11px] text-env-muted">
        {[1, 2, 3, 4].map((q) => (
          <span key={q} className={q === phase.quarter ? 'font-semibold text-env-text' : ''}>
            {q}.º cuarto
          </span>
        ))}
      </div>

      {note}
    </section>
  )
}
