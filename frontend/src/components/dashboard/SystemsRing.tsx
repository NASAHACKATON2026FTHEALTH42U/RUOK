import { useLayoutEffect, useRef, useState } from 'react'
import { BodyFigure } from '../body/BodyFigure'
import type { RegionState } from '../body/regions'
import {
  bySeverity,
  statusStyle,
  type DisplayState,
  type Liveness,
  type Status,
} from '../ui/status'
import { StatusHeadline } from '../ui/StatusHeadline'

/**
 * Panel principal en móvil con el estilo HUD (docs/design/hud-style.md §6): saludo, el cuerpo en
 * pequeño con la palabra de estado y lo más urgente, y la lista de sistemas. Sin datos nunca va en
 * el color nominal. Tocar una zona del cuerpo o una fila abre el detalle del sistema (el mismo
 * `SystemPanel` del escritorio).
 */
interface SystemsRingProps {
  regions: RegionState[]
  /** Liveness stale/lost: todo en "sin datos". */
  stale: boolean
  /** Nombre corto para el saludo ("Vega"). */
  name?: string
  now: Date
  /** Liveness del member y su texto («sin contacto · hace 5 min») para el cuerpo. */
  liveness: Liveness
  staleLabel?: string
  onSelectSystem: (systemId: string) => void
}

const ST_CLASS: Record<Status, string> = {
  normal: 'text-st-ok',
  warning: 'text-st-warn',
  critical: 'text-st-crit',
  unknown: 'text-st-none',
}
/** Relleno de la barra: cuanto peor el estado, menos "salud" (decorativo; el texto manda). */
const BAR: Record<Status, number> = { normal: 90, warning: 60, critical: 30, unknown: 0 }

/** Alto del bloque del cuerpo: el de la maqueta, o menos si hace falta para que quepa sin scroll. */
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

export function SystemsRing({
  regions,
  stale,
  name,
  now,
  liveness,
  staleLabel,
  onSelectSystem,
}: SystemsRingProps) {
  const ringRef = useRef<HTMLElement>(null)
  const ringHeight = useFitHeight(ringRef)
  const items = regions.map((r) => ({ ...r, status: stale ? ('unknown' as Status) : r.status }))
  const sorted = [...items].sort((a, b) => bySeverity(a.status, b.status))
  const statuses = items.map((r) => r.status)
  const nominal = statuses.filter((s) => s === 'normal').length
  const crit = statuses.filter((s) => s === 'critical').length
  const warn = statuses.filter((s) => s === 'warning').length

  // Lo más urgente: el peor sistema, si no está nominal (sin datos también cuenta: no es verde).
  const urgent = sorted[0] && sorted[0].status !== 'normal' ? sorted[0] : null
  const headline: DisplayState = stale
    ? liveness === 'lost'
      ? 'lost'
      : 'stale'
    : (sorted[0]?.status ?? 'unknown')

  return (
    <div className="flex flex-col gap-1 md:hidden">
      <div>
        <h1 className="text-[1.75rem] leading-tight font-light tracking-[-0.01em]">
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

      {/* Estado global: el mismo cuerpo del escritorio, en pequeño (las zonas se pueden tocar), con
          la palabra de estado y lo más urgente al lado. Sustituye al anillo de sistemas, que en
          móvil se leía mal y no aportaba. */}
      <section
        ref={ringRef}
        aria-label="Estado global"
        className="hud-panel flex w-full items-stretch gap-3 p-3"
        style={{ height: ringHeight }}
      >
        <div className="min-h-0 w-[40%] max-w-[10rem] shrink-0 [container-type:size]">
          <BodyFigure
            regions={regions}
            liveness={liveness}
            staleLabel={staleLabel}
            onSelectSystem={onSelectSystem}
            showLegend={false}
            crop={0.71}
            fill
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
          <StatusHeadline state={headline} />
          {urgent ? (
            <>
              <p className="min-w-0">
                <span className="hud-label block">Lo más urgente</span>
                <span className="block truncate font-medium">{urgent.name}</span>
              </p>
              <button
                type="button"
                onClick={() => onSelectSystem(urgent.systemId)}
                className="hud-btn hud-btn-primary !h-11 self-start px-4"
              >
                Ver qué hacer
              </button>
            </>
          ) : (
            <p className="text-sm text-env-muted">
              {nominal} de {items.length} sistemas nominales. Toca una zona del cuerpo para ver su
              sistema.
            </p>
          )}
        </div>
      </section>

      <section className="hud-panel" aria-label="Sistemas del cuerpo">
        <div className="hud-panel-head">
          Sistemas
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
                    className={`w-[30px] font-mono text-[0.75rem] ${r.status === 'normal' ? 'text-env-muted' : ST_CLASS[r.status]}`}
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
                    className={`w-[72px] shrink-0 text-right font-mono text-[0.6875rem] tracking-[0.08em] uppercase ${ST_CLASS[r.status]}`}
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
