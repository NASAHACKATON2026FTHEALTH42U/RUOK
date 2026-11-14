import { syncNow, useOutboxStore } from '../../offline/outbox'

/**
 * Chip de la cabecera con lo que falta por sincronizar (FE-11). Solo aparece si hay algo:
 * "3 pendientes de sincronizar", "Sincronizando…" o "1 rechazada". Pulsarlo fuerza un intento.
 */
export function PendingSyncChip() {
  const { pending, failed, syncing, paused } = useOutboxStore()
  if (pending === 0 && failed === 0) return null

  const text = syncing
    ? 'Sincronizando…'
    : paused
      ? `${pending} pendientes · inicia sesión para enviar`
      : pending > 0
        ? `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'} de sincronizar`
        : ''

  return (
    <button
      type="button"
      onClick={() => void syncNow(true)}
      title="Guardado en este dispositivo. Pulsa para reintentar el envío ahora."
      className="inline-flex items-center gap-1.5 rounded-full border border-env-border bg-env-bg px-2.5 py-1 font-mono text-xs text-env-text hover:border-env-text"
    >
      <span aria-hidden>{syncing ? '⟳' : '⇡'}</span>
      <span role="status">
        {text}
        {failed > 0 && `${text ? ' · ' : ''}${failed} ${failed === 1 ? 'rechazada' : 'rechazadas'}`}
      </span>
    </button>
  )
}
