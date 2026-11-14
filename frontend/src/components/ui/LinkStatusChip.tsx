import { useLink } from '../../api/useLink'
import { useAuth } from '../../auth/useAuth'
import { useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'
import { describeLink } from './link'

/** Cada cuánto se consulta el enlace (hasta que llegue el tiempo real, FE-29). */
const REFRESH_MS = 5_000

/**
 * Chip de la cabecera con el estado del enlace simulado con el control externo (FE-17):
 * en línea / con retardo / sin enlace (LOS), el retardo y los mensajes en cola. Visible en
 * todas las vistas en cuanto hay entorno; se actualiza cada 5 s. Si no se puede consultar,
 * dice "desconocido" en vez de mostrar el último estado. Con `quiet`, solo aparece si el enlace
 * no está "en línea".
 */
export function LinkStatusChip({ quiet = false }: { quiet?: boolean }) {
  const envId = useEnvironmentStore((s) => s.envId)
  const { ground, crew } = useVocab()
  const { role } = useAuth()
  // El otro extremo del enlace: para quien está a bordo, tierra; para tierra, la tripulación.
  const other = role === 'responder' || role === 'psych' ? crew : ground
  const link = useLink(envId, REFRESH_MS)
  if (!envId || link.state === 'loading') return null

  const data = link.state === 'ready' && !link.refreshFailed ? link.data : null
  const d = describeLink(data)
  const los = data?.state === 'los'
  // `quiet` (barra lateral): en línea no se pinta nada; con retardo, sin enlace o desconocido, sí.
  if (quiet && data?.state === 'online') return null

  return (
    <span
      role="status"
      title={`Enlace con ${other}: ${d.long}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs ${
        los ? 'border-env-text font-semibold' : 'border-env-border'
      } bg-env-bg text-env-text`}
    >
      <span aria-hidden>{d.icon}</span>
      <span className="sm:hidden">{d.short}</span>
      <span className="hidden sm:inline">
        <span className="text-env-muted">Enlace con {other}:</span> {d.long}
      </span>
    </span>
  )
}
