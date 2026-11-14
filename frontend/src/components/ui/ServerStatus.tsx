import { useMockStatus } from '../../api/mocks/useMockStatus'
import { useServerHealth } from '../../api/useServerHealth'

/** Chip con el estado de la conexión con el servidor de a bordo (GET /health). */
export function ServerStatus() {
  const status = useServerHealth()
  const mock = useMockStatus()

  const { dot, label } =
    mock === 'mock'
      ? { dot: 'bg-amber-400', label: 'Modo demo (sin servidor)' }
      : status.state === 'online'
        ? { dot: 'bg-emerald-400', label: 'Servidor conectado' }
        : status.state === 'offline'
          ? { dot: 'bg-slate-500', label: 'Servidor sin conexión' }
          : { dot: 'bg-slate-500 animate-pulse', label: 'Conectando…' }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-env-border px-2.5 py-1 text-xs text-env-muted"
      title={status.state === 'offline' ? status.error : undefined}
      role="status"
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  )
}
