import type { Schema } from '../../api/client'
import { useT } from '../../i18n/t'
import { classify, type Ranges } from '../../offline/provisional'
import { domain, segments } from './rangeScale'
import { formatValue } from '../dashboard/format'
import { statusStyle } from '../ui/status'
import { StatusIcon } from '../ui/StatusBadge'

type Status = Schema<'Status'>

interface RangeScaleProps {
  /** Rangos ya con los ajustes del entorno (`mergeRanges`). */
  ranges: Ranges
  unit: string
  /** Límites del campo de entrada, para el ancho de la escala. */
  min?: number | null
  max?: number | null
  /** Valor que se está escribiendo (marca en la escala). */
  value?: number | null
  /** Rango habitual de la persona (`personal_range`), si lo hay. */
  personal?: number[] | null
}

/** «50–100», «≤ 40», «≥ 130» para la leyenda. */
function bandText(r: Ranges, status: Status, unit: string): string[] {
  const f = (v: number) => formatValue(v, unit)
  if (status === 'normal' && r.normal) return [`${f(r.normal[0])} – ${f(r.normal[1])}`]
  if (status === 'warning' && r.warning) return [`${f(r.warning[0])} – ${f(r.warning[1])}`]
  if (status === 'critical') {
    return [
      ...(r.critical_low != null ? [`≤ ${f(r.critical_low)}`] : []),
      ...(r.critical_high != null ? [`≥ ${f(r.critical_high)}`] : []),
    ]
  }
  return []
}

/**
 * Escala de rangos de un indicador al medir: dónde está lo normal, lo que genera un aviso y lo
 * crítico, con la marca del valor que se está escribiendo. Los tramos salen de `classify`, la
 * misma regla que el semáforo, y llevan texto además de color.
 */
export function RangeScale({ ranges, unit, min, max, value, personal }: RangeScaleProps) {
  const t = useT()
  if (!ranges.normal) return null
  const [from, to] = domain(ranges, min, max)
  const segs = segments(ranges, [from, to])
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - from) / (to - from)) * 100))}%`
  const current = value != null && Number.isFinite(value) ? classify(value, ranges) : null
  const legend: Status[] = ['normal', 'warning', 'critical'].filter(
    (s) => bandText(ranges, s as Status, unit).length > 0,
  ) as Status[]

  return (
    <section aria-label={t('Rangos de referencia')} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="hud-label">{t('Rangos de referencia')}</p>
        {current && value != null && (
          <p className="flex items-center gap-1.5 text-sm" role="status">
            <StatusIcon
              glyph={statusStyle(current).glyph}
              color={statusStyle(current).color}
              size={16}
            />
            <span>
              {t('Tu valor: {value} · {status}', {
                value: formatValue(value, unit),
                status: statusStyle(current).label,
              })}
            </span>
          </p>
        )}
      </div>

      <div className="relative h-4">
        <div className="absolute inset-0 flex overflow-hidden">
          {segs.map((s, i) => (
            <span
              key={i}
              className="h-full"
              style={{
                width: `${((s.to - s.from) / (to - from)) * 100}%`,
                background: statusStyle(s.status).color,
                opacity: current && current !== s.status ? 0.45 : 0.9,
              }}
            />
          ))}
        </div>
        {personal && personal.length === 2 && (
          <span
            aria-hidden
            className="absolute -inset-y-1 border-2 border-dashed border-env-text/80"
            style={{
              left: pos(personal[0]),
              width: `calc(${pos(personal[1])} - ${pos(personal[0])})`,
            }}
          />
        )}
        {value != null && Number.isFinite(value) && (
          <span
            aria-hidden
            className="absolute -top-1.5 -bottom-1.5 w-1 -translate-x-1/2 bg-env-text shadow-[0_0_0_2px_var(--env-bg)] transition-[left] duration-200"
            style={{ left: pos(value) }}
          />
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {personal && personal.length === 2 && (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3 w-4 border-2 border-dashed border-env-text/80"
            />
            <span className="font-medium">{t('Tu rango habitual')}</span>
            <span className="text-env-muted">
              {formatValue(personal[0], unit)} – {formatValue(personal[1], unit)}
            </span>
          </li>
        )}
        {legend.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block size-3"
              style={{ background: statusStyle(s).color }}
            />
            <span className="font-medium">{statusStyle(s).label}</span>
            <span className="text-env-muted">{bandText(ranges, s, unit).join(t(' o '))}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
