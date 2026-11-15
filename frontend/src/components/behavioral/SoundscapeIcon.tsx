import type { SoundscapeId } from './soundscapes'

/** Iconos de línea de cada paisaje sonoro (24 × 24, color del texto). Decorativos. */
const PATHS: Record<SoundscapeId, string> = {
  ocean: 'M2 9.5q2.5 -3 5 0t5 0t5 0t5 0M2 15.5q2.5 -3 5 0t5 0t5 0t5 0',
  rain: 'M7 14a4 4 0 0 1 .5 -8a5 5 0 0 1 9.5 1.5a3.5 3.5 0 0 1 0 6.5zM8.5 17.5l-1 3M12.5 17.5l-1 3M16.5 17.5l-1 3',
  wind: 'M3 8h10a3 3 0 1 0 -3 -3M3 12h15a3 3 0 1 1 -3 3M3 16h8',
  forest: 'M12 3l-6 8h4l-4 6h12l-4 -6h4zM12 17v4',
  fire: 'M12 3c1 4 5 5 5 10a5 5 0 0 1 -10 0c0 -3 2 -4 2 -6c1.5 1 2 2 2 3c1 -2 1 -4 1 -7z',
  bowl: 'M4 12h16a8 8 0 0 1 -16 0zM9 8.5c0 -1.5 1 -2 1 -3.5M14 8.5c0 -1.5 1 -2 1 -3.5',
}

export function SoundscapeIcon({ id, size = 28 }: { id: SoundscapeId; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={PATHS[id]} />
    </svg>
  )
}
