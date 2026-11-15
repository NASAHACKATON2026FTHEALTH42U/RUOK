import { Fragment, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { serverNow } from '../api/client'
import { newId } from '../api/newId'
import { useAssessment } from '../api/useAssessment'
import { useEnvironments } from '../api/useEnvironments'
import { useIndicators, type Indicator } from '../api/useIndicators'
import { useSystems } from '../api/useSystems'
import { CHECKIN_INDICATORS } from '../components/behavioral/checkin'
import { PVT_INDICATORS } from '../components/behavioral/pvt'
import { VoiceNote } from '../components/behavioral/VoiceControls'
import { IndicatorField } from '../components/measure/IndicatorField'
import { SystemArt } from '../components/measure/SystemArt'
import { emptyValue, parseValue, type RawValue } from '../components/measure/measureForm'
import { statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { sendMeasurements, type MeasurementBatchResult } from '../offline/outbox'
import { useEnvironmentStore } from '../store/environment'
import { useActiveMemberId, useAuth } from '../auth/useAuth'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'

/** Sistema cuyas escalas (ánimo, estrés…) se registran con el check-in diario, no con este formulario. */
const CHECKIN_SYSTEM = 'neuro_behavioral'
/** Indicadores que tienen su propio test (check-in diario y PVT): no se piden en «Medir». */
const OWN_TEST: readonly string[] = [...CHECKIN_INDICATORS, ...PVT_INDICATORS]

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
 *
 * El sistema neuro-conductual no se mide aquí: quien puede hacer el check-in diario va a
 * `/checkin` (desde la tarjeta y desde `?system=neuro_behavioral`). Sus indicadores sin test
 * propio (horas de sueño) tienen su tarjeta aparte.
 */
export default function Measure() {
  // Un member, siempre los suyos; el resto de roles, el member elegido (FE-28).
  const memberId = useActiveMemberId()
  const { can } = useAuth()
  const toCheckin = can('view:checkin')
  const envId = useEnvironmentStore((s) => s.envId)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const envs = useEnvironments()
  const systems = useSystems()
  const catalog = useIndicators()
  // Estado actual de cada sistema, para mostrarlo en su tarjeta (ayuda a decidir qué medir).
  const assessment = useAssessment(memberId)
  const systemStatus = (id: string) =>
    assessment.state === 'ready'
      ? (assessment.data.systems.find((x) => x.system_id === id)?.status ?? 'unknown')
      : null
  const badge = (id: string) => {
    const st = systemStatus(id)
    return st ? (
      <span className="absolute top-3 right-3 lg:top-4 lg:right-4">
        <StatusBadge status={st} size="sm" />
      </span>
    ) : null
  }

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
        <NoMemberSelected />
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

  // Neuro-conductual → check-in diario (solo quien puede hacerlo; el resto ve el formulario).
  if (toCheckin && systemParam === CHECKIN_SYSTEM && !indicatorParam) {
    return <Navigate to="/checkin" replace />
  }

  // Paso 1: elegir qué medir.
  if (fields.length === 0) {
    const sys = systems.state === 'ready' ? systems.data : []
    const withIndicators = sys
      .map((s) => ({ s, inds: active.filter((i) => i.system_id === s.id) }))
      .filter((x) => x.inds.length > 0)
    return (
      <section className="flex flex-1 flex-col gap-4">
        <div>
          {title}
          <p className="text-env-muted lg:text-lg">¿Qué quieres medir?</p>
        </div>
        {/* Las tarjetas reparten el alto disponible (filas iguales) y crecen con la pantalla. */}
        <ul className="grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {withIndicators.map(({ s, inds }) => {
            const card =
              'relative isolate flex h-full flex-col justify-center gap-1 overflow-hidden rounded-xl border border-env-border bg-env-surface p-4 pt-12 hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary lg:p-6 lg:pt-14 [&>span:nth-of-type(1)]:lg:text-xl [&>span:nth-of-type(2)]:lg:text-base'
            if (toCheckin && s.id === CHECKIN_SYSTEM) {
              // Check-in diario en lugar del formulario, y una tarjeta por indicador sin test propio.
              const rest = inds.filter((i) => !OWN_TEST.includes(i.id))
              return (
                <Fragment key={s.id}>
                  <li>
                    <Link to="/checkin" className={card}>
                      <SystemArt id={s.id} />
                      <span className="block font-display font-semibold tracking-wide">
                        {s.name}
                      </span>
                      <span className="mt-1 block text-sm text-env-muted">
                        Check-in diario «R U OK?»:{' '}
                        {inds
                          .filter((i) => (CHECKIN_INDICATORS as readonly string[]).includes(i.id))
                          .map((i) => i.name)
                          .join(' · ')}
                      </span>
                      {badge(s.id)}
                    </Link>
                  </li>
                  {rest.map((i) => (
                    <li key={i.id}>
                      <Link to={`/measure?indicator=${encodeURIComponent(i.id)}`} className={card}>
                        <SystemArt id={i.id} fallback={s.id} />
                        <span className="block font-display font-semibold tracking-wide">
                          {i.name}
                        </span>
                        <span className="mt-1 block text-sm text-env-muted">{s.name}</span>
                      </Link>
                    </li>
                  ))}
                </Fragment>
              )
            }
            return (
              <li key={s.id}>
                <Link to={`/measure?system=${encodeURIComponent(s.id)}`} className={card}>
                  <SystemArt id={s.id} />
                  <span className="block font-display font-semibold tracking-wide">{s.name}</span>
                  <span className="mt-1 block text-sm text-env-muted">
                    {inds.map((i) => i.name).join(' · ')}
                  </span>
                  {badge(s.id)}
                </Link>
              </li>
            )
          })}
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
            Verás los pendientes en la cabecera. Mientras tanto, el panel la evalúa en este
            dispositivo y la marca como «provisional».
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
    // Con varios indicadores (p. ej. cardiovascular), el formulario es más ancho y los campos van
    // en dos columnas (un par de filas) en vez de en una sola columna larga.
    <form
      onSubmit={submit}
      className={`mx-auto space-y-4 max-[341px]:space-y-1.5 max-[341px]:[&_h1]:text-xl max-[341px]:[&_textarea]:h-8 max-[341px]:[&_textarea]:py-1 ${fields.length > 1 ? 'max-w-4xl' : 'max-w-xl'}`}
      noValidate
    >
      <Link to="/measure" className="text-sm text-env-muted hover:text-env-text hover:underline">
        ← Elegir otra cosa
      </Link>
      <h1 className="text-2xl font-semibold">{heading}</h1>

      <fieldset disabled={phase.kind === 'sending'} className="space-y-4 max-[341px]:space-y-2">
        <div
          // También en móvil (< 768 px) van de dos en dos, con el contenido más compacto, para
          // no tener que bajar con scroll. Hasta 340 px no caben dos: una columna, pero con
          // tarjetas pequeñas (sin el rótulo «Cómo medir», letra y campos más bajos).
          className={`grid gap-4 ${
            fields.length > 1
              ? 'grid-cols-2 max-md:gap-2 [&_fieldset]:min-w-0 max-md:[&_fieldset]:p-2.5 max-md:[&_input]:min-w-0 max-md:[&_input]:px-2 max-md:[&_legend]:text-sm max-md:[&_ol]:text-xs max-[341px]:grid-cols-1 max-[341px]:gap-1 max-[341px]:[&_fieldset]:px-2 max-[341px]:[&_fieldset]:py-1 max-[341px]:[&_input]:px-1.5 max-[341px]:[&_input]:py-1 max-[341px]:[&_input]:text-sm max-[341px]:[&_ol]:space-y-0 max-[341px]:[&_ol]:text-[0.75rem] max-[341px]:[&_ol]:leading-tight max-[341px]:[&_p.uppercase]:hidden'
              : ''
          }`}
        >
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
        </div>

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
        className="w-full rounded-lg bg-env-primary px-4 py-3 font-medium max-[341px]:py-2 text-env-primary-text disabled:opacity-60"
      >
        {phase.kind === 'sending' ? 'Guardando…' : 'Guardar medición'}
      </button>
      <VoiceNote
        texts={fields.flatMap((f) => f.measurement_instructions)}
        className="text-center"
      />
    </form>
  )
}
