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
 * member elegido. Tocar una elige a ese member y abre su detalle (escalar, reconocer…).
 */
export function EnvironmentAlerts({
  envId,
  onSelect,
}: {
  envId: string
  onSelect: (memberId: number, alertId: string) => void
}) {
  const vocab = useVocab()
  const members = useMembers(envId)
  const alerts = useEnvironmentAlerts(envId, members.state === 'ready' ? members.data : null)
  const now = serverNow()

  if (members.state === 'loading' || (members.state === 'ready' && alerts.state === 'loading')) {
    return <div className="h-32 animate-pulse rounded-xl bg-env-surface" aria-busy="true" />
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
  const open = list.filter((a) => a.status !== 'resolved').length

  return (
    <div className="space-y-3">
      <p className="text-sm text-env-muted">
        Todas las alertas de {vocab.crew} a bordo · {open} sin resolver. Toca una para ver su
        detalle.
      </p>
      {alerts.refreshFailed && (
        <p role="status" className="text-sm text-env-muted">
          ⚠ No se pudo actualizar: puede haber cambios que no se ven.
        </p>
      )}
      {list.length === 0 ? (
        <p className="text-env-muted">No hay alertas en {vocab.crew}.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2" aria-label={`Alertas de ${vocab.crew}`}>
          {list.map((a) => {
            const sev = severityStyle(a.severity)
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelect(a.memberId, a.id)}
                  className={`w-full rounded-lg border border-env-border p-3 text-left hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${a.status === 'resolved' ? 'opacity-70' : ''}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-medium">{a.memberName}</span>
                      <span className="block text-sm">{categoryLabel(a.category)}</span>
                    </span>
                    <StatusBadge status={sev.status} label={sev.label} size="sm" />
                  </span>
                  <span className="mt-1 block text-xs text-env-muted">
                    {a.origin === 'auto' ? 'Automática' : 'Manual'} · {statusLabel(a.status)} · a{' '}
                    {roleLabel(a.target_role, vocab)} · {formatAgo(a.created_at, now)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
