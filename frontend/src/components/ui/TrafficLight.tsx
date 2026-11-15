import { STATUS_COLORS, statusStyle, type DisplayState } from './status'

/**
 * Verde de semáforo para "normal". Aquí manda la metáfora del semáforo: el resto de la app usa
 * el cian del HUD para "normal".
 */
const GO = '#34d399'

/** Luces de izquierda a derecha, como un semáforo horizontal: rojo, ámbar y verde. */
const LAMPS = [
  { state: 'critical', color: STATUS_COLORS.critical },
  { state: 'warning', color: STATUS_COLORS.warning },
  { state: 'normal', color: GO },
] as const

/**
 * Estado como un semáforo sin texto: se enciende el rojo (crítico), el ámbar (atención) o el
 * verde (todo normal). El estado no depende solo del color: también lo dice la posición de la
 * luz, como en un semáforo de verdad, y el nombre accesible y el tooltip lo dicen con palabras.
 * Sin datos fiables (desconocido, stale o lost) las tres luces quedan apagadas: nunca verde. La
 * roja late (fija con "reducir movimiento"). La carcasa es oscura en todos los temas.
 */
export function TrafficLight({
  state,
  label = 'Estado general',
}: {
  state: DisplayState
  label?: string
}) {
  const text = `${label}: ${statusStyle(state).label}`
  return (
    <svg
      role="img"
      aria-label={text}
      viewBox="0 0 66 24"
      width="66"
      height="24"
      className="shrink-0 overflow-visible"
    >
      <title>{text}</title>
      <rect
        x="0.5"
        y="0.5"
        width="65"
        height="23"
        rx="11.5"
        fill="#071014"
        stroke="var(--env-border)"
      />
      {LAMPS.map((lamp, i) => {
        const on = lamp.state === state
        return (
          <circle
            key={lamp.state}
            cx={12 + i * 21}
            cy="12"
            r="7"
            fill={lamp.color}
            // Apagada: el cristal del color, muy tenue (se ve qué luz es cada una).
            fillOpacity={on ? 1 : 0.16}
            className={on && lamp.state === 'critical' ? 'critical-blink' : undefined}
            style={on ? { filter: `drop-shadow(0 0 4px ${lamp.color})` } : undefined}
          />
        )
      })}
    </svg>
  )
}
