import { useActivityStore } from '../../store/activity'
import { activityOptions, type Activity } from './heartbeat'

/**
 * Selector de actividad de la cabecera (FE-15). Va en cada heartbeat: en EVA los umbrales de
 * "sin contacto" son mucho más estrictos y en sueño, más relajados (los aplica el servidor).
 * Marcar "Sueño" evita falsas alarmas cuando se bloquea la pantalla del móvil.
 */
export function ActivitySelector({ isSpace }: { isSpace: boolean }) {
  const activity = useActivityStore((s) => s.activity)
  const setActivity = useActivityStore((s) => s.setActivity)

  return (
    <label className="flex items-center gap-1.5 text-sm">
      <span className="text-env-muted">Actividad</span>
      <select
        value={activity}
        onChange={(e) => setActivity(e.target.value as Activity)}
        className="rounded-md border border-env-border bg-env-bg px-2 py-1 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
      >
        {activityOptions(isSpace).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
