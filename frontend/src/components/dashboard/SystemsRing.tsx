import { useLayoutEffect, useRef, useState } from 'react'
import { bySeverity, statusStyle, type Status } from '../ui/status'
import type { RegionState } from '../body/regions'

/**
 * Panel principal en móvil con el estilo HUD (maqueta `Main`, docs/design/hud-style.md §6):
 * saludo, anillo con un arco por sistema (color por estado) y la lista `SYS.01`.
 * Sin datos = arco apagado (`hud-dim`), nunca en el color nominal. Tocar una fila abre el
 * detalle del sistema (el mismo `SystemPanel` del escritorio).
 */
interface SystemsRingProps {
  regions: RegionState[]
  /** Liveness stale/lost: todo en "sin datos". */
  stale: boolean
  /** Nombre corto para el saludo ("Vega"). */
  name?: string
  env?: { name: string; comm_delay_s: number; gravity_g: number; kind: string }
  now: Date
  onSelectSystem: (systemId: string) => void
}

const ST_CLASS: Record<Status, string> = {
  normal: 'text-st-ok',
  warning: 'text-st-warn',
  critical: 'text-st-crit',
  unknown: 'text-st-none',
}
const ST_STROKE: Record<Status, string> = {
  normal: 'var(--color-st-ok)',
  warning: 'var(--color-st-warn)',
  critical: 'var(--color-st-crit)',
  unknown: 'var(--color-hud-dim)',
}
/** Relleno de la barra: cuanto peor el estado, menos "salud" (decorativo; el texto manda). */
const BAR: Record<Status, number> = { normal: 90, warning: 60, critical: 30, unknown: 0 }

/** Estilo de `hud-label` para los textos del SVG. */
const LABEL = { fontSize: 9, letterSpacing: 1.26, fill: 'var(--env-muted)' } as const

/** Alto del anillo: el de la maqueta, o menos si hace falta para que el panel quepa sin scroll. */
const RING_MAX = 222
const RING_MIN = 150

/**
 * Ajusta el alto de un bloque para que el contenido de `<main>` quepa sin scroll
 * (docs/design/hud-style.md §5), entre RING_MIN y RING_MAX. Se recalcula al cambiar el tamaño
 * de la pantalla o del contenido (p. ej. al aparecer un aviso).
 */
function useFitHeight(ref: React.RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(RING_MAX)
  useLayoutEffect(() => {
    const el = ref.current
    const main = el?.closest('main')
    const content = main?.firstElementChild
    if (!el || !main || !content) return
    const fit = () => {
      if (el.offsetParent === null) return // oculto (escritorio)
      const over = content.getBoundingClientRect().height - main.clientHeight
      const next = Math.round(el.offsetHeight - over)
      setHeight(Math.max(RING_MIN, Math.min(RING_MAX, next)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(main)
    ro.observe(content)
    return () => ro.disconnect()
  }, [ref])
  return height
}

function greeting(now: Date) {
  const h = now.getHours()
  return h >= 6 && h < 13 ? 'Buenos días' : h >= 13 && h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? `${n} ${one}` : `${n} ${many}`
}

function summaryText(statuses: Status[]) {
  const crit = statuses.filter((s) => s === 'critical').length
  const warn = statuses.filter((s) => s === 'warning').length
  const none = statuses.filter((s) => s === 'unknown').length
  if (crit + warn + none === 0) return 'Todos los sistemas, nominales.'
  const parts = [
    crit && plural(crit, 'crítico', 'críticos'),
    warn && plural(warn, 'en atención', 'en atención'),
    none && plural(none, 'sin datos', 'sin datos'),
  ].filter(Boolean)
  return `${parts.join(', ')}. El resto, nominal.`
}

function delayLabel(s: number) {
  if (s <= 0) return 'directo'
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`
}

export function SystemsRing({ regions, stale, name, env, now, onSelectSystem }: SystemsRingProps) {
  const ringRef = useRef<HTMLElement>(null)
  const ringHeight = useFitHeight(ringRef)
  const items = regions.map((r) => ({ ...r, status: stale ? ('unknown' as Status) : r.status }))
  const sorted = [...items].sort((a, b) => bySeverity(a.status, b.status))
  const statuses = items.map((r) => r.status)
  const nominal = statuses.filter((s) => s === 'normal').length
  const crit = statuses.filter((s) => s === 'critical').length
  const warn = statuses.filter((s) => s === 'warning').length

  // Anillo: un arco por sistema, con un hueco entre arcos.
  const R = 88
  const C = 2 * Math.PI * R
  const n = Math.max(items.length, 1)
  const step = C / n
  const arc = step - 8
  const ringText = env
    ? `${env.name} // Enlace ${delayLabel(env.comm_delay_s)} // Gravedad ${env.gravity_g} g // `.toUpperCase()
    : ''

  return (
    <div className="flex flex-col gap-1 md:hidden">
      <div>
        <h1 className="text-[28px] leading-tight font-light tracking-[-0.01em]">
          {greeting(now)}
          {name ? (
            <>
              , <span className="text-env-primary">{name}.</span>
            </>
          ) : (
            '.'
          )}
        </h1>
        <p className="mt-0.5 text-sm text-hud-soft">
          {stale ? 'Sin datos recientes: estado desconocido.' : summaryText(statuses)}
        </p>
      </div>

      <section
        ref={ringRef}
        aria-label="Estado global"
        className="relative mx-auto w-full max-w-[390px]"
        style={{ height: ringHeight }}
      >
        <p className="sr-only">
          {nominal} de {items.length} sistemas nominales.
        </p>
        {/* Todo dentro del SVG (también los textos), para que escale junto. El centro del anillo
            es el centro del viewBox, así que queda centrado con cualquier ancho o alto. */}
        <svg viewBox="0 0 390 222" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M22 44 L74 44 L112 76" fill="none" stroke="#1F4450" />
          <rect x="110" y="74" width="5" height="5" fill="var(--env-primary)" />
          <path d="M368 178 L316 178 L280 148" fill="none" stroke="#1F4450" />
          <rect x="276" y="145" width="5" height="5" fill="var(--env-primary)" />
          <defs>
            <path
              id="ruok-ring-text"
              d="M195 111 m-101 0 a101 101 0 1 1 202 0 a101 101 0 1 1 -202 0"
            />
          </defs>
          <circle
            cx="195"
            cy="111"
            r="108"
            fill="none"
            stroke="var(--color-hud-dim)"
            strokeWidth="5"
            strokeDasharray="1 4.65"
          />
          {ringText && (
            <g className="hud-spin hud-spin-slow">
              <text
                fontFamily="IBM Plex Mono, monospace"
                fontSize="7.5"
                letterSpacing="2.2"
                fill="#4D7580"
              >
                <textPath href="#ruok-ring-text">{ringText.repeat(2)}</textPath>
              </text>
            </g>
          )}
          <g transform="rotate(-88 195 111)" fill="none" strokeWidth="11">
            {items.map((r, i) => (
              <circle
                key={r.systemId}
                cx="195"
                cy="111"
                r={R}
                stroke={ST_STROKE[r.status]}
                strokeOpacity={r.status === 'normal' ? 0.85 : 1}
                strokeDasharray={`${arc} ${C - arc}`}
                strokeDashoffset={-i * step}
              />
            ))}
          </g>
          <circle
            className="hud-spin"
            cx="195"
            cy="111"
            r="71"
            fill="none"
            stroke="var(--env-primary)"
            strokeOpacity="0.45"
            strokeWidth="3"
            strokeDasharray="12 7"
          />
          <circle cx="195" cy="111" r="58" fill="#0B1B21" stroke="var(--env-border)" />
          <g fontFamily="var(--font-mono)" textAnchor="middle" dominantBaseline="central">
            <text x="195" y="84" {...LABEL}>
              SISTEMAS
            </text>
            <text x="195" y="112" fontSize="34" fontWeight="300" fill="var(--env-text)">
              {nominal}
              <tspan fill="var(--env-muted)">/{items.length}</tspan>
            </text>
            <text x="195" y="139" {...LABEL}>
              NOMINALES
            </text>
          </g>
          {env && (
            <g fontFamily="var(--font-mono)" {...LABEL}>
              <text x="22" y="34">
                ENL / {delayLabel(env.comm_delay_s).toUpperCase()}
              </text>
              <text x="368" y="194" textAnchor="end">
                G / {env.gravity_g}
              </text>
            </g>
          )}
        </svg>
      </section>

      <section className="hud-panel" aria-label="Sistemas del cuerpo">
        <div className="hud-panel-head">
          <b>SYS.01</b>Sistemas
          <span
            className={`hud-chip ${crit ? 'text-st-crit' : warn ? 'text-st-warn' : 'text-st-ok'}`}
          >
            {crit || warn ? `${crit} crít · ${warn} atn` : 'Nominal'}
          </span>
        </div>
        <ul>
          {sorted.map((r, i) => {
            const s = statusStyle(r.status)
            return (
              <li key={r.systemId}>
                <button
                  type="button"
                  onClick={() => onSelectSystem(r.systemId)}
                  className={`hud-row w-full !text-sm text-left hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary ${
                    i === 0 && r.status !== 'normal' ? 'is-active' : ''
                  } ${i === sorted.length - 1 ? '!border-b-0' : ''}`}
                  aria-label={`${r.name}: ${s.label}. Ver detalle`}
                >
                  <span
                    className={`w-[30px] font-mono text-[11px] ${r.status === 'normal' ? 'text-env-muted' : ST_CLASS[r.status]}`}
                  >
                    S-{String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span
                    className={`hud-bar w-14 shrink-0 ${ST_CLASS[r.status]}`}
                    aria-hidden="true"
                  >
                    <i style={{ width: `${BAR[r.status]}%` }} />
                  </span>
                  <span
                    className={`w-[72px] shrink-0 text-right font-mono text-[10px] tracking-[0.08em] uppercase ${ST_CLASS[r.status]}`}
                  >
                    {r.status === 'normal' ? 'Nominal' : s.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
