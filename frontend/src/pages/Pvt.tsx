import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { serverNow } from '../api/client'
import { useActiveMemberId } from '../auth/useAuth'
import { newId } from '../api/newId'
import { useIndicators } from '../api/useIndicators'
import {
  buildPvtBatch,
  LAPSE_MS,
  PVT_INDICATORS,
  PVT_MODES,
  type PvtMode,
  type PvtSummary,
} from '../components/behavioral/pvt'
import { PvtRunner } from '../components/behavioral/PvtRunner'
import { formatValue } from '../components/dashboard/format'
import { statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useVocab } from '../environments/useVocab'
import { sendMeasurements, type MeasurementBatchResult } from '../offline/outbox'

type Phase =
  | { kind: 'intro' }
  | { kind: 'running'; mode: PvtMode }
  | { kind: 'saving'; summary: PvtSummary }
  | { kind: 'sent'; summary: PvtSummary; result: MeasurementBatchResult }
  | { kind: 'queued'; summary: PvtSummary }
  | { kind: 'empty'; summary: PvtSummary }
  | { kind: 'failed'; summary: PvtSummary; message: string }

const btnPrimary =
  'rounded-lg bg-env-primary px-4 py-3 font-medium text-env-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary'
const btnSecondary = 'rounded-lg border border-env-border px-4 py-2 hover:border-env-text'

async function enterFullscreen() {
  try {
    await document.documentElement.requestFullscreen?.()
  } catch {
    // iOS Safari y algunos navegadores no lo permiten: el test ya ocupa toda la ventana.
  }
}
function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

/**
 * Test de vigilancia psicomotora (PVT, FE-22). Completo (3 min) o versión demo (30 s), a
 * pantalla completa y pensado para el móvil. Al acabar se guardan el tiempo de reacción medio
 * y los lapsos como mediciones con `source: "pvt"` por el outbox (FE-11).
 */
export default function Pvt() {
  const vocab = useVocab()
  const memberId = useActiveMemberId() // un member: siempre el suyo; el resto: el elegido
  const catalog = useIndicators()
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })

  const indicators = useMemo(() => {
    const all = catalog.state === 'ready' ? catalog.data : []
    return Object.fromEntries(
      PVT_INDICATORS.map((id) => [id, all.find((i) => i.id === id)] as const),
    )
  }, [catalog])

  const title = <h1 className="text-2xl font-semibold">Test de vigilancia (PVT)</h1>

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

  const save = async (summary: PvtSummary, mode: PvtMode) => {
    exitFullscreen()
    const batch = buildPvtBatch(summary, mode, serverNow().toISOString(), newId, {
      pvt_mean_rt_ms: indicators.pvt_mean_rt_ms?.input,
      pvt_lapses: indicators.pvt_lapses?.input,
    })
    if (batch.length === 0) {
      setPhase({ kind: 'empty', summary })
      return
    }
    setPhase({ kind: 'saving', summary })
    try {
      const r = await sendMeasurements(memberId, batch)
      setPhase(
        r.status === 'sent'
          ? { kind: 'sent', summary, result: r.result }
          : { kind: 'queued', summary },
      )
    } catch (err) {
      setPhase({
        kind: 'failed',
        summary,
        message: `No se ha podido guardar en el dispositivo: ${String(err)}`,
      })
    }
  }

  if (phase.kind === 'running') {
    return (
      <PvtRunner
        mode={phase.mode}
        onFinish={(s) => void save(s, phase.mode)}
        onCancel={() => {
          exitFullscreen()
          setPhase({ kind: 'intro' })
        }}
      />
    )
  }

  const start = (mode: PvtMode) => {
    void enterFullscreen()
    setPhase({ kind: 'running', mode })
  }

  if (phase.kind === 'intro') {
    return (
      <section className="mx-auto max-w-xl space-y-4">
        {title}
        <div className="space-y-2 rounded-xl border border-env-border bg-env-surface p-4 text-sm">
          <p>Mide tu tiempo de reacción, un marcador objetivo de fatiga.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>La pantalla espera un rato al azar (entre 2 y 10 s).</li>
            <li>
              Cuando cambie de color y diga <strong>¡Pulsa!</strong>, toca la pantalla lo antes
              posible (o la barra espaciadora).
            </li>
            <li>No pulses antes de tiempo: cuenta como falso inicio.</li>
          </ol>
          <p className="text-env-muted">
            Una respuesta de más de {LAPSE_MS} ms es un <em>lapso</em> de atención.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(PVT_MODES) as PvtMode[]).map((m) => (
            <button key={m} type="button" onClick={() => start(m)} className={btnPrimary}>
              {PVT_MODES[m].label} · {PVT_MODES[m].short}
            </button>
          ))}
        </div>
      </section>
    )
  }

  const { summary } = phase
  const rtName = indicators.pvt_mean_rt_ms?.name ?? 'Tiempo de reacción medio'
  const lapsesName = indicators.pvt_lapses?.name ?? 'Lapsos'

  return (
    <section className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">
        {phase.kind === 'sent'
          ? 'Test guardado'
          : phase.kind === 'queued'
            ? 'Test guardado en el dispositivo'
            : phase.kind === 'saving'
              ? 'Guardando…'
              : 'Resultado del test'}
      </h1>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-env-border bg-env-surface p-4">
          <dt className="text-sm text-env-muted">{rtName}</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums">
            {formatValue(summary.meanRtMs, 'ms')}
          </dd>
        </div>
        <div className="rounded-xl border border-env-border bg-env-surface p-4">
          <dt className="text-sm text-env-muted">{lapsesName}</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums">{summary.lapses}</dd>
        </div>
      </dl>
      <p className="text-sm text-env-muted">
        {summary.responses} respuestas válidas · {summary.falseStarts} falsos inicios
      </p>

      {phase.kind === 'sent' && (
        <p
          className="flex flex-wrap items-center gap-2 rounded-xl border border-env-border bg-env-surface p-4 text-sm text-env-muted"
          role="status"
        >
          Evaluación actualizada:
          <StatusBadge
            status={phase.result.assessment.overall_status}
            label={`Estado general: ${statusStyle(phase.result.assessment.overall_status).label}`}
            size="sm"
          />
        </p>
      )}
      {phase.kind === 'queued' && (
        <p className="rounded-xl border border-env-border bg-env-surface p-4 text-sm" role="status">
          <span aria-hidden>⇡ </span>
          No hay conexión con el servidor. El resultado está guardado aquí y{' '}
          <strong>se enviará solo</strong> cuando vuelva la conexión, sin duplicarse.
        </p>
      )}
      {phase.kind === 'empty' && (
        <p className="rounded-lg border border-env-border bg-env-surface p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          No se ha registrado ninguna respuesta válida, así que no se guarda nada. Repite el test.
        </p>
      )}
      {phase.kind === 'failed' && (
        <p className="rounded-lg border border-env-border bg-env-surface p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          {phase.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPhase({ kind: 'intro' })} className={btnSecondary}>
          Repetir el test
        </button>
        <Link to="/history?indicator=pvt_mean_rt_ms" className={btnSecondary}>
          Ver el historial
        </Link>
        <Link to="/dashboard" className={btnSecondary}>
          Ver el panel
        </Link>
      </div>
    </section>
  )
}
