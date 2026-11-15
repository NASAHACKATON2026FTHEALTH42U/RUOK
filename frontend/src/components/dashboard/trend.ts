/** Lógica pura de TrendChart (fácil de testear). */
import type { Schema } from '../../api/client'
import { bySeverity, statusStyle } from '../ui/status'
import { formatValue } from './format'

/** Periodos disponibles en días. */
export const PERIODS = [7, 30] as const
export type Period = (typeof PERIODS)[number]

export interface TrendPoint {
  /** Milisegundos (eje X temporal). */
  t: number
  value: number
}

/** Previsión de un indicador (`GET /members/{id}/forecast`, FS-09). */
export type Forecast = Schema<'Forecast'>

/**
 * Fila de la gráfica con previsión. Un punto medido lleva `value`; uno previsto, `forecast` y
 * `band`, y nunca `value`: una estimación no se pinta como un dato (api-contract.md, regla 4).
 */
export interface ChartPoint {
  /** Milisegundos (eje X temporal). */
  t: number
  /** Valor medido. */
  value?: number
  /** Valor esperado (línea discontinua). El último punto medido también lo lleva: la línea sale de él. */
  forecast?: number
  /** Intervalo de predicción (≈ 80 %): `[low, high]`. */
  band?: [number, number]
}

/** `IndicatorAssessment.range` (openapi-fetch tipa las tuplas `[min, max]` como `number[]`). */
export type Ranges = Record<string, number[]>

/** Mediciones → puntos ordenados por fecha. */
export function toPoints(ms: { taken_at: string; value: number }[]): TrendPoint[] {
  return ms.map((m) => ({ t: Date.parse(m.taken_at), value: m.value })).sort((a, b) => a.t - b.t)
}

/** Bandas sombreadas: normal y atención (las que existan en el rango del entorno). */
export function bands(range: Ranges): { kind: 'normal' | 'warning'; y1: number; y2: number }[] {
  return (['normal', 'warning'] as const)
    .filter((k) => Array.isArray(range[k]) && range[k].length >= 2)
    .map((k) => ({ kind: k, y1: range[k][0], y2: range[k][1] }))
}

/**
 * Mediciones + previsión en UNA serie para la gráfica: los puntos medidos tal cual, el último
 * con el arranque de la línea prevista (y de su banda, que nace con anchura cero en el dato), y
 * después un punto por cada valor esperado con su intervalo.
 * Solo con una previsión `ok`; un punto previsto que no sea posterior al último dato se descarta
 * (la previsión es anterior a esa medición). Sin nada que añadir, devuelve los mismos `points`.
 */
export function withForecast(
  points: TrendPoint[],
  forecast: Forecast | null | undefined,
): ChartPoint[] {
  if (!forecast || forecast.status !== 'ok') return points
  const last = points.at(-1)
  const future: ChartPoint[] = forecast.points
    .map((p) => ({
      t: Date.parse(p.at),
      forecast: p.value,
      band: [p.low, p.high] as [number, number],
    }))
    .filter((p) => !last || p.t > last.t)
    .sort((a, b) => a.t - b.t)
  if (future.length === 0) return points
  if (!last) return future
  const joint: ChartPoint = { ...last, forecast: last.value, band: [last.value, last.value] }
  return [...points.slice(0, -1), joint, ...future]
}

/**
 * Dominio del eje Y: cubre los datos, las bandas y, si la hay, la previsión con su intervalo,
 * con un 8 % de margen y redondeado a números limpios, para que todo se vea entero.
 */
export function yDomain(points: ChartPoint[], range: Ranges): [number, number] {
  const defined = (v: number | undefined): v is number => v !== undefined
  const predicted = points.flatMap((p) => [p.forecast, ...(p.band ?? [])]).filter(defined)
  const values = [
    ...points.map((p) => p.value).filter(defined),
    ...predicted,
    ...bands(range).flatMap((b) => [b.y1, b.y2]),
  ]
  if (values.length === 0) return [0, 1]
  const min = Math.min(...values)
  let lo = min
  let hi = Math.max(...values)
  if (lo === hi) {
    lo -= 1
    hi += 1
  }
  const pad = (hi - lo) * 0.08
  const step = niceStep(hi - lo)
  const bottom = Math.floor((lo - pad) / step) * step
  // El intervalo de una previsión puede llegar al mínimo físico (0 h de sueño): ahí el margen no
  // se lleva el eje a valores negativos, que no existen.
  const floor = predicted.length > 0 && min >= 0 ? 0 : -Infinity
  return [Math.max(bottom, floor), Math.ceil((hi + pad) / step) * step]
}

/** Marcas del eje Y: múltiplos del mismo paso redondo que usa `yDomain` (p. ej. 40, 60, 80…). */
export function yTicks([lo, hi]: [number, number]): number[] {
  const step = niceStep(hi - lo)
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1e6; v += step) {
    ticks.push(Number(v.toFixed(6)))
  }
  return ticks
}

function niceStep(span: number): number {
  const raw = span / 5
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
}

/** Etiqueta corta de fecha para el eje: "14/11". */
export function formatDay(t: number): string {
  const d = new Date(t)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/** Fecha y hora para el tooltip y la tabla: "14/11 10:05". */
export function formatDateTime(t: number): string {
  const d = new Date(t)
  return `${formatDay(t)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Posición de un valor dentro de su rango normal, en % (0 = mínimo normal, 100 = máximo normal;
 * fuera de 0–100, fuera de lo normal). Es la escala común para ver juntos indicadores con
 * unidades distintas sin un segundo eje. Sin rango normal, null.
 */
export function normalPct(value: number, range: Ranges): number | null {
  const n = range.normal
  if (!Array.isArray(n) || n.length < 2 || n[1] === n[0]) return null
  return Math.round(((value - n[0]) / (n[1] - n[0])) * 1000) / 10
}

/** Unidad común de las series, o null si mezclan unidades (o no hay ninguna). */
export function commonUnit(units: readonly string[]): string | null {
  return units.length > 0 && units.every((u) => u === units[0]) ? units[0] : null
}

/** Series elegidas → posición de su color (0, 1, 2…). */
export type Slots = Record<string, number>

/** Selección inicial: las pedidas que existan o, si no hay, las primeras `count`. */
export function initialSlots(
  ids: readonly string[],
  wanted: readonly string[] | undefined,
  count: number,
): Slots {
  const asked = (wanted ?? []).filter((id) => ids.includes(id))
  const chosen = (asked.length > 0 ? asked : ids).slice(0, count)
  return Object.fromEntries(chosen.map((id, i) => [id, i]))
}

/**
 * Activa o quita una serie sin cambiar el color de las demás (el color sigue al indicador, no a
 * su posición). Siempre queda al menos una y como mucho `max`; la nueva coge el primer color libre.
 */
export function toggleSlot(slots: Slots, id: string, max: number): Slots {
  if (id in slots) {
    if (Object.keys(slots).length === 1) return slots
    const rest = { ...slots }
    delete rest[id]
    return rest
  }
  const used = new Set(Object.values(slots))
  if (used.size >= max) return slots
  let free = 0
  while (used.has(free)) free++
  return { ...slots, [id]: free }
}

/**
 * Resumen en texto de una previsión y su tono: a peor, a mejor, sin cambios, última medición
 * inusual (aún sin confirmar) o sin previsión.
 */
export interface ForecastSummary {
  tone: 'worse' | 'better' | 'steady' | 'unusual' | 'none'
  text: string
}

const dayCount = (n: number) => (n === 1 ? '1 día' : `${n} días`)
const nextDays = (n: number) => (n === 1 ? 'el próximo día' : `los próximos ${n} días`)

/**
 * Lo que dice la previsión, en una frase. Habla siempre del **valor esperado** (el estado que
 * tendría ese valor con los rangos del entorno), no del semáforo, que además mira tendencias.
 * - Con `ok`: el primer cambio de estado previsto (a peor o a mejor, en el orden normal <
 *   atención < crítico) o que el valor se mantiene.
 * - Si la última medición se sale de lo habitual (`last_value_unusual`), no se anuncia ninguna
 *   mejora a partir de un solo valor: se pide repetirla (api-contract.md, regla 4).
 * - Sin previsión (`insufficient_data`, `stale`), por qué no la hay.
 * Los nombres de estado son los de status.ts.
 */
export function forecastSummary(forecast: Forecast): ForecastSummary {
  if (forecast.status === 'insufficient_data') {
    return {
      tone: 'none',
      text: 'Aún no hay datos suficientes para prever: hacen falta al menos 7 mediciones regulares.',
    }
  }
  if (forecast.status === 'stale') {
    return {
      tone: 'none',
      text: 'Sin mediciones recientes: registra una nueva para ver la previsión.',
    }
  }
  if (forecast.last_value_unusual) {
    return {
      tone: 'unusual',
      text: 'La última medición se sale de lo habitual: repítela para confirmarla.',
    }
  }
  const { change, current_status: current, horizon_days: horizon } = forecast
  if (current === 'unknown' || !change || change.status === 'unknown') {
    return {
      tone: 'steady',
      text:
        current === 'unknown'
          ? `Sin cambios de estado previstos en ${nextDays(horizon)}.`
          : `El valor esperado seguiría en «${statusStyle(current).label}» ${nextDays(horizon)}.`,
    }
  }
  const worse = bySeverity(change.status, current) < 0
  const verb = worse ? 'pasaría' : change.status === 'normal' ? 'volvería' : 'bajaría'
  return {
    tone: worse ? 'worse' : 'better',
    text: `A este ritmo, el valor esperado ${verb} a «${statusStyle(change.status).label}» en ~${dayCount(change.in_days)}.`,
  }
}

/**
 * Letra pequeña de una previsión `ok`: que es una estimación, con cuántos días de mediciones se
 * ha ajustado y cuánto ha fallado últimamente (`backtest_mae`, en la unidad del indicador). Las
 * partes sin dato se omiten.
 */
export function forecastNote(forecast: Forecast): string {
  const parts = ['Estimación estadística, no es un diagnóstico']
  if (forecast.history_days > 0) {
    parts.push(`basada en ${dayCount(forecast.history_days)} de mediciones`)
  }
  const mae = forecast.backtest_mae
  if (mae !== null) {
    // Los valores van con un decimal; un error más pequeño se quedaría en «±0» y se da con dos.
    const amount =
      mae > 0 && mae < 0.05
        ? mae.toLocaleString('es-ES', { maximumFractionDigits: 2 })
        : formatValue(mae, '')
    const unit = forecast.unit === '1-5' ? 'puntos' : forecast.unit
    parts.push(`error medio reciente ±${amount}${unit ? ` ${unit}` : ''}`)
  }
  return parts.join(' · ')
}
