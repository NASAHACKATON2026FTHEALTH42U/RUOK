import type { ReactNode } from 'react'
import { StatusBadge } from '../ui/StatusBadge'
import { Icon } from '../ui/Icon'
import type { DisplayState } from '../ui/status'

/**
 * Contenido común de una fila de alerta (Alertas, alertas del entorno y consola de tierra), con
 * aire y en tres líneas: quién o qué y la gravedad; el estado y la antigüedad; y el destino.
 */
export function AlertRowBody({
  title,
  status,
  severityLabel,
  state,
  ago,
  target,
}: {
  title: ReactNode
  status: DisplayState
  severityLabel: string
  /** «Escalada · Manual», «Resuelta · entregada»… */
  state: string
  ago: string
  /** «a tripulación»: a quién va (opcional). */
  target?: string
}) {
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 leading-snug font-medium">{title}</span>
        <StatusBadge status={status} label={severityLabel} size="sm" className="shrink-0" />
      </span>
      <span className="flex items-baseline justify-between gap-3 text-[0.8125rem] text-env-muted">
        <span className="truncate">{state}</span>
        <span className="shrink-0 tabular-nums">{ago}</span>
      </span>
      {target && (
        <span className="flex items-center gap-1.5 text-[0.8125rem] text-env-text/80">
          <Icon name="escalate" size={13} className="rotate-90 text-env-muted" />
          <span className="truncate">{target}</span>
        </span>
      )}
    </>
  )
}
