import type { MemberSummary } from '../../api/useMembers'
import { capitalize } from '../../environments/useVocab'
import type { Vocabulary } from '../../store/environment'
import { livenessState, statusStyle } from '../ui/status'
import { StatusIcon } from '../ui/StatusBadge'
import { memberDisplayState } from './crewOverview'

/**
 * Selector de la vista individual (FE-35): un botón por member con su estado (icono y texto para
 * lectores de pantalla), en el orden de siempre para que no salten de sitio. Si no caben, scroll
 * horizontal.
 */
export function MemberStrip({
  members,
  selectedId,
  vocabulary,
  onSelect,
  className = '',
}: {
  members: readonly MemberSummary[]
  selectedId: number | null
  vocabulary: Vocabulary
  onSelect: (memberId: number) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={`Elige ${vocabulary.member}`}
      className={`flex gap-2 overflow-x-auto pb-1 [scrollbar-color:var(--env-border)_transparent] [scrollbar-width:thin] ${className}`}
    >
      {members.map((m) => {
        const state = memberDisplayState(m)
        const live = livenessState(m.liveness)
        const on = m.id === selectedId
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(m.id)}
            title={vocabulary[m.position] ? capitalize(vocabulary[m.position]) : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-2 border px-3 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-env-primary ${
              on
                ? 'border-env-primary bg-env-primary/12 text-env-text'
                : 'border-env-border text-env-muted hover:border-env-text hover:text-env-text'
            }`}
          >
            <StatusIcon
              glyph={statusStyle(state).glyph}
              color={statusStyle(state).color}
              size={14}
            />
            {live && (
              <StatusIcon
                glyph={statusStyle(live).glyph}
                color={statusStyle(live).color}
                size={14}
              />
            )}
            <span className={on ? 'font-medium' : ''}>{m.name}</span>
            <span className="sr-only">
              : {statusStyle(state).label}
              {live ? `, ${statusStyle(live).label}` : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
