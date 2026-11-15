import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NoticeButton } from '../components/alerts/SosButton'
import { serverNow } from '../api/client'
import { useMemberAlerts } from '../api/useAlerts'
import { useAssessment } from '../api/useAssessment'
import { useEnvironments } from '../api/useEnvironments'
import { useInterventions } from '../api/useInterventions'
import { useActiveMemberId, useAuth } from '../auth/useAuth'
import { AlertDetail } from '../components/alerts/AlertDetail'
import { CaseFeedbackFor } from '../components/alerts/CaseFeedbackNote'
import { EnvironmentAlerts } from '../components/alerts/EnvironmentAlerts'
import {
  categoryLabel,
  severityStyle,
  sortAlerts,
  statusLabel,
} from '../components/alerts/alertFormat'
import { roleLabel } from '../components/alerts/sos'
import { MemberSwitcher } from '../components/ui/MemberSwitcher'
import { StatusBadge } from '../components/ui/StatusBadge'
import { useVocab } from '../environments/useVocab'
import { formatAgo } from '../lib/time'
import { useEnvironmentStore } from '../store/environment'

/**
 * Panel de alertas (FE-14): lista de las alertas del member (origen, severidad, estado) y el
 * detalle de la elegida (entrega/ETA, protocolo autónomo, línea de tiempo y acciones).
 * Se refresca cada 10 s; el tiempo real (y la vibración en la tablet del médico) es FE-29.
 */
export default function Alerts() {
  const vocab = useVocab()
  const { role, can } = useAuth()
  const memberId = useActiveMemberId()
  const envId = useEnvironmentStore((s) => s.envId)
  const selectMember = useEnvironmentStore((s) => s.selectMember)
  // Quien supervisa (admin, medic, commander) ve todo el entorno sin member elegido (FE-35).
  const supervisor = can('view:members')
  const alerts = useMemberAlerts(memberId)
  const assessment = useAssessment(memberId)
  const interventions = useInterventions()
  const envs = useEnvironments()
  const [selected, setSelected] = useState<string | null>(null)
  const ladder = (envs.state === 'ready'
    ? envs.data.find((e) => e.id === envId)?.escalation_ladder
    : null) ?? ['self', 'crew', 'ground']

  const title = <h1 className="text-2xl font-semibold">Alertas</h1>

  if (role === 'responder' || role === 'psych') {
    return (
      <section className="space-y-2">
        {title}
        <p className="text-env-muted">
          Las alertas que te ha entregado el enlace están en la{' '}
          <Link to="/ground" className="underline hover:text-env-text">
            consola
          </Link>
          .
        </p>
      </section>
    )
  }
  if (memberId === null) {
    return (
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          {title}
          <MemberSwitcher />
        </header>
        {supervisor && envId ? (
          <EnvironmentAlerts
            envId={envId}
            onSelect={(id, alertId) => {
              setSelected(alertId)
              selectMember(id)
            }}
          />
        ) : (
          <p className="text-env-muted">
            Elige primero a quién quieres ver en{' '}
            <Link to="/members" className="underline hover:text-env-text">
              {vocab.crew}
            </Link>
            .
          </p>
        )}
      </section>
    )
  }

  const list = alerts.state === 'ready' ? sortAlerts(alerts.data) : []
  // La elegida; si no, la primera sin resolver; si todas están resueltas, la primera.
  const current =
    list.find((a) => a.id === selected) ?? list.find((a) => a.status !== 'resolved') ?? list[0]
  const now = serverNow()

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {title}
        <div className="flex flex-wrap items-center gap-3">
          {supervisor && (
            <>
              <button
                type="button"
                onClick={() => useEnvironmentStore.setState({ memberId: null })}
                className="text-sm text-env-muted underline hover:text-env-text"
              >
                ← Todo {vocab.crew}
              </button>
              <MemberSwitcher />
            </>
          )}
          <NoticeButton />
        </div>
      </header>
      {alerts.state === 'loading' && (
        <div className="h-32 animate-pulse rounded-xl bg-env-surface" />
      )}
      {alerts.state === 'error' && (
        <p className="text-env-muted">
          No se han podido cargar las alertas.{' '}
          <button type="button" onClick={alerts.retry} className="underline">
            Reintentar
          </button>
        </p>
      )}
      {alerts.refreshFailed && (
        <p role="status" className="text-sm text-env-muted">
          ⚠ No se pudo actualizar: puede haber cambios que no se ven.
        </p>
      )}
      {alerts.state === 'ready' && list.length === 0 && (
        <p className="text-env-muted">
          No hay alertas. En una emergencia, pulsa SOS; para lo demás, «Enviar aviso a control».
        </p>
      )}

      {list.length > 0 && (
        // Lista y detalle miden lo que su contenido y, como mucho, el hueco: si no caben, el
        // scroll es suyo y no de la página. En móvil, la lista con su propio scroll y el detalle
        // debajo.
        <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(260px,340px)_1fr] md:items-start lg:grid-cols-[minmax(300px,420px)_1fr] lg:gap-6">
          <section
            aria-labelledby="alerts-list-title"
            className="hud-panel flex max-h-[45dvh] min-h-0 flex-col md:max-h-full"
          >
            <h2 id="alerts-list-title" className="hud-panel-head">
              Avisos
              <span className="ml-auto mr-2.5 normal-case tracking-normal text-env-muted">
                {list.filter((a) => a.status !== 'resolved').length} abiertos de {list.length}
              </span>
            </h2>
            <ul
              className="min-h-0 flex-1 divide-y divide-env-border/60 overflow-y-auto [scrollbar-color:var(--env-border)_transparent]"
              aria-label="Alertas"
            >
              {list.map((a) => {
                const sev = severityStyle(a.severity)
                const active = current?.id === a.id
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(a.id)}
                      aria-current={active}
                      className={`flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary ${
                        active
                          ? 'bg-env-primary/10 shadow-[inset_3px_0_0_var(--env-primary)]'
                          : 'hover:bg-env-primary/5'
                      } ${a.status === 'resolved' ? 'opacity-60' : ''}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{categoryLabel(a.category)}</span>
                        <StatusBadge status={sev.status} label={sev.label} size="sm" />
                      </span>
                      <span className="truncate text-xs text-env-muted">
                        {a.origin === 'auto' ? 'Automática' : 'Manual'} · {statusLabel(a.status)} ·
                        a {roleLabel(a.target_role, vocab)} · {formatAgo(a.created_at, now)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
          {current && (
            <section
              aria-label="Detalle del aviso"
              className="hud-panel min-h-0 overflow-y-auto p-4 [scrollbar-color:var(--env-border)_transparent] md:max-h-full"
            >
              {current.system_id && (
                <CaseFeedbackFor
                  systemId={current.system_id}
                  current={
                    assessment.state === 'ready'
                      ? assessment.data.systems.find((s) => s.system_id === current.system_id)
                          ?.status
                      : undefined
                  }
                  className="mb-4"
                />
              )}
              <AlertDetail
                key={current.id}
                alert={current}
                ladder={ladder}
                vocabulary={vocab}
                assessment={assessment.state === 'ready' ? assessment.data : undefined}
                interventions={interventions.state === 'ready' ? interventions.data : []}
                onChanged={() => {
                  setSelected(current.id) // sigue a la vista tras escalar/recibir/resolver
                  alerts.refresh()
                }}
              />
            </section>
          )}
        </div>
      )}
    </section>
  )
}
