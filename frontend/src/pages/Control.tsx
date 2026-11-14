import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { serverNow } from '../api/client'
import {
  useControlOverview,
  useDevices,
  useRecentEvents,
  type ControlOverview,
} from '../api/useControl'
import { useEnvironments } from '../api/useEnvironments'
import {
  EMPTY_FILTERS,
  filterEvents,
  formatDuration,
  GROUPS,
  groupOf,
  mergeEvents,
  type FeedFilters,
} from '../components/control/feed'
import { severityStyle } from '../components/alerts/alertFormat'
import { ConnectQr } from '../components/control/ConnectQr'
import { DemoControls } from '../components/control/DemoControls'
import { EnvironmentConfig } from '../components/control/EnvironmentConfig'
import { describeLink, hhmm } from '../components/ui/link'
import { livenessState } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { formatAgo } from '../lib/time'
import { useEvents } from '../realtime/events'
import type { RealtimeEvent } from '../realtime/match'
import { useEnvironmentStore } from '../store/environment'

/**
 * Centro de control (FE-31, solo admin): vista global, en tiempo real y SIN retardo de todos los
 * entornos. Métricas, panorama por entorno (clic en un member → su dashboard), feed de eventos
 * en vivo con filtros y dispositivos. Gestión (FE-32): controles de demo, entorno activo con su
 * configuración y QR de conexión. Pensado para proyector o pantalla grande.
 */
export default function Control() {
  const overview = useControlOverview()
  const devices = useDevices()
  const recent = useRecentEvents()
  const allEnvs = useEnvironments()
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS)

  // Depende de los datos, no del objeto de useLoad (es nuevo en cada render): si no, cada
  // setEvents provocaba otro render y otro efecto ("Maximum update depth exceeded").
  const recentData = recent.state === 'ready' ? recent.data : null
  useEffect(() => {
    if (recentData) setEvents((cur) => mergeEvents(cur, recentData))
  }, [recentData])

  // Feed en vivo: todos los eventos (el admin recibe todo por SSE, FE-29).
  useEvents(
    {
      types: [
        'measurement.*',
        'heartbeat',
        'liveness.*',
        'alert.*',
        'link.*',
        'sync.*',
        'auth.*',
        'task.*',
        'device.*',
      ],
    },
    (e) => {
      if (!e) return
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
    },
  )

  const deviceLabel = useMemo(() => {
    const m = new Map<string, string>()
    if (devices.state === 'ready')
      for (const d of devices.data) m.set(d.id, d.label ?? d.id.slice(0, 8))
    return m
  }, [devices])

  const now = serverNow()
  const shown = filterEvents(events, filters)
  const metrics = overview.state === 'ready' ? overview.data.metrics : null

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-semibold">Centro de control</h1>
        <p className="text-sm text-env-muted">
          Vista global, en tiempo real y sin retardo del enlace
          {overview.state === 'ready' &&
            ` · actualizado ${formatAgo(overview.data.generated_at, now)}`}
          {overview.refreshFailed && ' · ⚠ no se pudo actualizar'}
        </p>
      </header>

      {/* 1. Métricas */}
      <section aria-label="Métricas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Mediciones (última hora)', metrics?.measurements_last_hour],
          ['Alertas abiertas', metrics?.open_alerts],
          [
            'Respuesta media a alertas',
            metrics ? formatDuration(metrics.avg_alert_response_s) : undefined,
          ],
          ['Dispositivos activos', metrics?.active_devices],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-xl border border-env-border bg-env-surface p-4"
          >
            <p className="text-sm text-env-muted">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value ?? '—'}</p>
          </div>
        ))}
      </section>

      {/* Gestión de la demo (FE-32) */}
      {overview.state === 'ready' && (
        <DemoControls overview={overview.data} onChanged={overview.refresh} />
      )}

      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        {/* 2. Panorama por entorno */}
        <section aria-label="Panorama">
          <h2 className="mb-3 text-xl font-semibold">Entornos</h2>
          {overview.state === 'loading' && (
            <div className="h-48 animate-pulse rounded-xl bg-env-surface" />
          )}
          {overview.state === 'error' && (
            <p className="text-env-muted">
              No se ha podido cargar el panorama.{' '}
              <button type="button" onClick={overview.retry} className="underline">
                Reintentar
              </button>
            </p>
          )}
          {overview.state === 'ready' && (
            <div className="grid gap-3 md:grid-cols-2">
              {overview.data.environments.map((e) => (
                <EnvironmentPanel key={e.environment.id} env={e} now={now} />
              ))}
            </div>
          )}
        </section>

        {/* 3. Feed de eventos */}
        <section aria-label="Eventos en vivo" className="min-w-0">
          <h2 className="mb-3 text-xl font-semibold">Eventos en vivo</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <FilterSelect
              label="Entorno"
              value={filters.envId}
              onChange={(envId) => setFilters({ ...filters, envId })}
              options={(overview.state === 'ready' ? overview.data.environments : []).map((e) => [
                e.environment.id,
                e.environment.name,
              ])}
            />
            <FilterSelect
              label="Tipo"
              value={filters.group}
              onChange={(group) => setFilters({ ...filters, group })}
              options={Object.entries(GROUPS).map(([k, g]) => [k, g.label])}
            />
            <FilterSelect
              label="Usuario"
              value={filters.userId}
              onChange={(userId) => setFilters({ ...filters, userId })}
              options={[...new Set(events.map((e) => e.user_id).filter((u) => u != null))].map(
                (u) => [String(u), `#${u}`],
              )}
            />
            <FilterSelect
              label="Dispositivo"
              value={filters.deviceId}
              onChange={(deviceId) => setFilters({ ...filters, deviceId })}
              options={[...new Set(events.map((e) => e.device_id).filter(Boolean) as string[])].map(
                (d) => [d, deviceLabel.get(d) ?? d.slice(0, 8)],
              )}
            />
          </div>
          <ol
            aria-live="polite"
            className="max-h-[32rem] overflow-y-auto rounded-xl border border-env-border bg-env-surface"
          >
            {shown.length === 0 && <li className="p-4 text-env-muted">Sin eventos.</li>}
            {shown.map((e) => (
              <li
                key={e.id}
                className={`flex gap-3 border-b border-env-border px-3 py-2 text-sm transition-colors last:border-b-0 ${
                  fresh.has(e.id) ? 'bg-env-border/60' : ''
                }`}
              >
                <span aria-hidden className="w-5 shrink-0 text-center">
                  {GROUPS[groupOf(e.type)]?.icon ?? '·'}
                </span>
                <span className="w-12 shrink-0 tabular-nums text-env-muted">{hhmm(e.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.summary || e.type}</span>
                  <span className="block truncate text-xs text-env-muted">
                    {e.type}
                    {e.env_id && ` · ${e.env_id}`}
                    {e.device_id && ` · ${deviceLabel.get(e.device_id) ?? e.device_id.slice(0, 8)}`}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <EnvironmentConfig environments={allEnvs.state === 'ready' ? allEnvs.data : []} />
        <ConnectQr />
      </div>

      {/* 4. Dispositivos */}
      <section aria-label="Dispositivos">
        <h2 className="mb-3 text-xl font-semibold">Dispositivos</h2>
        {devices.state === 'ready' && devices.data.length === 0 && (
          <p className="text-env-muted">Ningún dispositivo registrado.</p>
        )}
        {devices.state === 'ready' && devices.data.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-env-border">
            <table className="w-full text-sm">
              <thead className="bg-env-surface text-left text-env-muted">
                <tr>
                  {[
                    'Dispositivo',
                    'Tipo',
                    'Usuario',
                    'IP',
                    'Visto',
                    'Pendientes',
                    'Última sincronización',
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.data.map((d) => (
                  <tr key={d.id} className="border-t border-env-border">
                    <td className="px-3 py-2" title={d.id}>
                      {d.label ?? d.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2">{d.kind ?? '—'}</td>
                    <td className="px-3 py-2">{d.user_id != null ? `#${d.user_id}` : '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{d.ip ?? '—'}</td>
                    <td className="px-3 py-2">{formatAgo(d.last_seen_at, now)}</td>
                    <td
                      className={`px-3 py-2 tabular-nums ${d.pending_outbox > 0 ? 'font-semibold' : ''}`}
                    >
                      {d.pending_outbox > 0 ? `⇡ ${d.pending_outbox}` : '0'}
                    </td>
                    <td className="px-3 py-2">
                      {d.last_sync_at ? formatAgo(d.last_sync_at, now) : 'nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-env-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-env-border bg-env-surface px-2 py-1.5 text-env-text"
      >
        <option value="">Todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Un entorno: enlace, alertas abiertas por severidad y members (clic → su dashboard). */
function EnvironmentPanel({
  env,
  now,
}: {
  env: ControlOverview['environments'][number]
  now: Date
}) {
  const navigate = useNavigate()
  const envs = useEnvironments()
  const link = describeLink(env.link)
  const counts = (['emergency', 'critical', 'warning'] as const).filter(
    (s) => env.open_alerts[s] > 0,
  )

  const open = (memberId: number) => {
    const full =
      envs.state === 'ready' ? envs.data.find((e) => e.id === env.environment.id) : undefined
    if (full) useEnvironmentStore.getState().selectEnvironment(full)
    useEnvironmentStore.getState().selectMember(memberId)
    navigate('/dashboard')
  }

  return (
    <article className="rounded-xl border border-env-border bg-env-surface p-4">
      <header className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{env.environment.name}</h3>
        <span className="text-xs text-env-muted" title={link.long}>
          {link.icon} {link.short}
          {env.link.queued > 0 && ` · ${env.link.queued} en cola`}
        </span>
      </header>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {counts.length === 0 ? (
          <span className="text-xs text-env-muted">Sin alertas abiertas</span>
        ) : (
          counts.map((s) => (
            <StatusBadge
              key={s}
              status={severityStyle(s).status}
              label={`${env.open_alerts[s]} ${severityStyle(s).label.toLowerCase()}`}
              size="sm"
            />
          ))
        )}
        {env.liveness_paused && <span className="text-xs text-env-muted">· liveness en pausa</span>}
      </div>
      {env.members.length === 0 ? (
        <p className="mt-3 text-sm text-env-muted">Sin members.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {env.members.map((m) => {
            const live = livenessState(m.liveness)
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => open(m.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-env-border px-2.5 py-1.5 text-left text-sm hover:border-env-text"
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
      )}
    </article>
  )
}
