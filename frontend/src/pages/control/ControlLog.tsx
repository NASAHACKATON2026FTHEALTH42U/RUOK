import { useEffect, useState } from 'react'
import type { Schema } from '../../api/client'
import { useRecentEvents } from '../../api/useControl'
import { severityStyle } from '../../components/alerts/alertFormat'
import { ControlHeader, ControlPanel } from '../../components/control/ControlHeader'
import { mergeEvents } from '../../components/control/feed'
import { filterLog, LOG_GROUPS, LOG_TYPES, TYPE_LABEL, toneOf } from '../../components/control/log'
import { Segmented } from '../../components/control/OperatorMessageForm'
import { useControlScope } from '../../components/control/useControlScope'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { dateLocale } from '../../i18n/lang'
import { useT } from '../../i18n/t'
import { useEvents } from '../../realtime/events'
import type { RealtimeEvent } from '../../realtime/match'

/** Fecha y hora de la fila, en el idioma activo (se crea al usarse: el idioma puede cambiar). */
const when = (iso: string) =>
  new Intl.DateTimeFormat(dateLocale(), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

/** Etiqueta de la fila: las alertas con su gravedad; lo resuelto, como resuelto. */
function Kind({ e }: { e: RealtimeEvent }) {
  const t = useT()
  const typeLabel = TYPE_LABEL[e.type]
  const label = typeLabel ? t(typeLabel) : e.type
  const severity = (e.payload as { severity?: Schema<'AlertSeverity'> }).severity
  if (toneOf(e) === 'resolved')
    return <StatusBadge status="normal" label={t('Resuelta')} size="xs" />
  if (e.type.startsWith('alert.') && severity)
    return <StatusBadge status={severityStyle(severity).status} label={label} size="xs" />
  if (e.type === 'auth.failed') return <StatusBadge status="warning" label={label} size="xs" />
  return <span className="hud-label whitespace-nowrap">{label}</span>
}

/**
 * Registro (solo admin): las incidencias resueltas y los eventos importantes del entorno activo
 * (alertas, notificaciones, usuarios y accesos, misiones, dispositivos, contacto y enlace), del
 * más reciente al más antiguo y al momento. Se guarda 7 días en el `event_log` del servidor.
 */
export default function ControlLog() {
  const t = useT()
  const { envId, env, memberId, memberName } = useControlScope()
  const recent = useRecentEvents(envId, LOG_TYPES, 500)
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [group, setGroup] = useState('')

  useEffect(() => setEvents([]), [envId])
  const recentData = recent.state === 'ready' ? recent.data : null
  useEffect(() => {
    if (recentData) setEvents((cur) => mergeEvents(cur, recentData, 1000))
  }, [recentData])
  useEvents({ types: LOG_TYPES, envId }, (e) => {
    if (e && LOG_TYPES.includes(e.type)) setEvents((cur) => mergeEvents(cur, [e], 1000))
  })

  const shown = filterLog(events, group, memberId)

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <ControlHeader
        title={t('Registro')}
        subtitle={t('Incidencias resueltas y eventos importantes de {env}.', {
          env: env?.name ?? t('el entorno'),
        })}
        memberScope
      />
      <Segmented
        label={t('Qué mostrar')}
        value={group}
        onChange={setGroup}
        options={[
          { id: '', label: t('Todo') },
          ...Object.entries(LOG_GROUPS).map(([id, g]) => ({ id, label: t(g.label) })),
        ]}
      />
      {/* El panel mide lo que su contenido y, como mucho, el hueco: si no cabe, el scroll es suyo. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <ControlPanel
          title={group ? t(LOG_GROUPS[group].label) : t('Todo')}
          aside={t('{n} eventos', { n: shown.length })}
          className="max-h-full min-h-0"
          bodyClassName="min-h-0 flex-1 overflow-y-auto [scrollbar-color:var(--env-border)_transparent]"
        >
          {recent.state === 'loading' && <div className="m-4 h-40 animate-pulse bg-env-bg" />}
          {recent.state === 'error' && (
            <p className="p-4 text-env-muted">
              {t('No se ha podido cargar el registro.')}{' '}
              <button type="button" onClick={recent.retry} className="underline">
                {t('Reintentar')}
              </button>
            </p>
          )}
          {recent.state === 'ready' && shown.length === 0 && (
            <p className="p-4 text-sm text-env-muted">{t('Nada que mostrar todavía.')}</p>
          )}
          <ol className="divide-y divide-env-border/60">
            {shown.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[6.5rem_11rem_minmax(0,1fr)]"
              >
                <time dateTime={e.at} className="text-env-muted tabular-nums">
                  {when(e.at)}
                </time>
                <span className="pt-0.5">
                  <Kind e={e} />
                </span>
                <span className="col-span-2 min-w-0 sm:col-span-1">
                  <span className="block">{e.summary || t(TYPE_LABEL[e.type] ?? '')}</span>
                  {e.member_id != null && (
                    <span className="block text-xs text-env-muted">{memberName(e.member_id)}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </ControlPanel>
      </div>
    </section>
  )
}
