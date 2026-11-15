import { useState } from 'react'
import type { Intervention } from '../../api/useInterventions'
import { useT } from '../../i18n/t'
import { InterventionPlayer } from './InterventionPlayer'
import { unlockAudio } from './soundscapes'

interface InterventionCardProps {
  intervention: Intervention
  /** Tarjeta compacta (sin la lista de pasos), para el SystemPanel. */
  compact?: boolean
}

/**
 * Tarjeta de una intervención (FE-20): título, duración, pasos y "Empezar", que abre el modo
 * guiado con temporizador. El catálogo se guarda en el dispositivo (`useInterventions`), así que
 * funciona sin conexión.
 */
export function InterventionCard({ intervention, compact = false }: InterventionCardProps) {
  const [playing, setPlaying] = useState(false)
  const t = useT()

  return (
    <div className=" border border-env-border bg-env-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {intervention.title}{' '}
          <span className="text-sm font-normal text-env-muted">
            · {intervention.duration_min} min
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            unlockAudio() // dentro del clic, para que la voz guía pueda sonar en el iPhone
            setPlaying(true)
          }}
          className="shrink-0  bg-env-primary px-3 py-1.5 text-sm font-medium text-env-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-text"
        >
          {t('Empezar')}
        </button>
      </div>
      {!compact && (
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-env-muted">
          {intervention.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {playing && (
        <InterventionPlayer intervention={intervention} onClose={() => setPlaying(false)} />
      )}
    </div>
  )
}
