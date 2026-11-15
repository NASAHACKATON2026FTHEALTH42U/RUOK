import { describe, expect, it } from 'vitest'
import { allowsDecimal, applyKey, durationToUnit, parseValue } from './measureForm'

const bp = { type: 'number' as const, min: 50, max: 250, step: 1 }
const temp = { type: 'number' as const, min: 33, max: 43, step: 0.1 }
const sleep = { type: 'duration' as const, min: 0, max: 16, step: 0.5 }
const exercise = { type: 'duration' as const, min: 0, max: 600, step: 5 }

describe('parseValue', () => {
  it('vacío no es error (campo opcional)', () => {
    expect(parseValue({ text: '' }, bp, 'mmHg')).toEqual({ ok: 'empty' })
    expect(parseValue({ hours: '', minutes: '' }, sleep, 'h')).toEqual({ ok: 'empty' })
  })
  it('valida el rango', () => {
    expect(parseValue({ text: '142' }, bp, 'mmHg')).toEqual({ ok: true, value: 142 })
    expect(parseValue({ text: '20' }, bp, 'mmHg')).toEqual({ ok: false, error: 'Mínimo 50 mmHg' })
    expect(parseValue({ text: '300' }, bp, 'mmHg')).toEqual({ ok: false, error: 'Máximo 250 mmHg' })
  })
  it('acepta coma decimal y valida el paso', () => {
    expect(parseValue({ text: '36,6' }, temp, '°C')).toEqual({ ok: true, value: 36.6 })
    expect(parseValue({ text: '142.5' }, bp, 'mmHg')).toEqual({
      ok: false,
      error: 'Usa pasos de 1',
    })
  })
  it('texto no numérico', () => {
    expect(parseValue({ text: 'abc' }, bp, 'mmHg')).toEqual({
      ok: false,
      error: 'Escribe un número',
    })
  })
  it('duración en horas y en minutos', () => {
    expect(parseValue({ hours: '7', minutes: '30' }, sleep, 'h')).toEqual({ ok: true, value: 7.5 })
    expect(parseValue({ hours: '1', minutes: '15' }, exercise, 'min')).toEqual({
      ok: true,
      value: 75,
    })
    expect(parseValue({ hours: '7', minutes: '20' }, sleep, 'h')).toEqual({
      ok: false,
      error: 'Redondea a pasos de 0,5 h',
    })
    expect(parseValue({ hours: '1', minutes: '75' }, exercise, 'min').ok).toBe(false)
  })
})

describe('durationToUnit', () => {
  it('convierte a la unidad del indicador', () => {
    expect(durationToUnit(1, 30, 'h')).toBe(1.5)
    expect(durationToUnit(1, 30, 'min')).toBe(90)
  })
})

describe('teclado numérico en pantalla', () => {
  it('añade dígitos, sin ceros a la izquierda y con un tope de cifras', () => {
    expect(applyKey('', '7')).toBe('7')
    expect(applyKey('7', '2')).toBe('72')
    expect(applyKey('0', '5')).toBe('5')
    expect(applyKey('1234567', '8')).toBe('1234567')
  })
  it('una sola coma decimal, y solo si el campo admite decimales', () => {
    expect(applyKey('36', ',')).toBe('36,')
    expect(applyKey('36,5', ',')).toBe('36,5')
    expect(applyKey('', ',')).toBe('0,')
    expect(applyKey('36', ',', false)).toBe('36')
  })
  it('borra el último carácter o lo vacía', () => {
    expect(applyKey('36,5', 'back')).toBe('36,')
    expect(applyKey('', 'back')).toBe('')
    expect(applyKey('120', 'clear')).toBe('')
  })
  it('lo escrito con el teclado en pantalla se valida igual que lo tecleado', () => {
    const text = ['3', '6', ',', '5'].reduce((t, k) => applyKey(t, k), '')
    expect(parseValue({ text }, { type: 'number', min: 30, max: 45, step: 0.1 }, '°C')).toEqual({
      ok: true,
      value: 36.5,
    })
  })
  it('sin coma si el paso es entero', () => {
    expect(allowsDecimal({ type: 'number', step: 1 })).toBe(false)
    expect(allowsDecimal({ type: 'number', step: 0.1 })).toBe(true)
    expect(allowsDecimal({ type: 'number' })).toBe(true)
    expect(allowsDecimal({ type: 'duration', step: 0.25 })).toBe(false)
  })
})
