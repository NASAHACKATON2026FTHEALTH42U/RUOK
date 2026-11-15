import { useState } from 'react'
import { serverNow } from '../../api/client'
import { useEnvironmentAlerts } from '../../api/useAlerts'
import { useMembers } from '../../api/useMembers'
import { useVocab } from '../../environments/useVocab'
import { formatAgo } from '../../lib/time'
import { StatusBadge } from '../ui/StatusBadge'
import { categoryLabel, severityStyle, statusLabel } from './alertFormat'
import { roleLabel } from './sos'

/**
 * Alertas a bordo de todo el entorno (FE-35), para admin, medic y commander cuando no hay
 * member elegido. Tocar una elige a ese member y abre su detalle (escalar, reconocer…). Las
 * resueltas salen de la lista y quedan plegadas en «Resueltas».
 */
export function EnvironmentAlerts({
  envId,
  onSelect,
}: {
  envId: string
  onSelect: (memberId: number, alertId: string, resolved: boolean) => void
}) {
  const vocab = useVocab()
  const [showResolved, setShowResolved] = useState(false)
  const members = useMembers(envId)
  const alerts = useEnvironmentAlerts(envId, members.state === 'ready' ? members.data : null)
  const now = serverNow()

  if (members.state === 'loading' || (members.state === 'ready' && alerts.state === 'loading')) {
    return <div className="h-32 animate-pulse  bg-env-surface" aria-busy="true" />
  }
  if (members.state === 'error' || alerts.state === 'error') {
    return (
      <p className="text-env-muted">
        No se han podido cargar las alertas de {vocab.crew}.{' '}
        <button
          type="button"
          onClick={members.state === 'error' ? members.retry : alerts.retry}
          className="underline"
        >
          Reintentar
        </button>
      </p>
    )
  }
  const list = alerts.state === 'ready' ? alerts.data : []
  const open = list.filter((a) => a.status !== 'resolved')
  const resolved = list.filter((a) => a.status === 'resolved')

  const grid = (rows: typeof list, label: string) => (
    <ul
      className="-mr-px -mb-px grid auto-rows-min md:grid-cols-2 2xl:grid-cols-3"
      aria-label={label}
    >
      {rows.map((a) => {
        const sev = severityStyle(a.severity)
        return (
          <li key={a.id} className="border-r border-b border-env-border/60">
            <button
              type="button"
              onClick={() => onSelect(a.memberId, a.id, a.status === 'resolved')}
              className={`flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left hover:bg-env-primary/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary ${a.status === 'resolved' ? 'opacity-60' : ''}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block font-medium">{a.memberName}</span>
                  <span className="block text-sm">{categoryLabel(a.category)}</span>
                </span>
                <StatusBadge status={sev.status} label={sev.label} size="sm" />
              </span>
              <span className="truncate text-xs text-env-muted">
                {a.origin === 'auto' ? 'Automática' : 'Manual'} · {statusLabel(a.status)} · a{' '}
                {roleLabel(a.target_role, vocab)} · {formatAgo(a.created_at, now)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="text-sm text-env-muted">
        Alertas abiertas de {vocab.crew} a bordo · {open.length}. Toca una para ver su detalle.
      </p>
      {alerts.refreshFailed && (
        <p role="status" className="text-sm text-env-muted">
          ⚠ No se pudo actualizar: puede haber cambios que no se ven.
        </p>
      )}
      {list.length === 0 ? (
        <p className="text-env-muted">No hay alertas en {vocab.crew}.</p>
      ) : (
        // Filas compactas en un panel que mide lo que su contenido y, como mucho, el hueco: si
        // no caben, el scroll es del panel y no de la página.
        <div className="hud-panel flex min-h-0 flex-col self-stretch md:max-h-full">
          <div className="min-h-0 overflow-y-auto [scrollbar-color:var(--env-border)_transparent]">
            {open.length === 0 ? (
              <p className="px-3.5 py-3 text-sm text-env-muted">No hay alertas abiertas.</p>
            ) : (
              grid(open, `Alertas abiertas de ${vocab.crew}`)
            )}
            {resolved.length > 0 && (
              <div className="border-t border-env-border">
                <button
                  type="button"
                  aria-expanded={showResolved}
                  onClick={() => setShowResolved((v) => !v)}
                  className="w-full min-h-11 px-3.5 py-2.5 text-left text-sm text-env-muted hover:text-env-text"
                >
                  {showResolved ? '▾' : '▸'} Resueltas ({resolved.length})
                </button>
                {showResolved && grid(resolved, `Alertas resueltas de ${vocab.crew}`)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
