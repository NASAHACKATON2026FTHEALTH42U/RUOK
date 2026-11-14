import { useId } from 'react'
import type { Indicator } from '../../api/useIndicators'
import { faceFor } from './checkin'

interface FaceScaleProps {
  indicator: Indicator
  value: number | undefined
  onChange: (v: number | undefined) => void
}

/**
 * Una pregunta del check-in: escala 1–5 con caras (`role="radiogroup"`). La pregunta y sus
 * extremos salen de `measurement_instructions` del catálogo. Las caras siguen la polaridad
 * del indicador (`higher_is_worse`) y siempre van con el número: nunca solo emoji o color.
 * Pulsar la opción elegida la quita.
 */
export function FaceScale({ indicator, value, onChange }: FaceScaleProps) {
  const id = useId()
  const question = indicator.measurement_instructions[0] ?? indicator.name

  return (
    <div className="rounded-xl border border-env-border bg-env-surface p-4">
      <p id={id} className="font-semibold">
        {indicator.name}
      </p>
      <p className="text-sm text-env-muted">{question}</p>
      <div role="radiogroup" aria-labelledby={id} className="mt-3 grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const checked = value === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${n} de 5`}
              onClick={() => onChange(checked ? undefined : n)}
              className={`flex h-16 flex-col items-center justify-center rounded-lg border transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary active:scale-95 ${
                checked
                  ? 'border-env-primary bg-env-primary text-env-primary-text'
                  : 'border-env-border bg-env-bg hover:border-env-text'
              }`}
            >
              <span aria-hidden className="text-2xl leading-none">
                {faceFor(n, indicator.higher_is_worse)}
              </span>
              <span className="mt-1 text-xs font-semibold tabular-nums">{n}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
