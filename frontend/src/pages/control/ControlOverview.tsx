import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { serverNow } from '../../api/client'
import { useControlOverview, useRecentEvents } from '../../api/useControl'
import { severityStyle } from '../../components/alerts/alertFormat'
import { ControlHeader, ControlPanel } from '../../components/control/ControlHeader'
import { formatDuration, GROUPS, groupOf, mergeEvents } from '../../components/control/feed'
import { OperatorMessageButton } from '../../components/control/OperatorMessageForm'
import { useControlScope } from '../../components/control/useControlScope'
import { describeLink, hhmm } from '../../components/ui/link'
import { livenessState } from '../../components/ui/status'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { capitalize, useVocab } from '../../environments/useVocab'
import { formatAgo } from '../../lib/time'
import { useEvents } from '../../realtime/events'
import type { RealtimeEvent } from '../../realtime/match'
import { useEnvironmentStore } from '../../store/environment'

/** Tipos del feed en vivo (los heartbeats se quedan fuera: son ruido). */
const FEED_TYPES = [
  'measurement.*',
  'liveness.*',
  'alert.*',
  'link.*',
  'sync.*',
  'auth.*',
  'task.*',
  'device.*',
  'user.*',
  'notification.*',
] as const

/**
 * Centro de control (FE-31, solo admin): panorama del entorno activo en tiempo real y sin el
 * retardo del enlace. Métricas, estado de cada member (clic → su panel) y eventos en vivo. Lo
 * demás tiene su sección: Simulación, Usuarios, Dispositivos y Registro.
 */
export default function ControlOverview() {
  const { envId, env, recipients, memberId, memberName } = useControlScope()
  const vocab = useVocab()
  const navigate = useNavigate()
  const overview = useControlOverview(envId)
  const recent = useRecentEvents(envId)
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const [group, setGroup] = useState('')

  useEffect(() => setEvents([]), [envId])
  // Depende de los datos, no del objeto de useLoad (es nuevo en cada render).
  const recentData = recent.state === 'ready' ? recent.data : null
  useEffect(() => {
    if (recentData) setEvents((cur) => mergeEvents(cur, recentData))
  }, [recentData])

  useEvents({ types: [...FEED_TYPES], envId }, (e) => {
    if (!e || e.type === 'heartbeat') return
    setEvents((cur) => mergeEvents(cur, [e]))
    setFresh((s) => new Set(s).add(e.id))
    setTimeout(
      () =>
        setFresh((s) => {
          const n = new Set(s)
          n.delete(e.id)
          return n
        }),
      4000,
    )
  })

  const now = serverNow()
  const data = overview.state === 'ready' ? overview.data : null
  const envOv = data?.environments[0]
  const metrics = data?.metrics
  const link = envOv ? describeLink(envOv.link) : null
  const members = envOv ? envOv.members.filter((m) => memberId === null || m.id === memberId) : []
  const shown = events.filter(
    (e) =>
      e.type !== 'heartbeat' &&
      (!group || groupOf(e.type) === group) &&
      (memberId === null || e.member_id === memberId),
  )
  const feedGroups = Object.entries(GROUPS).filter(([k]) => k !== 'heartbeat')

  const openMember = (id: number) => {
    useEnvironmentStore.getState().selectMember(id)
    navigate('/dashboard')
  }

  return (
    <section className="flex flex-col gap-4">
      <ControlHeader
        title="Centro de control"
        subtitle={
          <>
            Panorama en tiempo real, sin el retardo del enlace
            {data && ` · actualizado ${formatAgo(data.generated_at, now)}`}
            {overview.refreshFailed && ' · ⚠ no se pudo actualizar'}
          </>
        }
        memberScope
        actions={
          env && (
            <OperatorMessageButton
              recipients={recipients}
              memberId={memberId}
              ladder={env.escalation_ladder}
              vocabulary={env.vocabulary}
            />
          )
        }
      />

      {!envId ? (
        <p className="text-env-muted">Elige un entorno para ver su panorama.</p>
      ) : (
        <>
          <section aria-label="Métricas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ['Mediciones (última hora)', metrics?.measurements_last_hour],
                ['Alertas abiertas', metrics?.open_alerts],
                [
                  'Respuesta media',
                  metrics ? formatDuration(metrics.avg_alert_response_s) : undefined,
                ],
                ['Dispositivos activos', metrics?.active_devices],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="hud-panel px-4 py-3">
                <p className="hud-label">{label}</p>
                <p className="mt-1 text-3xl font-light tabular-nums">{value ?? '—'}</p>
              </div>
            ))}
          </section>

          {overview.state === 'error' && (
            <p className="text-env-muted">
              No se ha podido cargar el panorama.{' '}
              <button type="button" onClick={overview.retry} className="underline">
                Reintentar
              </button>
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
            <ControlPanel
              title={capitalize(vocab.crew)}
              aside={
                link && (
                  <span title={link.long}>
                    {link.icon} {link.short}
                    {envOv && envOv.link.queued > 0 && ` · ${envOv.link.queued} en cola`}
                  </span>
                )
              }
              bodyClassName=""
            >
              {envOv && (
                <div className="flex flex-wrap items-center gap-1.5 border-b border-env-border/60 px-4 py-2.5">
                  {(['emergency', 'critical', 'warning'] as const).every(
                    (s) => envOv.open_alerts[s] === 0,
                  ) ? (
                    <span className="text-sm text-env-muted">Sin alertas abiertas</span>
                  ) : (
                    (['emergency', 'critical', 'warning'] as const)
                      .filter((s) => envOv.open_alerts[s] > 0)
                      .map((s) => (
                        <StatusBadge
                          key={s}
                          status={severityStyle(s).status}
                          label={`${envOv.open_alerts[s]} ${severityStyle(s).label.toLowerCase()}`}
                          size="sm"
                        />
                      ))
                  )}
                  {envOv.liveness_paused && (
                    <span className="text-xs text-env-muted">
                      · vigilancia de contacto en pausa
                    </span>
                  )}
                </div>
              )}
              {overview.state === 'loading' && <div className="m-4 h-40 animate-pulse bg-env-bg" />}
              {envOv && members.length === 0 && (
                <p className="p-4 text-sm text-env-muted">Sin {vocab.crew}.</p>
              )}
              <ul className="divide-y divide-env-border/60">
                {members.map((m) => {
                  const live = livenessState(m.liveness)
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => openMember(m.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-env-primary/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{m.name}</span>
                          <span className="block text-xs text-env-muted">
                            {m.last_measurement_at
                              ? `medido ${formatAgo(m.last_measurement_at, now)}`
                              : 'sin mediciones'}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1">
                          {!(live === 'stale' && m.overall_status === 'unknown') && (
                            <StatusBadge status={m.overall_status} size="sm" />
                          )}
                          {live && <StatusBadge status={live} size="sm" />}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </ControlPanel>

            <ControlPanel
              title="Eventos en vivo"
              aside={
                <label className="flex items-center gap-2">
                  <span className="sr-only">Tipo de evento</span>
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    className="hud-input !py-0.5 !font-sans !text-sm"
                  >
                    <option value="">Todos</option>
                    {feedGroups.map(([k, g]) => (
                      <option key={k} value={k}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
              }
              bodyClassName=""
            >
              <ol
                aria-live="polite"
                className="max-h-[30rem] divide-y divide-env-border/60 overflow-y-auto [scrollbar-color:var(--env-border)_transparent]"
              >
                {shown.length === 0 && <li className="p-4 text-sm text-env-muted">Sin eventos.</li>}
                {shown.map((e) => (
                  <li
                    key={e.id}
                    className={`flex gap-3 px-4 py-2 text-sm transition-colors ${
                      fresh.has(e.id) ? 'bg-env-primary/10' : ''
                    }`}
                  >
                    <span aria-hidden className="w-5 shrink-0 text-center">
                      {GROUPS[groupOf(e.type)]?.icon ?? '·'}
                    </span>
                    <span className="w-12 shrink-0 text-env-muted tabular-nums">{hhmm(e.at)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.summary || e.type}</span>
                      <span className="block truncate text-xs text-env-muted">
                        {GROUPS[groupOf(e.type)]?.label ?? e.type}
                        {e.member_id != null && ` · ${memberName(e.member_id)}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </ControlPanel>
          </div>
        </>
      )}
    </section>
  )
}
