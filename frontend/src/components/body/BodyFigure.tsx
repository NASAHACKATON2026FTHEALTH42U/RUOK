import {
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
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

  /** Estilo común de las formas de una región (contorno más grueso si está seleccionada). */
  const shape = (r: RegionState) => ({
    fill: fillFor(r),
    stroke: 'var(--env-text)',
    strokeOpacity: selectedSystemId === r.systemId ? 1 : 0.4,
    strokeWidth: selectedSystemId === r.systemId ? 2.5 : 1,
  })

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

      <div ref={boxRef} className="relative w-full max-w-[280px]">
        <svg
          viewBox="0 0 200 420"
          className="h-auto w-full"
          role="group"
          aria-label="Estado por sistema del cuerpo"
        >
          <defs>
            <pattern
              id={stripes}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill={STATUS_COLORS.unknown} fillOpacity="0.35" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={STATUS_COLORS.unknown} strokeWidth="3" />
            </pattern>
          </defs>

          {/* Halo de radiación (todo el cuerpo) */}
          {region('halo', (r) => (
            <ellipse
              cx="100"
              cy="212"
              rx="94"
              ry="204"
              fill="none"
              stroke={
                stale || statusStyle(r.status).striped
                  ? `url(#${stripes})`
                  : STATUS_COLORS[r.status]
              }
              strokeOpacity={selectedSystemId === r.systemId ? 1 : 0.75}
              strokeWidth={selectedSystemId === r.systemId ? 9 : 6}
              strokeDasharray="2 6"
              strokeLinecap="round"
            />
          ))}

          {/* Silueta neutra */}
          <g
            fill={stale ? `url(#${stripes})` : 'var(--env-surface)'}
            stroke="var(--env-border)"
            strokeWidth="2"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M62 104 Q46 108 42 130 L30 230 Q29 241 38 242 Q47 243 48 232 L62 152 Z" />
            <path d="M138 104 Q154 108 158 130 L170 230 Q171 241 162 242 Q153 243 152 232 L138 152 Z" />
            <path d="M58 206 L97 212 L93 392 Q92 404 80 404 Q68 404 69 392 Z" />
            <path d="M142 206 L103 212 L107 392 Q108 404 120 404 Q132 404 131 392 Z" />
            <path d="M62 100 Q100 88 138 100 L146 212 Q100 226 54 212 Z" />
            <rect x="89" y="78" width="22" height="20" rx="6" />
            <circle cx="100" cy="50" r="31" />
          </g>

          {/* Huesos (musculoesquelético): extremidades */}
          {region('bones', (r) => (
            <g
              {...shape(r)}
              fill="none"
              stroke={fillFor(r)}
              strokeWidth={selectedSystemId === r.systemId ? 9 : 7}
              strokeOpacity={1}
              strokeLinecap="round"
            >
              <line x1="53" y1="122" x2="38" y2="230" />
              <line x1="147" y1="122" x2="162" y2="230" />
              <line x1="81" y1="224" x2="81" y2="392" />
              <line x1="119" y1="224" x2="119" y2="392" />
            </g>
          ))}

          {/* Metabólico: abdomen */}
          {region('metabolic', (r) => (
            <ellipse cx="100" cy="172" rx="25" ry="17" {...shape(r)} />
          ))}

          {/* Corazón: lado izquierdo del cuerpo (derecha de quien mira) */}
          {region('heart', (r) => (
            <path
              d="M112 146 C92 133 92 114 103 115 C108 115.5 111 119 112 122 C113 119 116 115.5 121 115 C132 114 132 133 112 146 Z"
              {...shape(r)}
            />
          ))}

          {/* Inmune: ganglios linfáticos (cuello, axilas, ingles) */}
          {region('immune', (r) => (
            <g {...shape(r)}>
              {[
                [90, 92],
                [110, 92],
                [68, 114],
                [132, 114],
                [80, 210],
                [120, 210],
              ].map(([cx, cy]) => (
                <g key={`${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r="9" fill="transparent" stroke="none" />
                  <circle cx={cx} cy={cy} r="4.5" />
                </g>
              ))}
            </g>
          ))}

          {/* Cerebro (neuro-conductual) */}
          {region('brain', (r) => (
            <ellipse cx="100" cy="40" rx="22" ry="14" {...shape(r)} />
          ))}

          {/* Ojos (SANS) */}
          {region('eyes', (r) => (
            <g {...shape(r)}>
              <rect x="80" y="54" width="40" height="12" fill="transparent" stroke="none" />
              <ellipse cx="90" cy="60" rx="6" ry="3.6" />
              <ellipse cx="110" cy="60" rx="6" ry="3.6" />
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
