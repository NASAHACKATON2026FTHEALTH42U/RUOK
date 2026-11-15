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
import { useEvents } from '../../realtime/events'
import type { RealtimeEvent } from '../../realtime/match'

const WHEN = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** Etiqueta de la fila: las alertas con su gravedad; lo resuelto, como resuelto. */
function Kind({ e }: { e: RealtimeEvent }) {
  const label = TYPE_LABEL[e.type] ?? e.type
  const severity = (e.payload as { severity?: Schema<'AlertSeverity'> }).severity
  if (toneOf(e) === 'resolved') return <StatusBadge status="normal" label="Resuelta" size="xs" />
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
    <section className="flex flex-col gap-4">
      <ControlHeader
        title="Registro"
        subtitle={`Incidencias resueltas y eventos importantes de ${env?.name ?? 'el entorno'}.`}
        memberScope
      />
      <Segmented
        label="Qué mostrar"
        value={group}
        onChange={setGroup}
        options={[
          { id: '', label: 'Todo' },
          ...Object.entries(LOG_GROUPS).map(([id, g]) => ({ id, label: g.label })),
        ]}
      />
      <ControlPanel
        title={group ? LOG_GROUPS[group].label : 'Todo'}
        aside={`${shown.length} eventos`}
        bodyClassName=""
      >
        {recent.state === 'loading' && <div className="m-4 h-40 animate-pulse bg-env-bg" />}
        {recent.state === 'error' && (
          <p className="p-4 text-env-muted">
            No se ha podido cargar el registro.{' '}
            <button type="button" onClick={recent.retry} className="underline">
              Reintentar
            </button>
          </p>
        )}
        {recent.state === 'ready' && shown.length === 0 && (
          <p className="p-4 text-sm text-env-muted">Nada que mostrar todavía.</p>
        )}
        <ol className="divide-y divide-env-border/60">
          {shown.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1 px-4 py-2.5 text-sm sm:grid-cols-[6.5rem_11rem_minmax(0,1fr)]"
            >
              <time dateTime={e.at} className="text-env-muted tabular-nums">
                {WHEN.format(new Date(e.at))}
              </time>
              <span className="pt-0.5">
                <Kind e={e} />
              </span>
              <span className="col-span-2 min-w-0 sm:col-span-1">
                <span className="block">{e.summary || TYPE_LABEL[e.type]}</span>
                {e.member_id != null && (
                  <span className="block text-xs text-env-muted">{memberName(e.member_id)}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </ControlPanel>
    </section>
  )
}
