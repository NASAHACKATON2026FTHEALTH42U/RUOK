import { useEffect, useId, useRef, useState } from 'react'
import type { Indicator } from '../../api/useIndicators'
import { ListenButton } from '../behavioral/VoiceControls'
import { STATUS_COLORS } from '../ui/status'
import { allowsDecimal, applyKey, type RawValue } from './measureForm'
import { NumericKeypad } from './NumericKeypad'

interface MeasureStepProps {
  indicator: Indicator
  value: RawValue
  error?: string
  onChange: (v: RawValue) => void
}

const INPUT =
  'h-14 w-full min-w-0 border border-env-border bg-env-bg px-3 text-3xl tabular-nums text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary'

/**
 * Un indicador, él solo en pantalla: cómo medirlo (`measurement_instructions`, con voz), el campo
 * generado a partir de `indicator.input` (número, escala 1–5 o duración) y un teclado numérico en
 * pantalla. Se puede escribir con el teclado en pantalla o con el del dispositivo.
 */
export function MeasureStep({ indicator, value, error, onChange }: MeasureStepProps) {
  const id = useId()
  const errId = `${id}-err`
  const { input, unit } = indicator
  const invalid = Boolean(error)
  const ref = useRef<HTMLInputElement>(null)
  // En la duración, el teclado escribe en la parte activa (horas o minutos).
  const [part, setPart] = useState<'hours' | 'minutes'>('hours')

  // Con ratón y teclado físico, el campo listo para escribir. En táctil no: abriría el teclado
  // del dispositivo encima del de la pantalla.
  useEffect(() => {
    if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches)
      ref.current?.focus()
  }, [indicator.id])

  const invalidStyle = invalid ? { borderColor: STATUS_COLORS.critical } : undefined

  const instructions = indicator.measurement_instructions.length > 0 && (
    // El botón de voz va al lado de los pasos (no en una fila propia): en móvil cada línea cuenta.
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="hud-label">Cómo medir</p>
        <ol className="mt-1 space-y-1 text-sm">
          {indicator.measurement_instructions.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-env-border text-xs text-env-muted"
              >
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      {/* Voz guía (FE-37): los pasos en voz alta, con las manos ocupadas en el aparato. */}
      <ListenButton
        texts={indicator.measurement_instructions}
        label={`Escuchar cómo medir: ${indicator.name}`}
        iconOnly
      />
    </div>
  )

  let field: React.ReactNode = null
  let keypad: React.ReactNode = null
  if (input.type === 'scale_1_5' && 'text' in value) {
    field = (
      <div role="radiogroup" aria-label={indicator.name} className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value.text === String(n)}
            onClick={() => onChange({ text: value.text === String(n) ? '' : String(n) })}
            className={`h-16 border text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
              value.text === String(n)
                ? 'border-env-primary bg-env-primary text-env-primary-text'
                : 'border-env-border bg-env-bg hover:border-env-text'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    )
  } else if (input.type === 'duration' && 'hours' in value) {
    field = (
      <div className="grid grid-cols-2 gap-3">
        {(['hours', 'minutes'] as const).map((p) => (
          <label key={p} className="flex min-w-0 flex-col gap-1">
            <span className="hud-label">{p === 'hours' ? 'Horas' : 'Minutos'}</span>
            <input
              ref={p === 'hours' ? ref : undefined}
              inputMode="numeric"
              value={value[p]}
              onFocus={() => setPart(p)}
              onClick={() => setPart(p)}
              onChange={(e) => onChange({ ...value, [p]: e.target.value })}
              aria-invalid={invalid}
              aria-describedby={invalid ? errId : undefined}
              style={invalidStyle}
              className={`${INPUT} ${part === p ? 'border-env-primary' : ''}`}
            />
          </label>
        ))}
      </div>
    )
    keypad = (
      <NumericKeypad
        decimal={false}
        label={`Teclado numérico: ${part === 'hours' ? 'horas' : 'minutos'}`}
        onKey={(k) => onChange({ ...value, [part]: applyKey(value[part], k, false) })}
      />
    )
  } else if ('text' in value) {
    field = (
      <label className="flex flex-col gap-1">
        {/* El nombre ya está en la cabecera del panel: aquí solo para lectores de pantalla. */}
        <span className="sr-only">
          {indicator.name} ({unit})
        </span>
        <span className="flex items-center gap-3">
          <input
            ref={ref}
            inputMode="decimal"
            value={value.text}
            onChange={(e) => onChange({ text: e.target.value })}
            placeholder={
              input.min != null && input.max != null ? `${input.min} – ${input.max}` : ''
            }
            aria-invalid={invalid}
            aria-describedby={invalid ? errId : undefined}
            style={invalidStyle}
            className={`${INPUT} placeholder:text-xl placeholder:text-env-muted/60`}
          />
          <span className="shrink-0 text-lg text-env-muted">{unit}</span>
        </span>
      </label>
    )
    keypad = (
      <NumericKeypad
        decimal={allowsDecimal(input)}
        onKey={(k) => onChange({ text: applyKey(value.text, k, allowsDecimal(input)) })}
      />
    )
  }

  return (
    // En pantallas anchas, las instrucciones y el campo a la izquierda y el teclado a la derecha.
    <div
      className={`flex flex-col gap-3 md:gap-4 ${keypad ? 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-6' : ''}`}
    >
      <div className="flex min-w-0 flex-col gap-3 md:gap-4">
        {instructions}
        {field}
        {error && (
          <p id={errId} className="text-sm font-medium" role="alert">
            <span aria-hidden>⚠ </span>
            {error}
          </p>
        )}
      </div>
      {keypad}
    </div>
  )
}
