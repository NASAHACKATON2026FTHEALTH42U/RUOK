import { useState, type FormEvent } from 'react'
import { ApiError, NetworkError, serverNow } from '../../api/client'
import { newId } from '../../api/newId'
import type { Environment } from '../../api/useEnvironments'
import { useIndicators } from '../../api/useIndicators'
import { sendMeasurements } from '../../offline/outbox'
import type { Recipient } from './OperatorMessageForm'
import { effectiveRanges, presetValue, type PresetKind, type Ranges } from './simulate'
import { pushToast } from '../../store/toasts'

const FIELD = 'flex min-w-0 flex-col gap-1.5'
const INPUT = 'hud-input w-full !font-sans !text-[0.9375rem]'
const PRESETS: { id: PresetKind; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'warning', label: 'Aviso' },
  { id: 'critical', label: 'Crítico' },
]

/**
 * Provoca una medición de un member como si la hubiera tomado: el motor la evalúa, el panel
 * cambia al momento y, si sale de rango, salta la alerta automática (con su escalado). Los
 * valores propuestos salen de los rangos de la configuración del entorno.
 */
export function MeasurementInjector({
  env,
  recipients,
  memberId,
}: {
  env: Environment
  recipients: Recipient[]
  memberId: number | null
}) {
  const indicators = useIndicators()
  const [indicatorId, setIndicatorId] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string | null>(null)

  const list =
    indicators.state === 'ready' ? indicators.data.filter((i) => env.indicators.includes(i.id)) : []
  const indicator = list.find((i) => i.id === indicatorId)
  const ranges: Ranges | null = indicator
    ? effectiveRanges(
        indicator.ranges as Ranges,
        env.threshold_overrides[indicator.id] as Partial<Ranges> | undefined,
      )
    : null
  const chosen = memberId !== null && recipients.some((r) => r.id === memberId) ? memberId : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!indicator || chosen === null || value === '') return
    const who = recipients.find((r) => r.id === chosen)?.name ?? ''
    setBusy(true)
    try {
      const res = await sendMeasurements(chosen, [
        {
          id: newId(),
          indicator_id: indicator.id,
          value: Number(value),
          taken_at: serverNow().toISOString(),
          source: 'manual',
          note: 'Simulada desde el centro de control',
        },
      ])
      setLog(
        res.status === 'queued'
          ? '⇡ Sin conexión: se enviará sola al volver'
          : `✓ ${indicator.name} de ${who}: ${value} ${indicator.unit}`,
      )
      if (res.status !== 'queued')
        pushToast({
          tone: 'success',
          icon: 'pulse',
          label: 'Enviado',
          title: 'Medición enviada',
          body: `${indicator.name} de ${who}: ${value} ${indicator.unit}`,
          meta: 'El panel se actualiza al momento; si sale de rango, salta la alerta.',
        })
    } catch (err) {
      setLog(
        `⚠ No se ha podido enviar: ${
          err instanceof NetworkError
            ? 'sin conexión con el servidor'
            : err instanceof ApiError
              ? err.message
              : String(err)
        }`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Provocar una medición">
      <p className="text-sm">
        <span className="hud-label mr-2">De</span>
        {chosen !== null ? (
          recipients.find((r) => r.id === chosen)?.name
        ) : (
          <span className="text-env-muted">
            elige un {env.vocabulary.member} en el selector de la barra lateral
          </span>
        )}
      </p>
      <label className={FIELD}>
        <span className="hud-label">Indicador</span>
        <select
          required
          value={indicatorId}
          onChange={(e) => {
            setIndicatorId(e.target.value)
            setValue('')
          }}
          className={INPUT}
        >
          <option value="" disabled>
            {indicators.state === 'loading' ? 'Cargando…' : 'Elige…'}
          </option>
          {list.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>

      {/* Siempre a la vista (desactivado hasta elegir indicador): el panel no cambia de tamaño. */}
      <div className="flex flex-wrap items-end gap-3">
        <label className={`${FIELD} w-28`}>
          <span className="hud-label">Valor{indicator ? ` (${indicator.unit})` : ''}</span>
          <input
            required
            type="number"
            inputMode="decimal"
            disabled={!indicator}
            step={indicator?.input.step ?? 'any'}
            min={indicator?.input.min ?? undefined}
            max={indicator?.input.max ?? undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={`${INPUT} tabular-nums disabled:opacity-50`}
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="hud-label">Valor de ejemplo</span>
          <div className="flex gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!indicator || !ranges}
                onClick={() =>
                  indicator &&
                  ranges &&
                  setValue(
                    String(presetValue(ranges, indicator.higher_is_worse, p.id, indicator.input)),
                  )
                }
                className="min-h-9 border border-env-border px-2.5 text-sm text-env-muted hover:border-env-text hover:text-env-text disabled:opacity-50 disabled:hover:border-env-border disabled:hover:text-env-muted"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="-mt-1 text-xs text-env-muted">
        {indicator && ranges
          ? `Normal en ${env.name}: ${ranges.normal[0]}–${ranges.normal[1]} ${indicator.unit}`
          : 'Los valores de ejemplo salen de los rangos del entorno.'}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !indicator || chosen === null || value === ''}
          className="hud-btn hud-btn-primary disabled:opacity-50"
        >
          {busy ? 'Enviando…' : 'Enviar medición'}
        </button>
        <p role="status" className="text-sm text-env-muted">
          {log}
        </p>
      </div>
    </form>
  )
}
