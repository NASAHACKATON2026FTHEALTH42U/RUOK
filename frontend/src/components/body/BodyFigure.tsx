import { motion, useReducedMotion } from 'framer-motion'
import {
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import holographicHuman from '../../assets/holographic-human.webp'
import { STATUS_COLORS, statusStyle, type Liveness } from '../ui/status'
import { StatusBadge } from '../ui/StatusBadge'
import { isFigureStale, type BodyRegion, type RegionState } from './regions'

interface BodyFigureProps {
  regions: RegionState[]
  liveness: Liveness
  /** Texto del aviso cuando la figura está apagada (p. ej. "Sin datos desde hace 12 min"). */
  staleLabel?: string
  selectedSystemId?: string | null
  onSelectSystem?: (systemId: string) => void
}

interface Tooltip {
  region: RegionState
  x: number
  y: number
}

/**
 * Figura humana con un color por sistema (estado de la evaluación) y halo de radiación.
 * - Cada región es enfocable y clicable: emite `onSelectSystem`.
 * - Con liveness stale o lost, toda la figura pasa a gris rayado (nunca el último verde).
 * - Debajo hay una leyenda con StatusBadge: el estado nunca depende solo del color.
 */
export function BodyFigure({
  regions,
  liveness,
  staleLabel,
  selectedSystemId,
  onSelectSystem,
}: BodyFigureProps) {
  const uid = useId().replace(/:/g, '')
  const stripes = `stripes-${uid}`
  const boxRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const stale = isFigureStale(liveness)
  // Latido del aura: no si el usuario pide reducir movimiento ni sin datos fiables.
  const reducedMotion = useReducedMotion()
  const pulse = !stale && !reducedMotion
  const byRegion = new Map(regions.map((r) => [r.region, r]))

  const showTooltip = (region: RegionState, target: Element) => {
    const box = boxRef.current?.getBoundingClientRect()
    const el = target.getBoundingClientRect()
    if (!box) return
    setTooltip({ region, x: el.left + el.width / 2 - box.left, y: el.top - box.top })
  }

  /** Relleno de una región: color del estado, o rayado gris si no hay datos fiables. */
  const fillFor = (r: RegionState) =>
    stale || statusStyle(r.status).striped ? `url(#${stripes})` : STATUS_COLORS[r.status]

  const regionProps = (region: BodyRegion) => {
    const r = byRegion.get(region)
    if (!r) return null
    const label = `${r.name}: ${stale ? 'sin datos recientes' : statusStyle(r.status).label}`
    return {
      r,
      g: {
        role: 'button',
        tabIndex: 0,
        'aria-label': label,
        'aria-pressed': selectedSystemId === r.systemId,
        className: 'cursor-pointer outline-none',
        onClick: () => onSelectSystem?.(r.systemId),
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectSystem?.(r.systemId)
          }
        },
        onPointerEnter: (e: PointerEvent) => showTooltip(r, e.currentTarget),
        onPointerLeave: () => setTooltip(null),
        onFocus: (e: FocusEvent) => showTooltip(r, e.currentTarget),
        onBlur: () => setTooltip(null),
      },
    }
  }

  /**
   * Estilo común de las zonas sobre la imagen: relleno semitransparente del color del estado
   * (deja ver el órgano) y contorno del mismo color; más grueso y blanco si está seleccionada.
   */
  const shape = (r: RegionState) => {
    const selected = selectedSystemId === r.systemId
    return {
      fill: fillFor(r),
      fillOpacity: 0.55,
      stroke: selected
        ? '#ffffff'
        : stale || statusStyle(r.status).striped
          ? STATUS_COLORS.unknown
          : STATUS_COLORS[r.status],
      strokeOpacity: 1,
      strokeWidth: selected ? 9 : 5,
    }
  }

  // Función (no componente): si fuera un componente definido aquí, React lo remontaría en cada
  // render y se perdería el foco de teclado al mostrar el tooltip.
  const region = (name: BodyRegion, draw: (r: RegionState) => ReactNode) => {
    const p = regionProps(name)
    if (!p) return null
    return <g {...p.g}>{draw(p.r)}</g>
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {stale && <StatusBadge status={liveness === 'lost' ? 'lost' : 'stale'} label={staleLabel} />}

      <div ref={boxRef} className="relative w-full max-w-[300px]">
        {/* Aura de luz amarilla detrás del cuerpo, con un latido suave (degradado CSS, sin
            imágenes). Respeta "reducir movimiento"; sin datos fiables se apaga a gris y no late. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-55%] top-[-4%] h-[92%] blur-3xl"
          style={{
            background: stale
              ? 'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(200,200,200,0.25) 0%, rgba(137,135,129,0.18) 40%, transparent 72%)'
              : 'radial-gradient(ellipse 50% 50% at 50% 45%, rgba(255,255,255,0.65) 0%, rgba(254,240,138,0.6) 16%, rgba(253,224,71,0.48) 32%, rgba(234,179,8,0.26) 52%, transparent 74%)',
          }}
          animate={
            !pulse
              ? { opacity: 0.8, scale: 1 }
              : { opacity: [0.7, 1, 0.7], scale: [0.97, 1.05, 0.97] } // un latido por ciclo
          }
          transition={
            !pulse ? { duration: 0.4 } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        {/* Coordenadas en píxeles de la imagen original (887 × 1774). */}
        <svg
          viewBox="0 0 887 1774"
          className="relative h-auto w-full"
          role="group"
          aria-label="Estado por sistema del cuerpo"
        >
          <defs>
            <pattern
              id={stripes}
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="24" height="24" fill={STATUS_COLORS.unknown} fillOpacity="0.45" />
              <line x1="0" y1="0" x2="0" y2="24" stroke={STATUS_COLORS.unknown} strokeWidth="12" />
            </pattern>
          </defs>

          {/* Cuerpo holográfico. Los órganos se desaturan un poco para que no se confundan con el
              semáforo; sin datos fiables (stale/lost), toda la figura en gris. */}
          <image
            href={holographicHuman}
            x="0"
            y="0"
            width="887"
            height="1774"
            preserveAspectRatio="xMidYMid meet"
            style={{
              filter: stale ? 'grayscale(1) brightness(0.75)' : 'saturate(0.55) brightness(0.9)',
            }}
            aria-hidden="true"
          />
          {stale && (
            <rect
              x="0"
              y="0"
              width="887"
              height="1774"
              fill={`url(#${stripes})`}
              opacity="0.6"
              aria-hidden="true"
            />
          )}

          {/* Sin halo alrededor del cuerpo: la radiación (todo el cuerpo) se consulta y se abre
              desde la leyenda de debajo. */}

          {/* Huesos (musculoesquelético): húmero, antebrazo, fémur y tibia */}
          {region('bones', (r) => (
            <g
              {...shape(r)}
              fill="none"
              stroke={fillFor(r)}
              strokeWidth={selectedSystemId === r.systemId ? 30 : 22}
              strokeOpacity={0.85}
              strokeLinecap="round"
            >
              <polyline points="262,385 215,620 145,850" />
              <polyline points="625,385 672,620 742,850" />
              <polyline points="362,905 376,1190 392,1555" />
              <polyline points="525,905 511,1190 497,1555" />
            </g>
          ))}

          {/* Metabólico: hígado y estómago */}
          {region('metabolic', (r) => (
            <ellipse cx="445" cy="590" rx="140" ry="62" {...shape(r)} />
          ))}

          {/* Corazón */}
          {region('heart', (r) => (
            <path
              d="M455 535 C385 495 385 425 425 428 C443 429 452 442 455 452 C458 442 467 429 485 428 C525 425 525 495 455 535 Z"
              {...shape(r)}
            />
          ))}

          {/* Inmune: ganglios linfáticos (cuello, axilas, ingles) */}
          {region('immune', (r) => (
            <g {...shape(r)}>
              {[
                [398, 268],
                [489, 268],
                [306, 430],
                [581, 430],
                [372, 930],
                [514, 930],
              ].map(([cx, cy]) => (
                <g key={`${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r="38" fill="transparent" stroke="none" />
                  {/* Anillo amarillo decorativo (a juego con el aura); el relleno sigue siendo
                      el color del estado del sistema inmune. */}
                  {!stale && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="27"
                      fill="none"
                      stroke="#fde047"
                      strokeWidth="6"
                      strokeOpacity="0.9"
                    />
                  )}
                  <circle cx={cx} cy={cy} r="18" />
                </g>
              ))}
            </g>
          ))}

          {/* Cerebro (neuro-conductual) */}
          {region('brain', (r) => (
            <ellipse cx="443" cy="88" rx="82" ry="58" {...shape(r)} />
          ))}

          {/* Ojos (SANS) */}
          {region('eyes', (r) => (
            <g {...shape(r)}>
              <rect x="370" y="122" width="148" height="40" fill="transparent" stroke="none" />
              <ellipse cx="403" cy="142" rx="24" ry="13" />
              <ellipse cx="484" cy="142" rx="24" ry="13" />
            </g>
          ))}
        </svg>

        {tooltip && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-env-border bg-env-bg px-3 py-2 text-sm shadow-lg"
            style={{ left: tooltip.x, top: tooltip.y - 6 }}
          >
            <p className="font-medium whitespace-nowrap">{tooltip.region.name}</p>
            <StatusBadge
              status={stale ? 'stale' : tooltip.region.status}
              size="sm"
              className="mt-1"
            />
            {stale && (
              <p className="mt-1 text-xs whitespace-nowrap text-env-muted">
                Último conocido: {statusStyle(tooltip.region.status).label}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Leyenda: misma información sin depender del color, y clicable */}
      <ul className="flex w-full flex-wrap justify-center gap-2" aria-label="Sistemas">
        {regions.map((r) => (
          <li key={r.systemId}>
            <button
              type="button"
              onClick={() => onSelectSystem?.(r.systemId)}
              aria-pressed={selectedSystemId === r.systemId}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                selectedSystemId === r.systemId
                  ? 'border-env-text bg-env-surface'
                  : 'border-env-border hover:bg-env-surface'
              }`}
            >
              {r.name}
              <StatusBadge status={stale ? 'stale' : r.status} size="sm" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
