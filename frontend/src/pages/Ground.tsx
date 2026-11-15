import { useState } from 'react'
import { serverNow } from '../api/client'
import { useGroundView } from '../api/useGroundView'
import { useAuth } from '../auth/useAuth'
import { AlertDetail } from '../components/alerts/AlertDetail'
import { AlertRowBody } from '../components/alerts/AlertRowBody'
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
import { dateLocale } from '../i18n/lang'
import { useT } from '../i18n/t'
import { formatAgo } from '../lib/time'
import { useEnvironmentStore } from '../store/environment'
import { useEnvironments } from '../api/useEnvironments'

const STRIPES =
  'repeating-linear-gradient(135deg, color-mix(in srgb, #898781 22%, transparent) 0 6px, transparent 6px 12px)'

/**
 * Consola de tierra (FE-16): lo que el enlace YA ha entregado. Banner del enlace (retardo o
 * LOS → estado DESCONOCIDO, nunca verde), members con "último dato recibido hace X" y alertas
 * entregadas con recibir, responder y resolver. Se actualiza en vivo con los eventos (FE-29).
 * Ocupa el alto disponible: el estado de cada member en una franja compacta y, debajo, la lista
 * y el detalle con su propio scroll.
 */
export default function Ground() {
  const t = useT()
  const vocab = useVocab()
  const { role } = useAuth()
  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const ground = useGroundView(envId)
  const [selected, setSelected] = useState<string | null>(null)
  // Las resueltas salen de la lista y quedan plegadas en «Resueltas».
  const [showResolved, setShowResolved] = useState(false)
  const ladder = (envs.state === 'ready'
    ? envs.data.find((e) => e.id === envId)?.escalation_ladder
    : null) ?? ['self', 'crew', 'ground']

  const title = (
    <h1 className="text-2xl font-semibold first-letter:uppercase">
      {t('Consola de {ground}', { ground: vocab.ground })}
    </h1>
  )
  if (!envId) {
    return (
      <section className="space-y-2">
        {title}
        <p className="text-env-muted">{t('Tu usuario no tiene entorno asignado.')}</p>
      </section>
    )
  }
  if (ground.state === 'loading') {
    return (
      <section className="space-y-4">
        {title}
        <div className="h-40 animate-pulse  bg-env-surface" />
      </section>
    )
  }
  if (ground.state === 'error') {
    return (
      <section className="space-y-2">
        {title}
        <p className="text-env-muted">
          {t('No se ha podido cargar la consola.')}{' '}
          <button type="button" onClick={ground.retry} className="underline">
            {t('Reintentar')}
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
  // La elegida; si no, la primera sin resolver.
  const current =
    alerts.find((a) => a.id === selected) ?? alerts.find((a) => a.status !== 'resolved')
  const shares = new Map(g.members.map((m) => [m.id, m.share_behavioral_details]))

  const open = alerts.filter((a) => a.status !== 'resolved')
  const resolved = alerts.filter((a) => a.status === 'resolved')
  const resolvedOpen = showResolved || current?.status === 'resolved'

  const row = (a: (typeof alerts)[number]) => {
    const sev = severityStyle(a.severity)
    const member = g.members.find((m) => m.id === a.member_id)
    const active = current?.id === a.id
    return (
      <li key={a.id}>
        <button
          type="button"
          onClick={() => setSelected(a.id)}
          aria-current={active}
          className={`flex w-full flex-col gap-1.5 px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary ${
            active
              ? 'bg-env-primary/10 shadow-[inset_3px_0_0_var(--env-primary)]'
              : 'hover:bg-env-primary/5'
          } ${a.status === 'resolved' ? 'opacity-60' : ''}`}
        >
          <AlertRowBody
            title={`${member?.name ?? `#${a.member_id}`} · ${categoryLabel(a.category)}`}
            status={sev.status}
            severityLabel={sev.label}
            state={statusLabel(a.status)}
            ago={t('entregada {ago}', {
              ago: a.delivered_at ? formatAgo(a.delivered_at, now) : '—',
            })}
          />
        </button>
      </li>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {title}
        {/* Estado del enlace: en una línea, junto al título. */}
        <div
          role="status"
          className={`hud-panel min-w-0 px-3.5 py-2 text-sm ${unknown ? 'font-medium' : ''}`}
          style={unknown ? { backgroundImage: STRIPES } : undefined}
        >
          <span aria-hidden>{unknown ? '○ ' : g.link.state === 'delayed' ? '◐ ' : '● '}</span>
          {ground.refreshFailed && g.link.state !== 'los'
            ? t(
                'Sin conexión con el servidor: estado DESCONOCIDO, último conocido de las {time}.',
                {
                  time: new Date(g.as_of).toLocaleTimeString(dateLocale(), {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
              )
            : banner.text}
          {g.link.queued > 0 && (
            <span className="text-env-muted">
              {' '}
              ·{' '}
              {g.link.queued === 1
                ? t('1 mensaje en cola')
                : t('{n} mensajes en cola', { n: g.link.queued })}
            </span>
          )}
        </div>
      </header>

      {/* Estado de cada member: una fila compacta por persona (lo último que ha llegado). */}
      <section className="hud-panel" aria-labelledby="ground-crew-title">
        <h2 id="ground-crew-title" className="hud-panel-head">
          {capitalize(vocab.crew)}
          <span className="mr-2.5 ml-auto tracking-normal text-env-muted normal-case">
            {g.members.length}
          </span>
        </h2>
        <ul className="-mr-px -mb-px grid max-h-[11.5rem] overflow-y-auto [scrollbar-color:var(--env-border)_transparent] sm:grid-cols-2 xl:grid-cols-4">
          {g.members.map((m) => {
            const live = livenessState(m.liveness)
            return (
              <li
                key={m.id}
                className="flex flex-col gap-1 border-r border-b border-env-border/60 px-3.5 py-2.5"
              >
                <span className="truncate font-medium">{m.name}</span>
                {unknown ? (
                  <span>
                    <StatusBadge status="unknown" label={t('Desconocido')} size="xs" />
                  </span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {!(live === 'stale' && m.overall_status === 'unknown') && (
                      <StatusBadge status={m.overall_status} size="xs" />
                    )}
                    {live && <StatusBadge status={live} size="xs" />}
                  </span>
                )}
                <span className="text-xs text-env-muted">
                  {m.last_seen_at
                    ? t('Último dato {ago}', { ago: formatAgo(m.last_seen_at, now) })
                    : t('Último dato nunca')}
                  {unknown &&
                    ` · ${t('último conocido: {status}', { status: statusStyle(m.overall_status).label })}`}
                  {m.open_alerts > 0 &&
                    ` · ${
                      m.open_alerts > 1
                        ? t('{n} alertas abiertas', { n: m.open_alerts })
                        : t('1 alerta abierta')
                    }`}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {alerts.length === 0 ? (
        <p className="text-env-muted">
          {t('No ha llegado ninguna alerta por el enlace.')}
          {g.link.state !== 'online' && ` ${t('Las que estén en cola aparecerán al entregarse.')}`}
        </p>
      ) : (
        // Lista y detalle miden lo que su contenido y, como mucho, el hueco: si no caben, el
        // scroll es suyo y no de la página.
        <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(260px,340px)_1fr] md:items-start lg:grid-cols-[minmax(300px,400px)_1fr]">
          <section
            aria-labelledby="ground-alerts-title"
            className="hud-panel flex max-h-[45dvh] min-h-0 flex-col md:max-h-full"
          >
            <h2 id="ground-alerts-title" className="hud-panel-head">
              {t('Alertas entregadas')}
              <span className="mr-2.5 ml-auto tracking-normal text-env-muted normal-case">
                {t('{n} abiertas', { n: open.length })}
              </span>
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--env-border)_transparent]">
              {open.length === 0 && (
                <p className="px-3.5 py-3 text-sm text-env-muted">
                  {t('No hay alertas abiertas.')}
                </p>
              )}
              <ul
                className="divide-y divide-env-border/60"
                aria-label={t('Alertas entregadas abiertas')}
              >
                {open.map(row)}
              </ul>
              {resolved.length > 0 && (
                <div className="border-t border-env-border">
                  <button
                    type="button"
                    aria-expanded={resolvedOpen}
                    onClick={() => {
                      if (resolvedOpen && current?.status === 'resolved') setSelected(null)
                      setShowResolved(!resolvedOpen)
                    }}
                    className="w-full min-h-11 px-3.5 py-2.5 text-left text-sm text-env-muted hover:text-env-text"
                  >
                    {resolvedOpen ? '▾' : '▸'} {t('Resueltas ({n})', { n: resolved.length })}
                  </button>
                  {resolvedOpen && (
                    <ul
                      className="divide-y divide-env-border/60"
                      aria-label={t('Alertas entregadas resueltas')}
                    >
                      {resolved.map(row)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>
          {current && (
            <section
              aria-label={t('Detalle de la alerta')}
              className="hud-panel min-h-0 overflow-y-auto p-4 [scrollbar-color:var(--env-border)_transparent] md:max-h-full"
            >
              <AlertDetail
                key={current.id}
                alert={current}
                ladder={ladder}
                vocabulary={vocab}
                assessment={undefined}
                interventions={[]}
                onChanged={(what) => {
                  // Sigue a la vista tras recibir; al resolver sale de las abiertas.
                  setSelected(what === 'resolved' ? null : current.id)
                  ground.refresh()
                }}
                showProtocol={false}
                allowReply
                showDetails={canSeeDetails(current, role, shares.get(current.member_id) ?? false)}
              />
            </section>
          )}
        </div>
      )}
    </section>
  )
}
