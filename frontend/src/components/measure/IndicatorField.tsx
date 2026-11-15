import { STATUS_COLORS } from '../ui/status'
import { useId } from 'react'
import type { Indicator } from '../../api/useIndicators'
import { ListenButton } from '../behavioral/VoiceControls'
import type { RawValue } from './measureForm'

interface IndicatorFieldProps {
  indicator: Indicator
  value: RawValue
  error?: string
  onChange: (v: RawValue) => void
}

const inputCls =
  'w-full rounded-md border border-env-border bg-env-bg px-3 py-2 text-lg tabular-nums text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary'

/**
 * Un indicador del formulario: pasos para medirlo (`measurement_instructions`) y el campo
 * generado a partir de `indicator.input` (number, scale_1_5 o duration).
 */
export function IndicatorField({ indicator, value, error, onChange }: IndicatorFieldProps) {
  const id = useId()
  const errId = `${id}-err`
  const { input, unit } = indicator
  const invalid = Boolean(error)
  // Pantallas muy estrechas (≤ 340 px): con un campo numérico simple, las instrucciones van a
  // la izquierda y la casilla a la derecha, en la misma fila, para que la tarjeta sea baja.
  const row = input.type !== 'scale_1_5' && input.type !== 'duration'

  return (
    <fieldset
      className={`rounded-xl border border-env-border bg-env-surface p-4 ${
        row
          ? 'max-[341px]:grid max-[341px]:grid-cols-[1fr_8.75rem] max-[341px]:items-center max-[341px]:gap-x-2'
          : ''
      }`}
    >
      <legend className="px-1 font-semibold">{indicator.name}</legend>

      {indicator.measurement_instructions.length > 0 && (
        <div className="mt-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-env-muted uppercase">Cómo medir</p>
            {/* Voz guía (FE-37): los pasos en voz alta, con las manos ocupadas en el aparato. */}
            <ListenButton
              texts={indicator.measurement_instructions}
              label={`Escuchar cómo medir: ${indicator.name}`}
              iconOnly
            />
          </div>
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
      )}

      <div className={`mt-3 ${row ? 'max-[341px]:col-start-2 max-[341px]:mt-0' : ''}`}>
        {input.type === 'scale_1_5' && 'text' in value ? (
          <div role="radiogroup" aria-label={indicator.name} className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value.text === String(n)}
                onClick={() => onChange({ text: value.text === String(n) ? '' : String(n) })}
                className={`h-11 flex-1 rounded-md border text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                  value.text === String(n)
                    ? 'border-env-primary bg-env-primary text-env-primary-text'
                    : 'border-env-border bg-env-bg hover:border-env-text'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        ) : input.type === 'duration' && 'hours' in value ? (
          <div className="flex items-end gap-2">
            <label className="flex-1 text-sm">
              <span className="text-env-muted">Horas</span>
              <input
                inputMode="numeric"
                value={value.hours}
                onChange={(e) => onChange({ ...value, hours: e.target.value })}
                aria-invalid={invalid}
                style={invalid ? { borderColor: STATUS_COLORS.critical } : undefined}
                aria-describedby={invalid ? errId : undefined}
                className={inputCls}
              />
            </label>
            <label className="flex-1 text-sm">
              <span className="text-env-muted">Minutos</span>
              <input
                inputMode="numeric"
                value={value.minutes}
                onChange={(e) => onChange({ ...value, minutes: e.target.value })}
                aria-invalid={invalid}
                style={invalid ? { borderColor: STATUS_COLORS.critical } : undefined}
                aria-describedby={invalid ? errId : undefined}
                className={inputCls}
              />
            </label>
          </div>
        ) : (
          'text' in value && (
            <label className="block text-sm">
              <span className="sr-only">{indicator.name}</span>
              <span className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={value.text}
                  onChange={(e) => onChange({ text: e.target.value })}
                  placeholder={
                    input.min != null && input.max != null ? `${input.min} – ${input.max}` : ''
                  }
                  aria-invalid={invalid}
                  style={invalid ? { borderColor: STATUS_COLORS.critical } : undefined}
                  aria-describedby={invalid ? errId : undefined}
                  className={inputCls}
                />
                <span className="shrink-0 text-env-muted">{unit}</span>
              </span>
            </label>
          )
        )}
        {error && (
          <p id={errId} className="mt-1 text-sm font-medium" role="alert">
            <span aria-hidden>⚠ </span>
            {error}
          </p>
        )}
      </div>
    </fieldset>
  )
}
