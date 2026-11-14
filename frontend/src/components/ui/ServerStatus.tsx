import { useMockStatus } from '../../api/mocks/useMockStatus'
import { useServerHealth } from '../../api/useServerHealth'

/**
 * Chip con el estado de la conexión con el servidor de a bordo (GET /health).
 * Sin verde (se confundiría con el estado de salud "normal") ni colores fijos: forma + texto
 * con los tokens del tema (FE-34).
 */
export function ServerStatus() {
  const status = useServerHealth()
  const mock = useMockStatus()

  const { icon, label, strong } =
    mock === 'mock'
      ? { icon: '◆', label: 'Modo demo (sin servidor)', strong: true }
      : status.state === 'online'
        ? { icon: '●', label: 'Servidor conectado', strong: false }
        : status.state === 'offline'
          ? { icon: '○', label: 'Servidor sin conexión', strong: true }
          : { icon: '◌', label: 'Conectando…', strong: false }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${
        strong ? 'border-env-text font-semibold text-env-text' : 'border-env-border text-env-muted'
      }`}
      title={status.state === 'offline' ? status.error : undefined}
      role="status"
    >
      <span aria-hidden className={status.state === 'checking' ? 'animate-pulse' : ''}>
        {icon}
      </span>
      {label}
    </span>
  )
}
