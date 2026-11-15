import type { ReactNode } from 'react'

/**
 * Dibujos de línea muy sutiles para el fondo de las tarjetas de «Medir»: uno por sistema (y por
 * algún indicador con tarjeta propia). Van detrás del texto, en el color de acento del tema y
 * casi transparentes, y asoman cortados por la derecha de la tarjeta. Son decorativos.
 */
const ART: Record<string, ReactNode> = {
  // Corazón con un trazo de electrocardiograma que lo atraviesa.
  cardiovascular: (
    <>
      <path d="M60 100 C20 72 8 50 22 32 C34 17 52 20 60 34 C68 20 86 17 98 32 C112 50 100 72 60 100 Z" />
      <path d="M2 62 H40 l6 -14 l8 30 l7 -38 l7 22 h52" />
    </>
  ),
  // Hueso: un solo contorno (caña y dos cóndilos por extremo), sin líneas interiores.
  musculoskeletal: (
    <g transform="rotate(-30 60 60)">
      <path d="M39.95 53 H80.05 A10 10 0 1 1 96 60 A10 10 0 1 1 80.05 67 H39.95 A10 10 0 1 1 24 60 A10 10 0 1 1 39.95 53 Z" />
    </g>
  ),
  // Escudo con una cruz.
  immune: (
    <>
      <path d="M60 12 L96 26 V58 C96 82 80 98 60 108 C40 98 24 82 24 58 V26 Z" />
      <path d="M60 44 V76 M44 60 H76" />
    </>
  ),
  // Gota (hidratación y nutrición).
  metabolic: (
    <>
      <path d="M60 12 C60 12 26 54 26 76 A34 34 0 0 0 94 76 C94 54 60 12 60 12 Z" />
      <path d="M42 80 A18 18 0 0 0 56 96" />
    </>
  ),
  // Cerebro: dos hemisferios y algunas circunvoluciones.
  neuro_behavioral: (
    <>
      <path d="M60 22 C48 12 26 16 24 34 C12 40 12 60 22 66 C18 84 36 98 52 92 C56 98 64 98 68 92 C84 98 102 84 98 66 C108 60 108 40 96 34 C94 16 72 12 60 22 Z" />
      <path d="M60 22 V92 M40 38 c8 2 10 10 4 16 M80 38 c-8 2 -10 10 -4 16 M36 70 c8 -4 16 0 16 8 M84 70 c-8 -4 -16 0 -16 8" />
    </>
  ),
  // Ojo.
  eyes: (
    <>
      <path d="M8 60 C30 28 90 28 112 60 C90 92 30 92 8 60 Z" />
      <circle cx="60" cy="60" r="18" />
      <circle cx="60" cy="60" r="7" />
    </>
  ),
  // Trébol de radiación.
  radiation: (
    <>
      <circle cx="60" cy="60" r="8" />
      <path d="M52.5 47 L36 18.4 A48 48 0 0 1 84 18.4 L67.5 47 A15 15 0 0 0 52.5 47 Z M75 60 L108 60 A48 48 0 0 1 84 101.6 L67.5 73 A15 15 0 0 0 75 60 Z M52.5 73 L36 101.6 A48 48 0 0 1 12 60 L45 60 A15 15 0 0 0 52.5 73 Z" />
    </>
  ),
  // Luna y estrellas (horas de sueño).
  sleep_hours: (
    <>
      <path d="M58 16 A42 42 0 1 0 104 70 A34 34 0 0 1 58 16 Z" />
      <path d="M92 18 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z M104 44 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" />
    </>
  ),
}

/** Fondo de una tarjeta: el dibujo del indicador si tiene, si no el de su sistema. */
export function SystemArt({ id, fallback }: { id: string; fallback?: string }) {
  const art = ART[id] ?? (fallback ? ART[fallback] : undefined)
  if (!art) return null
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Detrás del texto (la tarjeta es `isolate`), asomando por la derecha y casi transparente.
      className="pointer-events-none absolute top-1/2 -right-[14%] -z-10 h-[125%] -translate-y-1/2 text-env-primary opacity-[0.08]"
    >
      {art}
    </svg>
  )
}
