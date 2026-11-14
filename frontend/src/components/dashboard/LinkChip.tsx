import type { LinkStatus } from '../../api/useLink'

/** Retardo de una vía legible: "14 min", "2 s". */
function formatDelay(s: number): string {
  return s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`
}

/**
 * Estado del enlace simulado con el control externo. Usa forma + texto, sin colores de semáforo
 * (el enlace no es un estado de salud). TODO(FE-17): indicador global en la cabecera.
 */
export function LinkChip({ link, ground }: { link: LinkStatus; ground: string }) {
  const text =
    link.state === 'online'
      ? 'En línea'
      : link.state === 'delayed'
        ? `Con retardo · ${formatDelay(link.delay_s)}`
        : 'Sin enlace (LOS)'
  const dot = link.state === 'online' ? '●' : link.state === 'delayed' ? '◐' : '○'

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-env-border bg-env-surface px-2.5 py-1 text-sm"
      title={`Enlace con ${ground}`}
    >
      <span aria-hidden>{dot}</span>
      <span>
        <span className="text-env-muted">Enlace con {ground}:</span> {text}
        {link.queued > 0 && <span className="text-env-muted"> · {link.queued} en cola</span>}
      </span>
    </span>
  )
}
