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
import { MeasureStep } from '../components/measure/MeasureStep'
import { SystemArt } from '../components/measure/SystemArt'
import { emptyValue, parseValue, type RawValue } from '../components/measure/measureForm'
import { statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { sendMeasurements } from '../offline/outbox'
import { pushToast } from '../store/toasts'
import { useEnvironmentStore } from '../store/environment'
import { useActiveMemberId, useAuth } from '../auth/useAuth'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'
import { AutoTextarea } from '../components/ui/AutoTextarea'

/** Sistema cuyas escalas (ánimo, estrés…) se registran con el check-in diario, no con este formulario. */
const CHECKIN_SYSTEM = 'neuro_behavioral'
/** Indicadores que tienen su propio test (check-in diario y PVT): no se piden en «Medir». */
const OWN_TEST: readonly string[] = [...CHECKIN_INDICATORS, ...PVT_INDICATORS]

type Phase = { kind: 'editing' } | { kind: 'sending' } | { kind: 'failed'; message: string }

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
        <div className="h-40 animate-pulse  bg-env-surface" aria-busy="true" />
      </section>
    )
  }

  // Neuro-conductual → check-in diario (solo quien puede hacerlo; el resto ve el formulario).
  if (toCheckin && systemParam === CHECKIN_SYSTEM && !indicatorParam) {
    return <Navigate to="/checkin" replace />
  }

  // Se pidió un sistema o indicador que este entorno no mide: decirlo (antes volvía a la lista
  // sin explicar nada y parecía que el botón no hacía nada).
  if (fields.length === 0 && (systemParam || indicatorParam) && catalog.state === 'ready') {
    const sysName =
      systems.state === 'ready' ? systems.data.find((x) => x.id === systemParam)?.name : undefined
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        {title}
        <div className="hud-panel p-4" role="status">
          <p className="font-medium">
            {sysName ?? 'Este indicador'} no se mide en {env?.name ?? 'este entorno'}.
          </p>
          <p className="mt-1 text-sm text-env-muted">
            Ningún indicador de este sistema está activo en la configuración del entorno.
          </p>
        </div>
        <Link to="/measure" className="hud-btn hud-btn-primary">
          Elegir qué medir
        </Link>
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
      <section className="flex flex-1 flex-col gap-4">
        <div>
          {title}
          <p className="text-env-muted lg:text-lg">¿Qué quieres medir?</p>
        </div>
        {/* Las tarjetas reparten el alto disponible (filas iguales) y crecen con la pantalla. */}
        <ul className="grid flex-1 auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {withIndicators.map(({ s, inds }) => {
            const card =
              'relative isolate flex h-full flex-col justify-center gap-1 overflow-hidden  border border-env-border bg-env-surface p-4 pt-12 hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary lg:p-6 lg:pt-14 [&>span:nth-of-type(1)]:lg:text-xl [&>span:nth-of-type(2)]:lg:text-base'
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
      onDone={() => navigate('/measure')}
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
  // Con varios indicadores (p. ej. cardiovascular) se miden de uno en uno: un paso por
  // indicador y, al final, un resumen para repasar y guardar. `step === fields.length` = resumen.
  const multi = fields.length > 1
  const [step, setStep] = useState(0)
  const reviewing = multi && step === fields.length
  const current = fields[Math.min(step, fields.length - 1)]

  const setValue = (id: string, v: RawValue) => {
    setValues((s) => ({ ...s, [id]: v }))
    setErrors((s) => {
      const next = { ...s }
      delete next[id]
      return next
    })
    if (phase.kind === 'failed') setPhase({ kind: 'editing' })
  }
  /** Valida el indicador del paso actual; si está mal, se queda en él con el error a la vista. */
  const currentIsValid = () => {
    const r = parseValue(values[current.id], current.input, current.unit)
    if (r.ok === false) {
      setErrors((s) => ({ ...s, [current.id]: r.error }))
      return false
    }
    return true
  }
  const filled = (f: Indicator) => parseValue(values[f.id], f.input, f.unit)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // En un paso intermedio, Intro o «Siguiente» avanzan (no guardan).
    if (multi && !reviewing) {
      if (currentIsValid()) setStep((n) => n + 1)
      return
    }
    const errs: Record<string, string> = {}
    const ok: { id: string; value: number }[] = []
    for (const f of fields) {
      const r = parseValue(values[f.id], f.input, f.unit)
      if (r.ok === true) ok.push({ id: f.id, value: r.value })
      else if (r.ok === false) errs[f.id] = r.error
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      // Vuelve al primer indicador con un valor no válido.
      if (multi) setStep(fields.findIndex((f) => errs[f.id]))
      return
    }
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
      // Aviso con el resultado y de vuelta a Medir para seguir (sin pantalla intermedia vacía).
      if (r.status === 'sent') {
        const a = r.result.assessment
        const sys = a.systems.find((x) => x.system_id === fields[0].system_id)
        pushToast({
          tone: 'success',
          icon: 'pulse',
          label: 'Medición enviada',
          title: `${heading}: ${statusStyle(sys?.status ?? a.overall_status).label}`,
          body:
            (r.result.accepted === 1
              ? '1 valor guardado'
              : `${r.result.accepted} valores guardados`) +
            ` · estado general: ${statusStyle(a.overall_status).label.toLowerCase()}`,
          actions: [{ label: 'Ver el panel', to: '/dashboard' }],
        })
      } else {
        pushToast({
          tone: 'info',
          icon: 'upload',
          label: 'Guardada en el dispositivo',
          title: 'Sin conexión con el servidor',
          body: 'La medición se enviará sola al volver la conexión, sin duplicarse.',
        })
      }
      onDone()
    } catch (err) {
      // Solo si falla el propio guardado local (IndexedDB no disponible).
      setPhase({
        kind: 'failed',
        message: `No se ha podido guardar en el dispositivo: ${String(err)}`,
      })
    }
  }

  const busy = phase.kind === 'sending'
  const noteField = (
    <label className="flex flex-col gap-1">
      <span className="hud-label">Nota (opcional)</span>
      <AutoTextarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="hud-input w-full py-2.5 !font-sans !text-[0.9375rem] leading-snug"
      />
    </label>
  )

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-md flex-col gap-3 md:gap-4 lg:max-w-3xl"
      noValidate
    >
      <div>
        <Link to="/measure" className="text-sm text-env-muted hover:text-env-text hover:underline">
          ← Elegir otra cosa
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{heading}</h1>
      </div>

      {multi && (
        // Progreso: un tramo por indicador (toca uno para volver a él) y el resumen al final.
        <ol className="flex items-center gap-1.5" aria-label="Pasos de la medición">
          {fields.map((f, i) => {
            const r = filled(f)
            return (
              <li key={f.id} className="flex-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep(i)}
                  aria-current={step === i ? 'step' : undefined}
                  aria-label={`Paso ${i + 1}: ${f.name}${r.ok === true ? ' (con valor)' : ''}`}
                  className="relative block h-2 w-full before:absolute before:inset-x-0 before:-inset-y-[18px] before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-env-primary"
                  style={{
                    background:
                      step === i
                        ? 'var(--env-primary)'
                        : r.ok === true
                          ? 'color-mix(in srgb, var(--env-primary) 55%, transparent)'
                          : 'var(--env-border)',
                  }}
                />
              </li>
            )
          })}
        </ol>
      )}

      <fieldset disabled={busy} className="hud-panel min-w-0">
        <legend className="sr-only">{reviewing ? 'Resumen' : current.name}</legend>
        <div className="hud-panel-head">
          {reviewing ? 'Resumen' : current.name}
          {multi && (
            <span className="mr-2.5 ml-auto tracking-normal text-env-muted normal-case">
              {reviewing ? 'Repasa y guarda' : `Paso ${step + 1} de ${fields.length}`}
            </span>
          )}
        </div>
        <div className="p-3.5 md:p-4">
          {reviewing ? (
            <div className="flex flex-col gap-4">
              <ul className="divide-y divide-env-border/60">
                {fields.map((f, i) => {
                  const r = filled(f)
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => setStep(i)}
                        className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left hover:bg-env-primary/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary"
                      >
                        <span className="min-w-0 truncate">{f.name}</span>
                        <span
                          className={`shrink-0 tabular-nums ${r.ok === true ? 'font-semibold' : 'text-env-muted'}`}
                        >
                          {r.ok === true
                            ? `${r.value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} ${f.unit}`
                            : r.ok === false
                              ? 'Valor no válido'
                              : 'Sin valor'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {noteField}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <MeasureStep
                key={current.id}
                indicator={current}
                value={values[current.id]}
                error={errors[current.id]}
                onChange={(v) => setValue(current.id, v)}
              />
              {!multi && noteField}
            </div>
          )}
        </div>
      </fieldset>

      {phase.kind === 'failed' && (
        <p className="hud-panel p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          {phase.message}
        </p>
      )}

      <div className="flex gap-2">
        {multi && step > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep((n) => n - 1)}
            className="hud-btn shrink-0 px-4"
          >
            Atrás
          </button>
        )}
        {multi && !reviewing && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              // Omitir deja el indicador sin valor (no se envía) y pasa al siguiente.
              setValue(current.id, emptyValue(current.input.type))
              setStep((n) => n + 1)
            }}
            className="hud-btn shrink-0 px-4"
          >
            Omitir
          </button>
        )}
        <button type="submit" disabled={busy} className="hud-btn hud-btn-primary min-w-0 flex-1">
          {busy
            ? 'Guardando…'
            : multi && !reviewing
              ? step === fields.length - 1
                ? 'Ver resumen'
                : 'Siguiente'
              : 'Guardar medición'}
        </button>
      </div>
      <VoiceNote
        texts={fields.flatMap((f) => f.measurement_instructions)}
        className="text-center"
      />
    </form>
  )
}
