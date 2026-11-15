import { StatusIcon } from './StatusBadge'
import { STATUS_COLORS, statusStyle, type DisplayState, type StatusGlyph } from './status'

/**
 * Verde para "normal" cuando se enciende. Aquí manda la idea de semáforo: el resto de la app
 * usa el cian del HUD para "normal".
 */
const GO = '#34d399'

/** Un icono por estado, cada uno con su forma (octógono, triángulo y círculo) y su color. */
const LIGHTS: { state: DisplayState; glyph: StatusGlyph; color: string }[] = [
  { state: 'critical', glyph: 'cross', color: STATUS_COLORS.critical },
  { state: 'warning', glyph: 'alert', color: STATUS_COLORS.warning },
  { state: 'normal', glyph: 'check', color: GO },
]

/**
 * Estado con tres iconos sin texto, como un semáforo: se enciende en su color el del estado
 * (cruz roja si es crítico, aviso ámbar si hay que estar atento, check verde si todo va bien) y
 * los otros quedan apagados. El estado no depende solo del color: cada icono tiene su forma y su
 * sitio, y el nombre accesible y el tooltip lo dicen con palabras. Sin datos fiables
 * (desconocido, stale o lost) los tres apagados: nunca verde. El crítico late (fijo con "reducir
 * movimiento").
 */
export function StatusLights({
  state,
  label = 'Estado general',
  size = 22,
}: {
  state: DisplayState
  label?: string
  size?: number
}) {
  const text = `${label}: ${statusStyle(state).label}`
  return (
    <span
      role="img"
      aria-label={text}
      title={text}
      className="inline-flex shrink-0 items-center gap-1.5"
    >
      {LIGHTS.map((light) => {
        const on = light.state === state
        return (
          <span
            key={light.state}
            className={`flex ${on ? '' : 'opacity-30'} ${on && light.state === 'critical' ? 'critical-blink' : ''}`}
            style={on ? { filter: `drop-shadow(0 0 5px ${light.color})` } : undefined}
          >
            <StatusIcon
              glyph={light.glyph}
              color={on ? light.color : STATUS_COLORS.unknown}
              size={size}
            />
          </span>
        )
      })}
    </span>
  )
}
