import { useActivityStore } from '../../store/activity'
import { activityHint, activityOptions, type Activity, type LivenessThresholds } from './heartbeat'

/**
 * Selector de actividad (FE-15), con el estilo HUD de «Más» (panel `ACT.01`). Va en cada
 * heartbeat: en EVA los umbrales de "sin contacto" son mucho más estrictos y en sueño, más
 * relajados (los aplica el servidor). Marcar "Sueño" evita falsas alarmas cuando se bloquea
 * la pantalla del móvil. Las opciones son botones con `aria-pressed`: se recorren con Tab.
 * Debajo, una frase explica qué hace el modo elegido, con los tiempos del perfil del entorno.
 */
export function ActivitySelector({
  isSpace,
  liveness,
  compact = false,
}: {
  isSpace: boolean
  /** Umbrales del entorno (`environment.liveness`), para explicar cada modo con sus tiempos. */
  liveness?: LivenessThresholds
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
            // Botones (no radios): cada opción se alcanza con el tabulador y se elige con Intro o espacio.
            <button
              type="button"
              aria-pressed={on}
              onClick={() => setActivity(o.id as Activity)}
              key={o.id}
              title={activityHint(o.id, isSpace, liveness)}
              // En la barra lateral (compact), letra más pequeña para que «Actividad de riesgo» quepa;
              // por debajo de 1024 px la barra es más estrecha y la letra, aún menor.
              className={`relative flex min-h-11 min-w-0 cursor-pointer items-center justify-center border px-1 text-center font-mono uppercase focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-env-primary ${
                compact
                  ? 'text-[7.5px] leading-tight tracking-normal lg:text-[9px] lg:tracking-[0.06em]'
                  : 'text-[11px] tracking-[0.1em]'
              } ${
                on
                  ? 'border-env-primary bg-env-primary/12 text-env-text'
                  : 'border-env-border text-env-muted hover:text-env-text'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {/* Qué hace el modo elegido. Se anuncia al cambiarlo (lectores de pantalla). */}
      <p
        aria-live="polite"
        className={`border-t border-env-border/60 pt-2 pb-2.5 text-xs leading-snug text-env-muted ${
          compact ? 'px-2' : 'px-3.5'
        }`}
      >
        {activityHint(activity, isSpace, liveness)}
      </p>
    </fieldset>
  )
}
