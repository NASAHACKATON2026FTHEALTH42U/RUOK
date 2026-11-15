/** Logo de R U OK? (maquetas HUD, Login.dc.html): anillos que giran despacio alrededor de la marca
 * (quietos con "reducir movimiento"; clases `ruok-spin` en index.css). */

/** Grande, para el login: los anillos alrededor de "R U OK?". */
export function RuokRings() {
  return (
    <div className="relative mx-auto h-[132px] w-full max-w-[390px]" aria-hidden="true">
      <svg viewBox="0 0 390 132" className="absolute inset-0 h-full w-full">
        <circle
          cx="195"
          cy="66"
          r="62"
          fill="none"
          stroke="var(--env-border)"
          strokeWidth="4"
          strokeDasharray="1 4.4"
        />
        <circle
          className="ruok-spin"
          cx="195"
          cy="66"
          r="50"
          fill="none"
          stroke="var(--env-primary)"
          strokeWidth="7"
          strokeDasharray="38 14"
          strokeOpacity="0.8"
        />
        <circle
          className="ruok-spin ruok-spin-reverse"
          cx="195"
          cy="66"
          r="38"
          fill="none"
          stroke="var(--env-primary)"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeDasharray="6 5"
        />
        <path d="M40 66H118M272 66H350" stroke="var(--env-border)" />
        <rect x="116" y="64" width="5" height="5" fill="var(--env-primary)" />
        <rect x="269" y="64" width="5" height="5" fill="var(--env-primary)" />
      </svg>
      <span className="absolute inset-x-0 top-[56px] text-center font-mono text-[15px] tracking-[0.2em]">
        R U OK<span className="text-env-primary">?</span>
      </span>
    </div>
  )
}

/** Compacto, para las cabeceras: el emblema de anillos y "R U OK?" al lado. */
export function RuokMark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" className="shrink-0">
        <circle
          cx="20"
          cy="20"
          r="18.5"
          fill="none"
          stroke="var(--env-border)"
          strokeWidth="2"
          strokeDasharray="0.6 2.4"
        />
        <circle
          className="ruok-spin"
          cx="20"
          cy="20"
          r="14"
          fill="none"
          stroke="var(--env-primary)"
          strokeWidth="3.5"
          strokeDasharray="15 6.99"
          strokeOpacity="0.85"
        />
        <circle
          className="ruok-spin ruok-spin-reverse"
          cx="20"
          cy="20"
          r="9"
          fill="none"
          stroke="var(--env-primary)"
          strokeOpacity="0.45"
          strokeWidth="1.3"
          strokeDasharray="2.8 2.3"
        />
        <rect x="18" y="18" width="4" height="4" fill="var(--env-primary)" />
      </svg>
      <span className="font-mono text-[15px] leading-none tracking-[0.24em] text-env-text">
        R U OK<span className="text-env-primary">?</span>
      </span>
    </span>
  )
}
