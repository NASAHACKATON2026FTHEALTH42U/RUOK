import { useEffect, useState } from 'react'
import type { OutboxEntry } from '../../offline/db'
import {
  discardEntry,
  failedEntries,
  retryEntry,
  syncNow,
  useOutboxStore,
} from '../../offline/outbox'
import { dateLocale } from '../../i18n/lang'
import { translate, useT } from '../../i18n/t'
import { Modal } from './Modal'

/** Qué era cada envío, en palabras (se traduce al pintarlo). */
const KIND_LABEL: Record<OutboxEntry['kind'], string> = {
  measurement_batch: 'Mediciones',
  task_completion: 'Tarea completada',
  protocol_completion: 'Protocolo completado',
  alert: 'Alerta o SOS',
  ruok: 'Respuesta a «R U OK?»',
  privacy: 'Ajuste de privacidad',
  home_message: 'Mensaje a casa',
  kudos: 'Kudos',
  mission_join: 'Apuntarse a una misión',
}

/** El motivo que da el servidor (su `detail`), o el código si no hay más. */
function reason(entry: OutboxEntry): string {
  const raw = entry.last_error ?? ''
  try {
    const parsed = JSON.parse(raw) as { detail?: unknown }
    if (typeof parsed.detail === 'string') return parsed.detail
    if (Array.isArray(parsed.detail)) return translate('Datos no válidos para el servidor')
  } catch {
    // no era JSON
  }
  return raw || translate('El servidor lo ha rechazado')
}

/**
 * Chip con lo que falta por sincronizar (FE-11). Solo aparece si hay algo: "3 pendientes de
 * sincronizar", "Sincronizando…" o "1 rechazada". Con pendientes, pulsarlo fuerza un intento;
 * con rechazadas, abre la lista para ver el motivo y reintentarlas o descartarlas.
 */
export function PendingSyncChip() {
  const t = useT()
  const { pending, failed, syncing, paused } = useOutboxStore()
  const [open, setOpen] = useState(false)
  if (pending === 0 && failed === 0) return null

  const text = syncing
    ? t('Sincronizando…')
    : paused
      ? t('{n} pendientes · inicia sesión para enviar', { n: pending })
      : pending > 0
        ? pending === 1
          ? t('1 pendiente de sincronizar')
          : t('{n} pendientes de sincronizar', { n: pending })
        : ''

  return (
    <>
      <button
        type="button"
        onClick={() => (failed > 0 ? setOpen(true) : void syncNow(true))}
        title={
          failed > 0
            ? t('Ver lo rechazado y reintentarlo')
            : t('Guardado en este dispositivo. Pulsa para reintentar el envío ahora.')
        }
        className={`inline-flex items-center gap-1.5 border bg-env-bg px-2.5 py-1 font-mono text-xs text-env-text hover:border-env-text ${failed > 0 ? 'border-st-warn' : 'border-env-border'}`}
      >
        <span aria-hidden>{syncing ? '⟳' : failed > 0 ? '!' : '⇡'}</span>
        <span role="status">
          {text}
          {failed > 0 &&
            `${text ? ' · ' : ''}${failed === 1 ? t('1 rechazada · ver') : t('{n} rechazadas · ver', { n: failed })}`}
        </span>
      </button>
      {open && <RejectedDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function RejectedDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const failed = useOutboxStore((s) => s.failed)
  const [items, setItems] = useState<OutboxEntry[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    failedEntries()
      .then((list) => !cancelled && setItems(list))
      .catch(() => !cancelled && setItems([]))
    return () => {
      cancelled = true
    }
  }, [failed])

  const run = async (id: string, fn: (id: string) => Promise<void>) => {
    setBusy(id)
    try {
      await fn(id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="rejected-title">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="hud-panel w-full max-w-xl bg-env-surface">
          <h2 id="rejected-title" className="hud-panel-head">
            {t('Envíos rechazados')}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Cerrar')}
              className="mr-2.5 ml-auto px-2 text-lg leading-none text-env-muted hover:text-env-text"
            >
              ×
            </button>
          </h2>
          <p className="px-4 pt-3 text-sm text-env-muted">
            {t(
              'El servidor no los aceptó y siguen guardados en este dispositivo. Puedes reintentarlos (por si ya se ha resuelto, p. ej. tras iniciar sesión) o descartarlos.',
            )}
          </p>
          {items === null ? (
            <div className="m-4 h-16 animate-pulse bg-env-bg" aria-busy="true" />
          ) : items.length === 0 ? (
            <p className="p-4 text-sm">{t('No queda nada rechazado.')}</p>
          ) : (
            <ul className="mt-2 max-h-[60dvh] divide-y divide-env-border/60 overflow-y-auto border-t border-env-border/60">
              {items.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 px-4 py-3"
                  style={{ boxShadow: 'inset 3px 0 0 var(--color-st-warn)' }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      {KIND_LABEL[e.kind] ? t(KIND_LABEL[e.kind]) : e.kind}
                    </span>
                    <span className="shrink-0 text-xs text-env-muted">
                      {new Date(e.created_at).toLocaleString(dateLocale(), {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{reason(e)}</p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy === e.id}
                      onClick={() => void run(e.id, discardEntry)}
                      className="hud-btn !h-10 px-3 disabled:opacity-60"
                    >
                      {t('Descartar')}
                    </button>
                    <button
                      type="button"
                      disabled={busy === e.id}
                      onClick={() => void run(e.id, retryEntry)}
                      className="hud-btn hud-btn-primary !h-10 px-3 disabled:opacity-60"
                    >
                      {t('Reintentar')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
