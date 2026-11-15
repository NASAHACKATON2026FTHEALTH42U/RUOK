import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { NoticeButton } from '../components/alerts/SosButton'
import { serverNow } from '../api/client'
import { useMemberAlerts, useNotifications } from '../api/useAlerts'
import { useMembers } from '../api/useMembers'
import { useAssessment } from '../api/useAssessment'
import { useEnvironments } from '../api/useEnvironments'
import { useInterventions } from '../api/useInterventions'
import { useActiveMemberId, useAuth } from '../auth/useAuth'
import { AlertDetail } from '../components/alerts/AlertDetail'
import { AlertRowBody } from '../components/alerts/AlertRowBody'
import { CaseFeedbackFor } from '../components/alerts/CaseFeedbackNote'
import { EnvironmentAlerts } from '../components/alerts/EnvironmentAlerts'
import {
  categoryLabel,
  severityStyle,
  sortAlerts,
  statusLabel,
} from '../components/alerts/alertFormat'
import { roleLabel } from '../components/alerts/sos'
import { OperatorMessageButton } from '../components/control/OperatorMessageForm'
import { ScrollHint } from '../components/ui/ScrollHint'
import { revealSection } from '../components/ui/scroll'
import { useVocab } from '../environments/useVocab'
import { useT } from '../i18n/t'
import { formatAgo } from '../lib/time'
import { useEnvironmentStore } from '../store/environment'

/**
 * Panel de alertas (FE-14): lista de las alertas del member (origen, severidad, estado) y el
 * detalle de la elegida (entrega/ETA, protocolo autónomo, línea de tiempo y acciones).
 * Se refresca cada 10 s; el tiempo real (y la vibración en la tablet del médico) es FE-29.
 */
export default function Alerts() {
  const t = useT()
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
  // Las resueltas salen de la lista: quedan plegadas en «Resueltas» (y en el Registro del operador).
  const [showResolved, setShowResolved] = useState(false)
  // Notificaciones personalizadas recibidas (las guarda el servidor 7 días): se pueden repasar.
  const notifications = useNotifications(memberId)
  const [showNotes, setShowNotes] = useState(false)
  // Panel con scroll de la lista y las secciones plegables: al desplegar una, se lleva a la vista
  // y, si queda más por debajo, el pie lo indica (ScrollHint).
  const listRef = useRef<HTMLDivElement>(null)
  const resolvedRef = useRef<HTMLDivElement>(null)
  const notesRef = useRef<HTMLDivElement>(null)
  const ladder = (envs.state === 'ready'
    ? envs.data.find((e) => e.id === envId)?.escalation_ladder
    : null) ?? ['self', 'crew', 'ground']
  // El operador no avisa a control (es control): crea alertas o notificaciones para quien elija.
  const operator = role === 'admin'
  const crew = useMembers(operator ? envId : null)
  const operatorButton = operator && (
    <OperatorMessageButton
      recipients={crew.state === 'ready' ? crew.data.map((m) => ({ id: m.id, name: m.name })) : []}
      memberId={memberId}
      ladder={ladder}
      vocabulary={vocab}
    />
  )

  const title = <h1 className="text-2xl font-semibold">{t('Alertas')}</h1>

  if (role === 'responder' || role === 'psych') {
    return (
      <section className="space-y-2">
        {title}
        <p className="text-env-muted">
          {t('Las alertas que te ha entregado el enlace están en la')}{' '}
          <Link to="/ground" className="underline hover:text-env-text">
            {t('consola')}
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
          {operatorButton}
        </header>
        {supervisor && envId ? (
          <EnvironmentAlerts
            envId={envId}
            onSelect={(id, alertId, wasResolved) => {
              setSelected(alertId)
              if (wasResolved) setShowResolved(true)
              selectMember(id)
            }}
          />
        ) : (
          <p className="text-env-muted">
            {t('Elige primero a quién quieres ver en')}{' '}
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
  const notes = notifications.state === 'ready' ? notifications.data : []
  const open = list.filter((a) => a.status !== 'resolved')
  const resolved = list.filter((a) => a.status === 'resolved')
  // La elegida; si no, la primera abierta (las resueltas solo si se despliegan).
  const current =
    list.find((a) => a.id === selected && (a.status !== 'resolved' || showResolved)) ?? open[0]
  const now = serverNow()

  const row = (a: (typeof list)[number]) => {
    const sev = severityStyle(a.severity)
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
            title={categoryLabel(a.category)}
            status={sev.status}
            severityLabel={sev.label}
            state={`${statusLabel(a.status)} · ${a.origin === 'auto' ? t('Automática') : t('Manual')}`}
            ago={formatAgo(a.created_at, now)}
            target={t('a {role}', { role: roleLabel(a.target_role, vocab) })}
          />
        </button>
      </li>
    )
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {title}
        <div className="flex flex-wrap items-center gap-3">
          {operator ? operatorButton : <NoticeButton />}
        </div>
      </header>
      {alerts.state === 'loading' && <div className="h-32 animate-pulse  bg-env-surface" />}
      {alerts.state === 'error' && (
        <p className="text-env-muted">
          {t('No se han podido cargar las alertas.')}{' '}
          <button type="button" onClick={alerts.retry} className="underline">
            {t('Reintentar')}
          </button>
        </p>
      )}
      {alerts.refreshFailed && (
        <p role="status" className="text-sm text-env-muted">
          ⚠ {t('No se pudo actualizar: puede haber cambios que no se ven.')}
        </p>
      )}
      {alerts.state === 'ready' && list.length === 0 && (
        <p className="text-env-muted">
          {operator
            ? t('No hay alertas.')
            : t(
                'No hay alertas. En una emergencia, pulsa SOS; para lo demás, «Enviar aviso a control».',
              )}
        </p>
      )}

      {(list.length > 0 || notes.length > 0) && (
        // Lista y detalle miden lo que su contenido y, como mucho, el hueco: si no caben, el
        // scroll es suyo y no de la página. En móvil, la lista con su propio scroll y el detalle
        // debajo.
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:min-h-0 md:flex-1 md:grid-cols-[minmax(260px,340px)_1fr] md:items-start lg:grid-cols-[minmax(300px,420px)_1fr] lg:gap-6">
          <section
            aria-labelledby="alerts-list-title"
            className="hud-panel flex max-h-[45dvh] min-h-0 flex-col md:max-h-full"
          >
            <h2 id="alerts-list-title" className="hud-panel-head">
              {t('Abiertas')}
              <span className="mr-2.5 ml-auto tracking-normal text-env-muted normal-case">
                {open.length}
              </span>
            </h2>
            <div
              ref={listRef}
              className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--env-border)_transparent]"
            >
              {open.length === 0 && (
                <p className="px-3.5 py-3 text-sm text-env-muted">
                  {t('No hay alertas abiertas.')}
                </p>
              )}
              <ul className="divide-y divide-env-border/60" aria-label={t('Alertas abiertas')}>
                {open.map(row)}
              </ul>
              {resolved.length > 0 && (
                <div ref={resolvedRef} className="border-t border-env-border">
                  <button
                    type="button"
                    aria-expanded={showResolved}
                    onClick={() => {
                      if (!showResolved) revealSection(resolvedRef.current)
                      setShowResolved((v) => !v)
                    }}
                    className="flex w-full items-center justify-between gap-2 min-h-11 px-3.5 py-2.5 text-left text-sm text-env-muted hover:text-env-text"
                  >
                    <span>
                      {showResolved ? '▾' : '▸'} {t('Resueltas ({n})', { n: resolved.length })}
                    </span>
                    {operator && (
                      <Link
                        to="/control/log"
                        onClick={(e) => e.stopPropagation()}
                        className="underline hover:text-env-text"
                      >
                        {t('Registro')}
                      </Link>
                    )}
                  </button>
                  {showResolved && (
                    <ul
                      className="divide-y divide-env-border/60"
                      aria-label={t('Alertas resueltas')}
                    >
                      {resolved.map(row)}
                    </ul>
                  )}
                </div>
              )}
              {notes.length > 0 && (
                <div ref={notesRef} className="border-t border-env-border">
                  <button
                    type="button"
                    aria-expanded={showNotes}
                    onClick={() => {
                      if (!showNotes) revealSection(notesRef.current)
                      setShowNotes((v) => !v)
                    }}
                    className="flex min-h-11 w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm text-env-muted hover:text-env-text"
                  >
                    {showNotes ? '▾' : '▸'} {t('Notificaciones ({n})', { n: notes.length })}
                  </button>
                  {showNotes && (
                    <ul className="divide-y divide-env-border/60" aria-label={t('Notificaciones')}>
                      {notes.map((n) => {
                        const p = n.payload as {
                          title?: string | null
                          text?: string
                          level?: string
                          from_name?: string
                        }
                        const tone =
                          p.level === 'critical'
                            ? 'var(--color-st-crit)'
                            : p.level === 'warning'
                              ? 'var(--color-st-warn)'
                              : 'var(--env-primary)'
                        return (
                          <li
                            key={n.id}
                            className="flex flex-col gap-1 px-4 py-3"
                            style={{ boxShadow: `inset 3px 0 0 ${tone}` }}
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="font-medium">{p.title || t('Notificación')}</span>
                              <span
                                className="shrink-0 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase"
                                style={{ color: tone }}
                              >
                                {p.level === 'critical'
                                  ? t('Importante')
                                  : p.level === 'warning'
                                    ? t('Aviso')
                                    : t('Información')}
                              </span>
                            </span>
                            {p.text && <span className="text-sm">{p.text}</span>}
                            <span className="text-xs text-env-muted">
                              {p.from_name ? `${t('De {name}', { name: p.from_name })} · ` : ''}
                              {formatAgo(n.at, now)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}
              <ScrollHint target={listRef} />
            </div>
          </section>
          {current && (
            <section
              aria-label={t('Detalle del aviso')}
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
                onChanged={(what) => {
                  // Sigue a la vista tras escalar o recibir; al resolver sale de las abiertas.
                  setSelected(what === 'resolved' ? null : current.id)
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
