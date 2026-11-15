import { useMockStatus } from '../../api/mocks/useMockStatus'
import { useServerHealth } from '../../api/useServerHealth'
import { useT } from '../../i18n/t'

/**
 * Chip con el estado de la conexión con el servidor de a bordo (GET /health).
 * Sin verde (se confundiría con el estado de salud "normal") ni colores fijos: forma + texto
 * con los tokens del tema (FE-34). Con `quiet`, solo aparece si no está "conectado".
 */
export function ServerStatus({ quiet = false }: { quiet?: boolean }) {
  const t = useT()
  const status = useServerHealth()
  const mock = useMockStatus()
  // `quiet` (barra lateral): con el servidor conectado no se pinta nada; solo avisa si hay problema.
  if (quiet && mock !== 'mock' && status.state === 'online') return null

  const { icon, label, strong } =
    mock === 'mock'
      ? { icon: '◆', label: t('Modo demo (sin servidor)'), strong: true }
      : status.state === 'online'
        ? { icon: '●', label: t('Servidor conectado'), strong: false }
        : status.state === 'offline'
          ? { icon: '○', label: t('Servidor sin conexión'), strong: true }
          : { icon: '◌', label: t('Conectando…'), strong: false }

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
