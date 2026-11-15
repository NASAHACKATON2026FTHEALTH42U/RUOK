import { motion, useReducedMotion } from 'framer-motion'
import {
  useId,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import xrayHuman from '../../assets/xray-human.webp'
import { STATUS_COLORS, statusStyle, type Liveness } from '../ui/status'
import { StatusBadge } from '../ui/StatusBadge'
import { BodyLegend } from './BodyLegend'
import { BRAIN, HEART, STOMACH, type OrganIcon } from './organIcons'
import { isFigureStale, type BodyRegion, type RegionState } from './regions'

interface BodyFigureProps {
  regions: RegionState[]
  liveness: Liveness
  /** Texto del aviso cuando la figura está apagada (p. ej. "Sin datos desde hace 12 min"). */
  staleLabel?: string
  selectedSystemId?: string | null
  onSelectSystem?: (systemId: string) => void
  /** Zona señalada controlada desde fuera (p. ej. por una leyenda en otra columna). */
  hoveredSystemId?: string | null
  onHoverSystem?: (systemId: string | null) => void
  /** Leyenda de sistemas debajo de la figura (por defecto, sí). */
  showLegend?: boolean
  /**
   * Parte de la figura que se ve, desde arriba (1 = entera). Con 0.71 se corta por las rodillas:
   * todas las zonas que se pueden pulsar siguen dentro (las piernas, de los huesos, se pulsan
   * por los muslos).
   */
  crop?: number
  /**
   * Se encaja en su contenedor (lo más grande posible sin deformarse) en vez de un ancho máximo
   * fijo. El contenedor tiene que ser de tamaño (`container-type: size`).
   */
  fill?: boolean
}

interface Tooltip {
  region: RegionState
  x: number
  y: number
  /** Dónde va el cartel respecto a la zona: encima (por defecto) o a su derecha. */
  side: 'top' | 'right'
}

/**
 * Figura humana con un color por sistema (estado de la evaluación); la radiación se ve en el
 * tamaño e intensidad del aura amarilla de detrás.
 * - Cada región es enfocable y clicable: emite `onSelectSystem`.
 * - Con liveness stale o lost, toda la figura pasa a gris rayado (nunca el último verde).
 * - Debajo hay una leyenda con StatusBadge: el estado nunca depende solo del color.
 */
/**
 * Aura amarilla detrás del cuerpo según la radiación: cuanto peor el estado, más grande e
 * intensa. Sin dato de radiación (`unknown`) se queda en el tamaño base; nunca "tranquiliza".
 */
const RADIATION_AURA: Record<string, { scale: number; opacity: number }> = {
  normal: { scale: 1, opacity: 0.75 },
  warning: { scale: 1.25, opacity: 0.9 },
  critical: { scale: 1.5, opacity: 1 },
}
const AURA_BASE = { scale: 1, opacity: 0.75 }

export function BodyFigure({
  regions,
  liveness,
  staleLabel,
  selectedSystemId,
  onSelectSystem,
  hoveredSystemId,
  onHoverSystem,
  showLegend = true,
  crop = 1,
  fill = false,
}: BodyFigureProps) {
  const uid = useId().replace(/:/g, '')
  const stripes = `stripes-${uid}`
  const glow = `glow-${uid}`
  const critical = `critical-${uid}`
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  // Zona señalada (ratón, foco de teclado o su botón de la leyenda): se ilumina y el resto se atenúa.
  const [ownHovered, setOwnHovered] = useState<string | null>(null)
  const hovered = hoveredSystemId !== undefined ? hoveredSystemId : ownHovered
  const setHovered = (id: string | null) => {
    setOwnHovered(id)
    onHoverSystem?.(id)
  }
  const stale = isFigureStale(liveness)
  // Latido del aura: no si el usuario pide reducir movimiento ni sin datos fiables.
  const reducedMotion = useReducedMotion()
  const pulse = !stale && !reducedMotion
  const byRegion = new Map(regions.map((r) => [r.region, r]))
  // Tamaño e intensidad del aura según el estado de la radiación (sistema en la zona `halo`).
  const radiation = byRegion.get('halo')
  const baseAura = (radiation && RADIATION_AURA[radiation.status]) ?? AURA_BASE
  // Radiación señalada (el aura, su botón en "Sistemas" o el teclado): el aura se intensifica.
  const auraLit = !!radiation && hovered === radiation.systemId
  const aura = auraLit ? { scale: baseAura.scale * 1.12, opacity: 1 } : baseAura

  // Coordenadas de la ventana: el cartel va en un portal, fuera del panel que recorta la figura.
  const showTooltip = (region: RegionState, target: Element) => {
    const el = target.getBoundingClientRect()
    // Inmune (ganglios repartidos por el cuerpo): el cartel va a la derecha, no encima.
    if (region.region === 'immune')
      setTooltip({ region, x: el.right + 10, y: el.top + el.height / 2, side: 'right' })
    else setTooltip({ region, x: el.left + el.width / 2, y: el.top, side: 'top' })
  }

  /** Relleno de una región: color del estado, o rayado gris si no hay datos fiables. */
  const fillFor = (r: RegionState) =>
    stale || statusStyle(r.status).striped
      ? `url(#${stripes})`
      : r.status === 'critical'
        ? `url(#${critical})` // degradado radial que late (centro siempre con color)
        : STATUS_COLORS[r.status]

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
        onPointerEnter: (e: PointerEvent) => {
          showTooltip(r, e.currentTarget)
          setHovered(r.systemId)
        },
        onPointerLeave: () => {
          setTooltip(null)
          setHovered(null)
        },
        onFocus: (e: FocusEvent) => {
          showTooltip(r, e.currentTarget)
          setHovered(r.systemId)
        },
        onBlur: () => {
          setTooltip(null)
          setHovered(null)
        },
      },
    }
  }

  /**
   * Estilo común de las zonas sobre la imagen: relleno semitransparente del color del estado
   * (deja ver el órgano), sin contorno salvo al señalarla (blanco).
   */
  const shape = (r: RegionState) => {
    const lit = hovered === r.systemId
    return {
      fill: fillFor(r),
      // Más opaco al señalarlo; el crítico, algo más (sin llegar a sólido) y además late.
      fillOpacity: lit || (r.status === 'critical' && !stale) ? 0.85 : 0.55,
      // Sin contorno: solo aparece, en blanco, al señalar la zona.
      stroke: lit ? '#ffffff' : 'none',
      strokeOpacity: 1,
      strokeWidth: lit ? 9 : 0,
    }
  }

  // Función (no componente): si fuera un componente definido aquí, React lo remontaría en cada
  // render y se perdería el foco de teclado al mostrar el tooltip.
  // Dos capas: la zona sensible (invisible, FIJA, recibe ratón y teclado) y el dibujo visible,
  // que crece, brilla o se atenúa sin mover la zona sensible: así el hover no parpadea.
  const zone = (name: BodyRegion, draw: (r: RegionState) => ReactNode, layer: 'hit' | 'visual') => {
    const p = regionProps(name)
    if (!p) return null
    if (layer === 'hit')
      return (
        <g key={name} {...p.g}>
          <g opacity={0}>{draw(p.r)}</g>
        </g>
      )
    const lit = hovered === p.r.systemId
    return (
      <g
        key={name}
        aria-hidden="true"
        pointerEvents="none"
        style={{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          transition: 'transform 150ms ease-out, filter 150ms ease-out, opacity 150ms ease-out',
          // Huesos y ganglios no crecen: están repartidos por todo el cuerpo y, al escalarlos
          // juntos, los de los extremos se abrían hacia fuera. Se resaltan con el brillo.
          transform: lit && name !== 'bones' && name !== 'immune' ? 'scale(1.08)' : undefined,
          filter: lit ? `url(#${glow})` : undefined,
          opacity: hovered !== null && !lit ? 0.4 : 1,
        }}
      >
        {/* Crítico: color más intenso que parpadea con un resplandor rojo (fijo con "reducir
            movimiento"). Sin datos fiables no se marca: la figura va en gris. */}
        <g className={p.r.status === 'critical' && !stale ? 'critical-blink' : undefined}>
          {draw(p.r)}
        </g>
      </g>
    )
  }

  /**
   * Icono de órgano (viewBox 512) colocado en (x, y) con ancho `w` y alto `h`, en coordenadas de la
   * figura. Silueta con el estilo del estado (shape) y, si lo tiene, detalle oscuro encima. El
   * contorno al señalarlo se compensa por la escala para que se vea igual que en las demás zonas.
   */
  const organ = (
    r: RegionState,
    icon: OrganIcon,
    x: number,
    y: number,
    w: number,
    h: number = w,
    pad = true,
    /** Se ve sin señalarlo: más opaco y con un contorno fino. */
    emphasis = false,
  ) => {
    const kx = w / 512
    const ky = h / 512
    const k = (kx + ky) / 2
    const style = shape(r)
    // Sin datos: gris liso (no rayado) en los iconos; tampoco es verde, y el "Sin datos" se lee
    // en el tooltip y en la columna de sistemas.
    if (stale || statusStyle(r.status).striped) style.fill = STATUS_COLORS.unknown
    if (emphasis && style.stroke === 'none') {
      style.fillOpacity = Math.max(style.fillOpacity, 0.8)
      style.stroke = '#ffffff'
      style.strokeOpacity = 0.75
      style.strokeWidth = 5
    }
    return (
      <g transform={`translate(${x} ${y}) scale(${kx} ${ky})`}>
        {/* Zona sensible invisible que cubre el icono (los iconos tienen huecos). El cerebro no
            la lleva: solo su forma, para no invadir los ojos que tiene debajo. */}
        {pad && <ellipse cx="256" cy="256" rx="256" ry="256" fill="transparent" stroke="none" />}
        {icon.shape.map((d, i) => (
          <path key={i} d={d} {...style} strokeWidth={style.strokeWidth / k} />
        ))}
        {icon.detail?.map((d, i) => (
          <path key={`d${i}`} d={d} fill="#000000" fillOpacity={0.3} stroke="none" />
        ))}
      </g>
    )
  }

  /** Zonas del cuerpo, en coordenadas de la imagen original (887 × 1774). */
  const zones: [BodyRegion, (r: RegionState) => ReactNode][] = [
    // Radiación (todo el cuerpo): el aura de detrás del cuerpo. Va primero, por debajo de los
    // órganos: señalar un órgano no activa la radiación. Sin relleno propio (lo que se ve es el
    // aura, que se intensifica al señalarla).
    [
      'halo',
      () => <ellipse cx="443.5" cy="860" rx="470" ry="900" fill="transparent" stroke="none" />,
    ],
    // Huesos (musculoesquelético): húmero, antebrazo, fémur y tibia
    [
      'bones',
      (r) => (
        <g
          {...shape(r)}
          fill="none"
          stroke={fillFor(r)}
          strokeWidth={selectedSystemId === r.systemId || hovered === r.systemId ? 30 : 22}
          strokeOpacity={0.85}
          strokeLinecap="round"
        >
          <polyline points="288,377 243,635 164,855" />
          <polyline points="600,377 655,635 720,855" />
          <polyline points="343,858 353,1240 353,1635" />
          <polyline points="545,858 532,1240 532,1635" />
        </g>
      ),
    ],
    // Metabólico: estómago (icono), en la parte alta del abdomen
    // Con contorno y más opaco: sobre la radiografía apenas se veía antes de señalarlo.
    ['metabolic', (r) => organ(r, STOMACH, 365, 575, 200, 200, true, true)],
    // Corazón (icono)
    // Igual que el estómago: visible sin señalarlo.
    // Late (lub-dub) salvo con «reducir movimiento» o sin datos recientes.
    [
      'heart',
      (r) => (
        <g className={stale ? undefined : 'heart-beat'}>
          {organ(r, HEART, 380, 400, 154, 154, true, true)}
        </g>
      ),
    ],
    // Inmune: ganglios linfáticos (cuello, axilas, ingles)
    [
      'immune',
      (r) => (
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
      ),
    ],
    // Cerebro (neuro-conductual). Termina por encima de los ojos para no robarles el clic.
    // Algo más pequeño que antes (mismo centro): pesaba demasiado en la cabeza.
    ['brain', (r) => organ(r, BRAIN, 388, 30, 110, 72, false)],
    // Ojos (SANS), sobre las órbitas. Zona sensible (rect invisible) algo mayor: fácil de pulsar.
    [
      'eyes',
      (r) => (
        <g>
          <rect x="380" y="108" width="128" height="50" fill="transparent" stroke="none" />
          {/* En las órbitas de la radiografía: blanco del ojo con contorno, iris del color del
              estado y pupila, para que se vean sin señalarlos (como los demás órganos). */}
          {[
            [414, 131],
            [477, 131],
          ].map(([cx, cy]) => {
            const st = shape(r)
            return (
              <g key={cx}>
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx="19"
                  ry="12"
                  // Al señalarlos, el blanco del ojo se tiñe del color del entorno.
                  fill={st.strokeWidth ? 'var(--env-primary)' : '#ffffff'}
                  fillOpacity={st.strokeWidth ? 0.7 : 0.55}
                  stroke="#ffffff"
                  strokeOpacity={0.85}
                  strokeWidth={st.strokeWidth ? 5 : 3}
                  style={{ transition: 'fill 150ms ease-out, fill-opacity 150ms ease-out' }}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="9"
                  fill={stale || statusStyle(r.status).striped ? STATUS_COLORS.unknown : st.fill}
                  fillOpacity={0.95}
                />
                <circle cx={cx} cy={cy} r="3.5" fill="#000000" fillOpacity={0.65} />
              </g>
            )
          })}
        </g>
      ),
    ],
  ]

  // Alto visible de la imagen (887 × 1774) según el recorte.
  const viewH = Math.round(1774 * crop * 10) / 10

  return (
    <div
      className={
        fill
          ? 'relative flex h-full w-full items-center justify-center'
          : 'flex flex-col items-center gap-4'
      }
    >
      {stale && (
        <div className={fill ? 'absolute top-3 left-3 z-10' : undefined}>
          <StatusBadge status={liveness === 'lost' ? 'lost' : 'stale'} label={staleLabel} />
        </div>
      )}

      {/* Con `fill`, lo más grande que quepa en el contenedor sin deformarse (unidades de
          contenedor) y centrada. Si no, hasta 300 px de ancho y menos en pantallas bajas (la figura
          mide el doble de alto); el contenedor puede fijar otro máximo con `--body-max`. */}
      <div
        className={fill ? 'relative' : 'relative w-full'}
        style={
          fill
            ? {
                aspectRatio: `887 / ${viewH}`,
                width: `min(100cqw, calc(100cqh * ${(887 / viewH).toFixed(4)}))`,
              }
            : { maxWidth: 'var(--body-max, min(300px, max(220px, calc((100vh - 350px) / 2))))' }
        }
      >
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
              ? { opacity: stale ? 0.8 : aura.opacity, scale: stale ? 1 : aura.scale }
              : {
                  // un latido por ciclo, alrededor del tamaño que marca la radiación
                  opacity: [aura.opacity * 0.85, aura.opacity, aura.opacity * 0.85],
                  scale: [0.97 * aura.scale, 1.05 * aura.scale, 0.97 * aura.scale],
                }
          }
          transition={
            !pulse ? { duration: 0.4 } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        {/* Coordenadas en píxeles de la imagen original (887 × 1774). Recortada, lo que queda
            por debajo no se pinta ni se puede pulsar. */}
        <svg
          viewBox={`0 0 887 ${viewH}`}
          className={`relative w-full ${fill ? 'h-full' : 'h-auto'} ${
            crop < 1 ? 'overflow-hidden' : 'overflow-visible'
          }`}
          role="group"
          aria-label="Estado por sistema del cuerpo"
        >
          <defs>
            <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="14" result="blur" />
              <feFlood floodColor="#ffffff" floodOpacity="0.95" />
              <feComposite in2="blur" operator="in" result="halo" />
              <feMerge>
                <feMergeNode in="halo" />
                <feMergeNode in="halo" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Crítico: el centro mantiene siempre el rojo y el color se expande y se contrae hacia
                los bordes (que nunca quedan del todo transparentes). Fijo con "reducir movimiento". */}
            <radialGradient id={critical} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={STATUS_COLORS.critical} stopOpacity="1" />
              <stop offset="0.35" stopColor={STATUS_COLORS.critical} stopOpacity="0.95">
                {!reducedMotion && (
                  <animate
                    attributeName="offset"
                    values="0.35;0.85;0.35"
                    dur="1.8s"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                    repeatCount="indefinite"
                  />
                )}
              </stop>
              <stop offset="1" stopColor={STATUS_COLORS.critical} stopOpacity="0.45">
                {!reducedMotion && (
                  <animate
                    attributeName="stop-opacity"
                    values="0.45;0.85;0.45"
                    dur="1.8s"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                    repeatCount="indefinite"
                  />
                )}
              </stop>
            </radialGradient>
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

          {/* La imagen del cuerpo no se amplía al señalar: solo se resalta el órgano. */}
          <g>
            {/* Cuerpo holográfico. Los órganos se desaturan un poco para que no se confundan con el
              semáforo; sin datos fiables (stale/lost), toda la figura en gris. */}
            {/* Figura de rayos X (900 × 1820) colocada para que cabeza (y 30) y pies (y 1720)
                caigan donde estaban: las zonas mantienen sus coordenadas. */}
            <image
              href={xrayHuman}
              x="6"
              y="-28"
              width="876"
              height="1770"
              preserveAspectRatio="none"
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

            {zones.map(([n, d]) => zone(n, d, 'visual'))}

            {/* Zonas sensibles (invisibles) encima del dibujo, en las mismas coordenadas: lo que
                se ve y lo que responde coinciden. */}
            {zones.map(([n, d]) => zone(n, d, 'hit'))}
          </g>
        </svg>

        {tooltip &&
          createPortal(
            <div
              role="tooltip"
              className={`pointer-events-none fixed z-50  border border-env-border bg-env-bg px-3 py-2 text-sm whitespace-nowrap shadow-lg ${
                tooltip.side === 'right' ? '-translate-y-1/2' : '-translate-x-1/2 -translate-y-full'
              }`}
              style={{ left: tooltip.x, top: tooltip.side === 'right' ? tooltip.y : tooltip.y - 6 }}
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
            </div>,
            document.body,
          )}
      </div>

      {showLegend && (
        <BodyLegend
          regions={regions}
          stale={stale}
          selectedSystemId={selectedSystemId}
          onSelectSystem={onSelectSystem}
          onHoverSystem={setHovered}
        />
      )}
    </div>
  )
}
