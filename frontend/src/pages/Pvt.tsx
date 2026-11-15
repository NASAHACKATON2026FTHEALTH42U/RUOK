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
import { emphasize } from '../components/behavioral/voice'
import { ListenButton, VoiceNote } from '../components/behavioral/VoiceControls'
import { stopSpeaking } from '../components/behavioral/voiceGuide'
import voiceTexts from '../components/behavioral/voiceTexts.json'
import { CaseFeedbackFor } from '../components/alerts/CaseFeedbackNote'
import { formatValue } from '../components/dashboard/format'
import { statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { sendMeasurements, type MeasurementBatchResult } from '../offline/outbox'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'
import { useT } from '../i18n/t'

type Phase =
  | { kind: 'intro' }
  | { kind: 'running'; mode: PvtMode }
  | { kind: 'saving'; summary: PvtSummary }
  | { kind: 'sent'; summary: PvtSummary; result: MeasurementBatchResult }
  | { kind: 'queued'; summary: PvtSummary }
  | { kind: 'empty'; summary: PvtSummary }
  | { kind: 'failed'; summary: PvtSummary; message: string }

const btnPrimary =
  ' bg-env-primary px-4 py-3 font-medium text-env-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary'
const btnSecondary = ' border border-env-border px-4 py-2 hover:border-env-text'

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
  const t = useT()
  const memberId = useActiveMemberId() // un member: siempre el suyo; el resto: el elegido
  const catalog = useIndicators()
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })

  const indicators = useMemo(() => {
    const all = catalog.state === 'ready' ? catalog.data : []
    return Object.fromEntries(
      PVT_INDICATORS.map((id) => [id, all.find((i) => i.id === id)] as const),
    )
  }, [catalog])

  const title = <h1 className="text-2xl font-semibold">{t('Test de vigilancia (PVT)')}</h1>

  if (memberId === null) {
    return (
      <section>
        {title}
        <NoMemberSelected />
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
        message: t('No se ha podido guardar en el dispositivo: {error}', { error: String(err) }),
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
    stopSpeaking() // la voz guía nunca suena durante la prueba
    void enterFullscreen()
    setPhase({ kind: 'running', mode })
  }

  if (phase.kind === 'intro') {
    // Las instrucciones salen de voiceTexts.json: son las mismas frases que tiene la voz guía
    // (traducidas al idioma de la interfaz, para verlas y oírlas igual).
    const pvtTexts = voiceTexts.pvt.map((text) => t(text))
    const [lead, ...howTo] = pvtTexts
    return (
      <section className="mx-auto my-auto w-full max-w-xl space-y-4 lg:max-w-3xl lg:space-y-6">
        {title}
        <div className="space-y-2  border border-env-border bg-env-surface p-4 text-sm lg:space-y-3 lg:p-6 lg:text-lg">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p>{lead}</p>
            <ListenButton texts={pvtTexts} label={t('Escuchar instrucciones')} />
          </div>
          <ol className="list-decimal space-y-1 pl-5">
            {howTo.map((text) => (
              <li key={text}>
                {emphasize(text).map((part, i) =>
                  part.strong ? <strong key={i}>{part.text}</strong> : part.text,
                )}
              </li>
            ))}
          </ol>
          <p className="text-env-muted">
            {emphasize(
              t('Una respuesta de más de {ms} ms es un «lapso» de atención.', { ms: LAPSE_MS }),
            ).map((part, i) => (part.strong ? <em key={i}>{part.text}</em> : part.text))}
          </p>
          <VoiceNote texts={pvtTexts} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(PVT_MODES) as PvtMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => start(m)}
              className={`${btnPrimary} lg:min-h-16 lg:text-lg`}
            >
              {t(PVT_MODES[m].label)} · {PVT_MODES[m].short}
            </button>
          ))}
        </div>
      </section>
    )
  }

  const { summary } = phase
  const rtName = indicators.pvt_mean_rt_ms?.name ?? t('Tiempo de reacción medio')
  const lapsesName = indicators.pvt_lapses?.name ?? t('Lapsos')

  return (
    <section className="mx-auto my-auto w-full max-w-xl space-y-4 lg:max-w-3xl lg:space-y-6">
      <h1 className="text-2xl font-semibold">
        {phase.kind === 'sent'
          ? t('Test guardado')
          : phase.kind === 'queued'
            ? t('Test guardado en el dispositivo')
            : phase.kind === 'saving'
              ? t('Guardando…')
              : t('Resultado del test')}
      </h1>

      <dl className="grid grid-cols-2 gap-3">
        <div className=" border border-env-border bg-env-surface p-4">
          <dt className="text-sm text-env-muted">{rtName}</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums">
            {formatValue(summary.meanRtMs, 'ms')}
          </dd>
        </div>
        <div className=" border border-env-border bg-env-surface p-4">
          <dt className="text-sm text-env-muted">{lapsesName}</dt>
          <dd className="mt-1 text-3xl font-semibold tabular-nums">{summary.lapses}</dd>
        </div>
      </dl>
      <p className="text-sm text-env-muted">
        {t('{n} respuestas válidas · {f} falsos inicios', {
          n: summary.responses,
          f: summary.falseStarts,
        })}
      </p>

      {phase.kind === 'sent' && (
        <p
          className="flex flex-wrap items-center gap-2  border border-env-border bg-env-surface p-4 text-sm text-env-muted"
          role="status"
        >
          {t('Evaluación actualizada:')}
          <StatusBadge
            status={phase.result.assessment.overall_status}
            label={t('Estado general: {status}', {
              status: statusStyle(phase.result.assessment.overall_status).label,
            })}
            size="sm"
          />
        </p>
      )}
      {phase.kind === 'sent' && (
        <CaseFeedbackFor
          systemId="neuro_behavioral"
          current={
            phase.result.assessment.systems.find((s) => s.system_id === 'neuro_behavioral')?.status
          }
        />
      )}
      {phase.kind === 'queued' && (
        <p className=" border border-env-border bg-env-surface p-4 text-sm" role="status">
          <span aria-hidden>⇡ </span>
          {t('No hay conexión con el servidor. El resultado está guardado aquí y')}{' '}
          <strong>{t('se enviará solo')}</strong> {t('cuando vuelva la conexión, sin duplicarse.')}
        </p>
      )}
      {phase.kind === 'empty' && (
        <p className=" border border-env-border bg-env-surface p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          {t(
            'No se ha registrado ninguna respuesta válida, así que no se guarda nada. Repite el test.',
          )}
        </p>
      )}
      {phase.kind === 'failed' && (
        <p className=" border border-env-border bg-env-surface p-3 text-sm" role="alert">
          <span aria-hidden>⚠ </span>
          {phase.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setPhase({ kind: 'intro' })} className={btnSecondary}>
          {t('Repetir el test')}
        </button>
        <Link to="/history?indicator=pvt_mean_rt_ms" className={btnSecondary}>
          {t('Ver el historial')}
        </Link>
        <Link to="/dashboard" className={btnSecondary}>
          {t('Ver el panel')}
        </Link>
      </div>
    </section>
  )
}
