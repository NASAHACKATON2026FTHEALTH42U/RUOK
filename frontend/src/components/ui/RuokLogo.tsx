/**
 * Logo de R U OK? (propuesta «A · anillo» del kit de logos): un anillo de 7 segmentos, uno por
 * sistema del cuerpo, el primero en el color de acento, con un cuadrado en el centro y un anillo
 * punteado alrededor. Se dibuja con los colores del tema (texto y acento), así que se ve igual de
 * bien en los temas oscuros y en los claros. La palabra «R U OK?» va en texto (IBM Plex Mono).
 */

const R = 74
const CIRCUMFERENCE = 2 * Math.PI * R
const SEGMENTS = 7
const SEGMENT = 57

/** El emblema del anillo (sin texto). Decorativo: el nombre lo pone quien lo usa. */
export function RuokEmblem({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle
        cx="100"
        cy="100"
        r="95"
        fill="none"
        stroke="var(--env-text)"
        strokeOpacity="0.4"
        strokeWidth="4"
        strokeDasharray="1 5.25"
      />
      <g transform="rotate(-85.4 100 100)" fill="none" strokeWidth="16">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <circle
            key={i}
            cx="100"
            cy="100"
            r={R}
            stroke={i === 0 ? 'var(--env-primary)' : 'var(--env-text)'}
            strokeDasharray={`${SEGMENT} ${CIRCUMFERENCE - SEGMENT}`}
            strokeDashoffset={-(i * CIRCUMFERENCE) / SEGMENTS}
          />
        ))}
      </g>
      <rect x="91" y="91" width="18" height="18" fill="var(--env-text)" />
    </svg>
  )
}

/** «R U OK?» con la interrogación en el color de acento. */
function Wordmark({ className }: { className: string }) {
  return (
    <span className={`font-mono leading-none text-env-text ${className}`}>
      R U OK<span className="text-env-primary">?</span>
    </span>
  )
}

/** Compacto, para las cabeceras: el emblema y «R U OK?» al lado. */
export function RuokMark() {
  return (
    <span className="flex items-center gap-2.5">
      <RuokEmblem size={36} />
      <Wordmark className="text-[1rem] tracking-[0.24em]" />
    </span>
  )
}

/** Grande, para el login: el emblema, «R U OK?» y el lema debajo (logo horizontal del kit). */
export function RuokRings() {
  return (
    <div
      className="mx-auto flex h-[132px] w-full max-w-[390px] items-center justify-center gap-5"
      role="img"
      aria-label="R U OK? Salud en misión"
    >
      <RuokEmblem size={104} />
      <span className="flex flex-col gap-2.5">
        <Wordmark className="text-[1.875rem] tracking-[0.22em]" />
        <span className="hud-label text-[0.6875rem] tracking-[0.32em]">Salud en misión</span>
      </span>
    </div>
  )
}
