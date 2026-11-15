import { statusStyle, type DisplayState } from './status'

/**
 * Estado general en una palabra en mayúsculas y bien visible: CRÍTICO, ATENCIÓN, NORMAL o SIN
 * DATOS, del color del estado (`.status-word` en index.css: rojo, ámbar, verde o gris, con tonos
 * más oscuros en los temas claros para el contraste) y con un brillo suave. El crítico late (fijo
 * con "reducir movimiento"). Es texto: se entiende igual sin color, y se anuncia al cambiar.
 */
export function StatusHeadline({
  state,
  label = 'Estado general',
  className = '',
}: {
  state: DisplayState
  label?: string
  className?: string
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      data-state={state}
      className={`status-word font-sans text-[1.0625rem] leading-none font-semibold tracking-[0.2em] uppercase ${
        state === 'critical' ? 'critical-blink' : ''
      } ${className}`}
    >
      <span className="sr-only">{label}: </span>
      {statusStyle(state).label}
    </p>
  )
}
