/**
 * Iconos de línea propios (SVG, 24×24, heredan el color del texto). La app no usa emojis: cada
 * tipo de aviso, evento o estado tiene su icono aquí.
 */
const PATHS = {
  // Avisos
  alert: 'M12 4 2.8 20h18.4L12 4z M12 10v4.6 M12 17.4v.3',
  escalate: 'M12 20V8 M6.5 13 12 7.5 17.5 13 M5 4h14',
  mail: 'M3.5 6h17v12h-17z M4 6.6l8 6.4 8-6.4',
  bell: 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z M10 20.6a2.2 2.2 0 0 0 4 0',
  'bell-off':
    'M8.6 6.1A6 6 0 0 1 18 11v5 M6 16.5V11c0-.5.06-1 .17-1.4 M6 16.5l-1.5 2H17 M10 20.6a2.2 2.2 0 0 0 4 0 M4 4l16 16',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12 M18 6 6 18',
  // Línea de tiempo de una alerta
  plus: 'M12 5v14 M5 12h14',
  refresh: 'M19 12a7 7 0 1 1-2.2-5.1 M19 4.5V9h-4.5',
  hourglass: 'M7 4h10 M7 20h10 M8 4c0 4.6 4 5.4 4 8s-4 3.4-4 8 M16 4c0 4.6-4 5.4-4 8s4 3.4 4 8',
  eye: 'M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z M12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z',
  message: 'M4.5 5.5h15V16h-8l-4 3.5V16h-3z',
  stop: 'M7 7h10v10H7z',
  lock: 'M6.5 11h11v8.5h-11z M9 11V8a3 3 0 0 1 6 0v3',
  // Eventos del centro de control
  pulse: 'M3 12.5h4l2-5 3.5 10 2.5-7 1.5 2H21',
  heart: 'M12 19.5S4.5 15 4.5 9.6A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7.5 1.6c0 5.4-7.5 9.9-7.5 9.9z',
  signal: 'M5 19v-3 M9.5 19v-6 M14 19v-9 M18.5 19V6',
  radio:
    'M12 10.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z M8.2 8.2a5.4 5.4 0 0 0 0 7.6 M15.8 8.2a5.4 5.4 0 0 1 0 7.6 M5.6 5.6a9 9 0 0 0 0 12.8 M18.4 5.6a9 9 0 0 1 0 12.8',
  upload: 'M12 16V5 M7.5 9.5 12 5l4.5 4.5 M5 19.5h14',
  key: 'M8 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M11.5 12H21 M17.5 12v3 M20.5 12v2.2',
  target:
    'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z M12 11.4v1.2',
  device: 'M8 3.5h8v17H8z M11 17.5h2',
  user: 'M12 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M5 20a7 7 0 0 1 14 0',
  // Otros
  play: 'M8 5.5v13l10.5-6.5z',
  backspace: 'M9 5.5h11.5v13H9L3 12z M12.5 9.5l5 5 M17.5 9.5l-5 5',
  timer: 'M12 6a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M12 9.5V13l2.5 2 M10 3h4',
  flame:
    'M12 3.5c1 3 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-1.8.8-3 1.8-4 .3 1.5 1 2.3 1.7 2.6-.5-2.6 0-5.6 1-7.6z',
  medal: 'M12 9.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M8.5 3.5l2 6.3 M15.5 3.5l-2 6.3 M8.5 3.5h7',
  // Caras del estado de ánimo, de peor a mejor (siempre van con su número y su texto)
  'mood-1': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 9.8v.5 M15 9.8v.5 M8 17c1.2-3 6.8-3 8 0',
  'mood-2': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 9.8v.5 M15 9.8v.5 M9 16.2c1-1.6 5-1.6 6 0',
  'mood-3': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 9.8v.5 M15 9.8v.5 M9 15.5h6',
  'mood-4': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 9.8v.5 M15 9.8v.5 M9 14.6c1 1.6 5 1.6 6 0',
  'mood-5': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 9.8v.5 M15 9.8v.5 M8 14c1.2 3.2 6.8 3.2 8 0',
} as const

export type IconGlyph = keyof typeof PATHS

/** Icono decorativo: el texto de al lado dice lo mismo (va con `aria-hidden`). */
export function Icon({
  name,
  size = 18,
  className = '',
}: {
  name: IconGlyph
  size?: number
  className?: string
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
