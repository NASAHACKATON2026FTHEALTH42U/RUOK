import { useState } from 'react'
import { serverNow } from '../api/client'
import { useGroundView } from '../api/useGroundView'
import { useAuth } from '../auth/useAuth'
import { AlertDetail } from '../components/alerts/AlertDetail'
import {
  categoryLabel,
  severityStyle,
  sortAlerts,
  statusLabel,
} from '../components/alerts/alertFormat'
import { canSeeDetails, linkBanner } from '../components/ground/ground'
import { livenessState, statusStyle } from '../components/ui/status'
import { StatusBadge } from '../components/ui/StatusBadge'
import { capitalize, useVocab } from '../environments/useVocab'
import { formatAgo } from '../lib/time'
import { useEnvironmentStore } from '../store/environment'
import { useEnvironments } from '../api/useEnvironments'

const STRIPES =
  'repeating-linear-gradient(135deg, color-mix(in srgb, #898781 22%, transparent) 0 6px, transparent 6px 12px)'

/**
 * Consola de tierra (FE-16): lo que el enlace YA ha entregado. Banner del enlace (retardo o
 * LOS → estado DESCONOCIDO, nunca verde), members con "último dato recibido hace X" y alertas
 * entregadas con recibir, responder y resolver. Se actualiza en vivo con los eventos (FE-29).
 */
export default function Ground() {
  const vocab = useVocab()
  const { role } = useAuth()
  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const ground = useGroundView(envId)
  const [selected, setSelected] = useState<string | null>(null)
  const ladder = (envs.state === 'ready'
    ? envs.data.find((e) => e.id === envId)?.escalation_ladder
    : null) ?? ['self', 'crew', 'ground']

  const title = <h1 className="text-2xl font-semibold">Consola de {vocab.ground}</h1>
  if (!envId) {
    return (
      <section className="space-y-2">
        {title}
        <p className="text-env-muted">Tu usuario no tiene entorno asignado.</p>
      </section>
    )
  }
  if (ground.state === 'loading') {
    return (
      <section className="space-y-4">
        {title}
        <div className="h-40 animate-pulse rounded-xl bg-env-surface" />
      </section>
    )
  }
  if (ground.state === 'error') {
    return (
      <section className="space-y-2">
        {title}
        <p className="text-env-muted">
          No se ha podido cargar la consola.{' '}
          <button type="button" onClick={ground.retry} className="underline">
            Reintentar
          </button>
        </p>
      </section>
    )
  }

  const g = ground.data
  const now = serverNow()
  // Sin datos frescos (fallo al actualizar) también es "desconocido".
  const unknown = g.link.state === 'los' || ground.refreshFailed
  const banner = linkBanner(g.link, g.as_of, now)
  const alerts = sortAlerts(g.alerts)
  // La elegida; si no, la primera sin resolver; si todas están resueltas, la primera.
  const current =
    alerts.find((a) => a.id === selected) ??
    alerts.find((a) => a.status !== 'resolved') ??
    alerts[0]
  const shares = new Map(g.members.map((m) => [m.id, m.share_behavioral_details]))

  return (
    <section className="space-y-5">
      {title}

      <div
        role="status"
        className={`rounded-xl border p-4 ${unknown ? 'border-env-text font-medium' : 'border-env-border'} bg-env-surface`}
        style={unknown ? { backgroundImage: STRIPES } : undefined}
      >
        <p>
          <span aria-hidden>{unknown ? '○ ' : g.link.state === 'delayed' ? '◐ ' : '● '}</span>
          {ground.refreshFailed && g.link.state !== 'los'
            ? `Sin conexión con el servidor: estado DESCONOCIDO, último conocido de las ${new Date(g.as_of).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`
            : banner.text}
        </p>
        {g.link.queued > 0 && (
          <p className="mt-1 text-sm text-env-muted">
            {g.link.queued} {g.link.queued === 1 ? 'mensaje' : 'mensajes'} en cola del enlace.
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{capitalize(vocab.crew)}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {g.members.map((m) => {
            const live = livenessState(m.liveness)
            return (
              <li key={m.id} className="rounded-lg border border-env-border bg-env-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{m.name}</span>
                  {unknown ? (
                    <StatusBadge status="unknown" label="Desconocido" size="sm" />
                  ) : (
                    <span className="flex flex-wrap justify-end gap-1">
                      {!(live === 'stale' && m.overall_status === 'unknown') && (
                        <StatusBadge status={m.overall_status} size="sm" />
                      )}
                      {live && <StatusBadge status={live} size="sm" />}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-env-muted">
                  Último dato recibido {m.last_seen_at ? formatAgo(m.last_seen_at, now) : 'nunca'}
                  {unknown && ` · último conocido: ${statusStyle(m.overall_status).label}`}
                  {m.open_alerts > 0 &&
                    ` · ${m.open_alerts} alerta${m.open_alerts > 1 ? 's' : ''} abierta${m.open_alerts > 1 ? 's' : ''}`}
                </p>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Alertas entregadas</h2>
        {alerts.length === 0 ? (
          <p className="text-env-muted">
            No ha llegado ninguna alerta por el enlace.
            {g.link.state !== 'online' && ' Las que estén en cola aparecerán al entregarse.'}
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[minmax(260px,340px)_1fr]">
            <ul className="space-y-2" aria-label="Alertas entregadas">
              {alerts.map((a) => {
                const sev = severityStyle(a.severity)
                const member = g.members.find((m) => m.id === a.member_id)
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(a.id)}
                      aria-current={current?.id === a.id}
                      className={`w-full rounded-lg border p-3 text-left ${
                        current?.id === a.id
                          ? 'border-env-text bg-env-surface'
                          : 'border-env-border hover:border-env-text'
                      } ${a.status === 'resolved' ? 'opacity-70' : ''}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium">
                          {member?.name ?? `#${a.member_id}`} · {categoryLabel(a.category)}
                        </span>
                        <StatusBadge status={sev.status} label={sev.label} size="sm" />
                      </span>
                      <span className="mt-1 block text-xs text-env-muted">
                        {statusLabel(a.status)} · entregada{' '}
                        {a.delivered_at ? formatAgo(a.delivered_at, now) : '—'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {current && (
              <div className="rounded-xl border border-env-border p-4">
                <AlertDetail
                  key={current.id}
                  alert={current}
                  ladder={ladder}
                  vocabulary={vocab}
                  assessment={undefined}
                  interventions={[]}
                  onChanged={() => {
                    setSelected(current.id) // sigue a la vista tras recibir/resolver
                    ground.refresh()
                  }}
                  showProtocol={false}
                  allowReply
                  showDetails={canSeeDetails(current, role, shares.get(current.member_id) ?? false)}
                />
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  )
}
