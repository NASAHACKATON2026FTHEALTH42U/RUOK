import { useT } from '../../i18n/t'
import { useActivityStore } from '../../store/activity'
import { activityHint, activityOptions, type Activity, type LivenessThresholds } from './heartbeat'

/**
 * Selector de actividad (FE-15), con el estilo HUD de «Más». Va en cada
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
  const t = useT()
  const activity = useActivityStore((s) => s.activity)
  const setActivity = useActivityStore((s) => s.setActivity)

  return (
    <fieldset className="hud-panel w-full">
      <legend className="sr-only">{t('Actividad actual')}</legend>
      <div className="hud-panel-head" aria-hidden="true">
        {t('Actividad')}
        {!compact && <span className="hud-chip text-st-ok">{t('Ajusta los avisos')}</span>}
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
              // En la barra lateral (compact), sin espaciado entre letras: «Actividad de riesgo» cabe
              // en dos líneas con una letra legible (11 px como mínimo).
              className={`relative flex min-h-11 min-w-0 cursor-pointer items-center justify-center border px-1 text-center font-mono uppercase focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-env-primary ${
                compact
                  ? 'text-[0.6875rem] leading-tight tracking-normal'
                  : 'text-[0.75rem] tracking-[0.1em]'
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
        {activityHint(activity, isSpace, liveness, { short: compact })}
      </p>
    </fieldset>
  )
}
