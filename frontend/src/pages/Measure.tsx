import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { serverNow } from '../api/client'
import { newId } from '../api/newId'
import { useEnvironments } from '../api/useEnvironments'
import { useIndicators, type Indicator } from '../api/useIndicators'
import { useSystems } from '../api/useSystems'
import { IndicatorField } from '../components/measure/IndicatorField'
import { emptyValue, parseValue, type RawValue } from '../components/measure/measureForm'
import { statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useVocab } from '../environments/useVocab'
import { sendMeasurements, type MeasurementBatchResult } from '../offline/outbox'
import { useEnvironmentStore } from '../store/environment'

type Phase =
  | { kind: 'editing' }
  | { kind: 'sending' }
  | { kind: 'sent'; result: MeasurementBatchResult }
  | { kind: 'queued' }
  | { kind: 'failed'; message: string }

/**
 * Medición guiada (FE-10). Sin parámetros: elegir sistema. Con `?system=` (lo usa "Medir ahora")
 * o `?indicator=`: formulario de los indicadores activos del entorno, generado desde
 * `indicator.input`, con los pasos de `measurement_instructions` y validación de rango.
 * Se envía todo en UN lote (la tensión sistólica + diastólica van juntas), con un UUID por
 * medición. Pasa por el outbox (FE-11): se guarda primero en el dispositivo y, si no hay
 * conexión, se envía solo cuando vuelva, sin duplicados.
 */
export default function Measure() {
  const vocab = useVocab()
  const memberId = useEnvironmentStore((s) => s.memberId)
  const envId = useEnvironmentStore((s) => s.envId)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const envs = useEnvironments()
  const systems = useSystems()
  const catalog = useIndicators()

  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined
  const active = useMemo(() => {
    const all = catalog.state === 'ready' ? catalog.data : []
    const ids = env?.indicators
    return ids ? all.filter((i) => ids.includes(i.id)) : all
  }, [catalog, env])

  const systemParam = params.get('system')
  const indicatorParam = params.get('indicator')
  const fields: Indicator[] = indicatorParam
    ? active.filter((i) => i.id === indicatorParam)
    : systemParam
      ? active.filter((i) => i.system_id === systemParam)
      : []

  const title = <h1 className="text-2xl font-semibold">Nueva medición</h1>

  if (memberId === null) {
    return (
      <section>
        {title}
        <p className="mt-2 text-env-muted">
          No hay nadie seleccionado.{' '}
          <Link to="/" className="underline hover:text-env-text">
            Elige entorno y {vocab.member}
          </Link>
          .
        </p>
      </section>
    )
  }

  if (catalog.state === 'loading' || systems.state === 'loading') {
    return (
      <section className="space-y-4">
        {title}
        <div className="h-40 animate-pulse rounded-xl bg-env-surface" aria-busy="true" />
      </section>
    )
  }

  // Paso 1: elegir qué medir.
  if (fields.length === 0) {
    const sys = systems.state === 'ready' ? systems.data : []
    const withIndicators = sys
      .map((s) => ({ s, inds: active.filter((i) => i.system_id === s.id) }))
      .filter((x) => x.inds.length > 0)
    return (
      <section className="space-y-4">
        {title}
        <p className="text-env-muted">¿Qué quieres medir?</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {withIndicators.map(({ s, inds }) => (
            <li key={s.id}>
              <Link
                to={`/measure?system=${encodeURIComponent(s.id)}`}
                className="block h-full rounded-xl border border-env-border bg-env-surface p-4 hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary"
              >
                <span className="block font-semibold">{s.name}</span>
                <span className="mt-1 block text-sm text-env-muted">
                  {inds.map((i) => i.name).join(' · ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  // Paso 2: formulario. `key` reinicia el estado al cambiar de sistema o indicador.
  const systemName =
    systems.state === 'ready'
      ? systems.data.find((s) => s.id === fields[0].system_id)?.name
      : undefined
  return (
    <MeasureForm
      key={`${systemParam}-${indicatorParam}`}
      memberId={memberId}
      fields={fields}
      heading={indicatorParam ? fields[0].name : (systemName ?? '')}
      onDone={() => navigate('/dashboard')}
    />
  )
}

function MeasureForm({
  memberId,
  fields,
  heading,
  onDone,
}: {
  memberId: number
  fields: Indicator[]
  heading: string
  onDone: () => void
}) {
  const [values, setValues] = useState<Record<string, RawValue>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, emptyValue(f.input.type)])),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<Phase>({ kind: 'editing' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const ok: { id: string; value: number }[] = []
    for (const f of fields) {
      const r = parseValue(values[f.id], f.input, f.unit)
      if (r.ok === true) ok.push({ id: f.id, value: r.value })
      else if (r.ok === false) errs[f.id] = r.error
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    if (ok.length === 0) {
      setPhase({ kind: 'failed', message: 'Rellena al menos un valor.' })
      return
    }
    const takenAt = serverNow().toISOString()
    const batch = ok.map((m) => ({
      id: newId(),
      indicator_id: m.id,
      value: m.value,
      taken_at: takenAt,
      source: 'manual' as const,
      note: note.trim() || null,
    }))

    setPhase({ kind: 'sending' })
    try {
      // Se guarda en el dispositivo y se intenta enviar; sin red queda pendiente (no se pierde).
      const r = await sendMeasurements(memberId, batch)
      setPhase(r.status === 'sent' ? { kind: 'sent', result: r.result } : { kind: 'queued' })
    } catch (err) {
      // Solo si falla el propio guardado local (IndexedDB no disponible).
      setPhase({
        kind: 'failed',
        message: `No se ha podido guardar en el dispositivo: ${String(err)}`,
      })
    }
  }

  if (phase.kind === 'queued') {
    return (
      <section className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Medición guardada en el dispositivo</h1>
        <div className="rounded-xl border border-env-border bg-env-surface p-4" role="status">
          <p>
            <span aria-hidden>⇡ </span>
            No hay conexión con el servidor. La medición está guardada aquí y{' '}
            <strong>se enviará sola</strong> cuando vuelva la conexión, sin duplicarse.
          </p>
          <p className="mt-2 text-sm text-env-muted">
            Verás los pendientes en la cabecera. Hasta entonces, el panel puede no reflejarla.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg bg-env-primary px-4 py-2 font-medium text-env-primary-text"
          >
            Ver el panel
          </button>
          <Link
            to="/measure"
            className="rounded-lg border border-env-border px-4 py-2 hover:border-env-text"
          >
            Medir otra cosa
          </Link>
        </div>
      </section>
    )
  }

  if (phase.kind === 'sent') {
    const { accepted, duplicates, assessment } = phase.result
    return (
      <section className="mx-auto max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold">Medición guardada</h1>
        <div className="rounded-xl border border-env-border bg-env-surface p-4" role="status">
          <p>
            {accepted === 1 ? '1 medición enviada' : `${accepted} mediciones enviadas`}
            {duplicates > 0 && ` (${duplicates} ya estaban guardadas)`}.
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-env-muted">
            Evaluación actualizada:
            <StatusBadge
              status={assessment.overall_status}
              label={`Estado general: ${statusStyle(assessment.overall_status).label}`}
              size="sm"
            />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg bg-env-primary px-4 py-2 font-medium text-env-primary-text"
          >
            Ver el panel
          </button>
          <Link
            to="/measure"
            className="rounded-lg border border-env-border px-4 py-2 hover:border-env-text"
          >
            Medir otra cosa
          </Link>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4" noValidate>
      <Link to="/measure" className="text-sm text-env-muted hover:text-env-text hover:underline">
        ← Elegir otra cosa
      </Link>
      <h1 className="text-2xl font-semibold">{heading}</h1>
      {fields.length > 1 && (
        <p className="text-sm text-env-muted">
          Rellena lo que hayas medido: se envía todo junto. Los campos vacíos no se envían.
        </p>
      )}

      <fieldset disabled={phase.kind === 'sending'} className="space-y-4">
        {fields.map((f) => (
          <IndicatorField
            key={f.id}
            indicator={f}
            value={values[f.id]}
            error={errors[f.id]}
            onChange={(v) => {
              setValues((s) => ({ ...s, [f.id]: v }))
              setErrors((s) => {
                const next = { ...s }
                delete next[f.id]
                return next
              })
            }}
          />
        ))}

        <label className="block text-sm">
          <span className="text-env-muted">Nota (opcional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-env-border bg-env-surface px-3 py-2 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary"
          />
        </label>
      </fieldset>

      {phase.kind === 'failed' && (
        <p className="rounded-lg border border-env-border bg-env-surface p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          {phase.message}
        </p>
      )}

      <button
        type="submit"
        disabled={phase.kind === 'sending'}
        className="w-full rounded-lg bg-env-primary px-4 py-3 font-medium text-env-primary-text disabled:opacity-60"
      >
        {phase.kind === 'sending' ? 'Guardando…' : 'Guardar medición'}
      </button>
    </form>
  )
}
