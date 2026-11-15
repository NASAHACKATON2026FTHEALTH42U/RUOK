import type { ReactNode } from 'react'
import type { IconName } from './navigation'

const ICONS: Record<IconName, ReactNode> = {
  panel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </>
  ),
  measure: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  missions: (
    <>
      <path d="M12 3 21 8v8l-9 5-9-5V8Z" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  more: (
    <>
      <rect x="4" y="4" width="6" height="6" />
      <rect x="14" y="4" width="6" height="6" />
      <rect x="4" y="14" width="6" height="6" />
      <rect x="14" y="14" width="6" height="6" />
    </>
  ),
  crew: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.1 2.4 3.5 5.2" />
    </>
  ),
  alerts: (
    <>
      <path d="M12 3 22 20H2Z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  list: <path d="M5 7h14M5 12h14M5 17h9" />,
  // Loto (Meditación).
  meditation: (
    <path d="M12 19c-4 0-7-3-8-6 3 0 6 1 8 3 2-2 5-3 8-3-1 3-4 6-8 6zM12 16c-2-2-2-6 0-9 2 3 2 7 0 9z" />
  ),
}

export function NavIcon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

/** Flecha «›» de las filas que llevan a otra pantalla. */
export function ChevronIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className="shrink-0 text-env-muted"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
