import { useLink } from '../../api/useLink'
import { useAuth } from '../../auth/useAuth'
import { useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'
import { useT } from '../../i18n/t'
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
  const t = useT()
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
    // Corta y en una línea: «Enlace · Sin enlace». El detalle (con quién, desde cuándo, cola) va en
    // el título y para lectores de pantalla.
    <span
      role="status"
      title={t('Enlace con {other}: {detail}', { other, detail: d.long })}
      className={`inline-flex max-w-full items-center gap-1.5 border px-2 py-1 font-mono text-xs whitespace-nowrap ${
        los ? 'border-env-text font-semibold' : 'border-env-border'
      } bg-env-bg text-env-text`}
    >
      <span aria-hidden>{d.icon}</span>
      <span className="text-env-muted">{t('Enlace')}</span>
      <span aria-hidden className="text-env-muted">
        ·
      </span>
      <span className="truncate">{d.short}</span>
      <span className="sr-only">{t(': con {other}, {detail}', { other, detail: d.long })}</span>
    </span>
  )
}
