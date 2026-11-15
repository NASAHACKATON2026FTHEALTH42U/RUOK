/** Lógica pura de los formularios de medición (fácil de testear). */

export interface InputSpec {
  type: 'number' | 'scale_1_5' | 'duration'
  min?: number | null
  max?: number | null
  step?: number | null
}

/** Lo que escribe el usuario. En `duration` son horas y minutos por separado. */
export type RawValue = { text: string } | { hours: string; minutes: string }

export type Parsed = { ok: true; value: number } | { ok: false; error: string } | { ok: 'empty' }

const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 })

/** Acepta coma o punto decimal. */
function toNumber(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

/** Horas + minutos → valor en la unidad del indicador (`h` o `min`). */
export function durationToUnit(hours: number, minutes: number, unit: string): number {
  const totalMin = hours * 60 + minutes
  return unit === 'h' ? totalMin / 60 : totalMin
}

/**
 * Convierte y valida lo escrito según `indicator.input`: rango [min, max] y paso.
 * `empty` = campo vacío (opcional: no se envía).
 */
export function parseValue(raw: RawValue, input: InputSpec, unit: string): Parsed {
  let value: number | null
  if ('text' in raw) {
    value = toNumber(raw.text)
  } else {
    const h = toNumber(raw.hours)
    const m = toNumber(raw.minutes)
    if (h === null && m === null) return { ok: 'empty' }
    if (Number.isNaN(h) || Number.isNaN(m)) return { ok: false, error: 'Escribe un número' }
    if ((m ?? 0) >= 60 || (m ?? 0) < 0) return { ok: false, error: 'Los minutos van de 0 a 59' }
    value = durationToUnit(h ?? 0, m ?? 0, unit)
  }
  if (value === null) return { ok: 'empty' }
  if (Number.isNaN(value)) return { ok: false, error: 'Escribe un número' }

  const { min, max, step } = input
  if (min != null && value < min) return { ok: false, error: `Mínimo ${fmt(min)} ${unit}` }
  if (max != null && value > max) return { ok: false, error: `Máximo ${fmt(max)} ${unit}` }
  if (step && input.type !== 'duration') {
    const k = (value - (min ?? 0)) / step
    if (Math.abs(k - Math.round(k)) > 1e-6) return { ok: false, error: `Usa pasos de ${fmt(step)}` }
  }
  if (input.type === 'duration' && step) {
    const k = value / step
    if (Math.abs(k - Math.round(k)) > 1e-6) {
      return { ok: false, error: `Redondea a pasos de ${fmt(step)} ${unit}` }
    }
  }
  return { ok: true, value }
}

/** Valor vacío inicial según el tipo de campo. */
export function emptyValue(type: InputSpec['type']): RawValue {
  return type === 'duration' ? { hours: '', minutes: '' } : { text: '' }
}

/** Como mucho, estas cifras en un campo (evita valores absurdos con el teclado en pantalla). */
const MAX_DIGITS = 7

/**
 * Aplica una tecla del teclado numérico en pantalla al texto de un campo: un dígito, la coma
 * decimal (`,`), borrar el último carácter (`back`) o vaciar (`clear`).
 */
export function applyKey(text: string, key: string, decimal = true): string {
  if (key === 'clear') return ''
  if (key === 'back') return text.slice(0, -1)
  if (key === ',') {
    if (!decimal || /[.,]/.test(text)) return text
    return (text === '' ? '0' : text) + ','
  }
  if (!/^\d$/.test(key)) return text
  if (text.replace(/\D/g, '').length >= MAX_DIGITS) return text
  if (text === '0') return key // sin ceros a la izquierda
  return text + key
}

/** ¿El campo admite decimales? Sí, salvo que su paso sea un número entero. */
export function allowsDecimal(input: InputSpec): boolean {
  return input.type === 'number' && (input.step == null || !Number.isInteger(input.step))
}
