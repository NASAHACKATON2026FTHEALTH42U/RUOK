import { useActivityStore } from '../../store/activity'
import { activityOptions, type Activity } from './heartbeat'

/**
 * Selector de actividad (FE-15), con el estilo HUD de «Más» (panel `ACT.01`). Va en cada
 * heartbeat: en EVA los umbrales de "sin contacto" son mucho más estrictos y en sueño, más
 * relajados (los aplica el servidor). Marcar "Sueño" evita falsas alarmas cuando se bloquea
 * la pantalla del móvil.
 */
export function ActivitySelector({
  isSpace,
  compact = false,
}: {
  isSpace: boolean
  compact?: boolean
}) {
  const activity = useActivityStore((s) => s.activity)
  const setActivity = useActivityStore((s) => s.setActivity)

  return (
    <fieldset className="hud-panel w-full">
      <legend className="sr-only">Actividad actual</legend>
      <div className="hud-panel-head" aria-hidden="true">
        <b>ACT.01</b>Actividad
        {!compact && <span className="hud-chip text-st-ok">Ajusta los avisos</span>}
      </div>
      <div className={`grid grid-cols-3 gap-1.5 pt-2.5 pb-3 ${compact ? 'px-2' : 'px-3.5'}`}>
        {activityOptions(isSpace).map((o) => {
          const on = o.id === activity
          return (
            <label
              key={o.id}
              className={`relative flex min-h-11 min-w-0 cursor-pointer items-center justify-center border px-1 text-center font-mono text-[11px] tracking-[0.1em] uppercase focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-env-primary ${
                on
                  ? 'border-env-primary bg-env-primary/12 text-env-text'
                  : 'border-env-border text-env-muted hover:text-env-text'
              }`}
            >
              <input
                type="radio"
                name="activity"
                value={o.id}
                checked={on}
                onChange={() => setActivity(o.id as Activity)}
                className="sr-only"
              />
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
