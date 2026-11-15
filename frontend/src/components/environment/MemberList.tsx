import { motion } from 'framer-motion'
import { useMembers } from '../../api/useMembers'
import { useT } from '../../i18n/t'
import type { Vocabulary } from '../../store/environment'
import { livenessState } from '../ui/status'
import { StatusBadge } from '../ui/StatusBadge'

interface MemberListProps {
  envId: string
  vocabulary: Vocabulary
  onSelect: (memberId: number) => void
}

/** Members del entorno elegido. El puesto solo se muestra si el vocabulario lo traduce. */
export function MemberList({ envId, vocabulary, onSelect }: MemberListProps) {
  const t = useT()
  const members = useMembers(envId)

  if (members.state === 'loading') {
    return (
      <ul className="grid gap-3 sm:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => (
          <li key={i} className="h-16 animate-pulse  bg-env-surface" />
        ))}
      </ul>
    )
  }

  if (members.state === 'error') {
    return (
      <div className=" border border-env-border bg-env-surface p-4">
        <p>{t('No se ha podido cargar la lista.')}</p>
        <button
          type="button"
          onClick={members.retry}
          className="mt-3  bg-env-primary px-3 py-1.5 text-sm font-medium text-env-primary-text"
        >
          {t('Reintentar')}
        </button>
      </div>
    )
  }

  if (members.data.length === 0) {
    return <p className="text-env-muted">{t('No hay nadie dado de alta en este entorno.')}</p>
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {members.data.map((m, i) => {
        const live = livenessState(m.liveness)
        // "Sin datos" + "Sin datos recientes" sería redundante: el liveness explica el motivo.
        const badges =
          live === 'stale' && m.overall_status === 'unknown'
            ? [live]
            : live
              ? [m.overall_status, live]
              : [m.overall_status]
        return (
          <motion.li
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
          >
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              className="flex w-full items-center justify-between gap-3  border border-env-border bg-env-surface px-4 py-3 text-left hover:border-env-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary"
            >
              <span>
                <span className="block font-medium">{m.name}</span>
                {vocabulary[m.position] && (
                  <span className="block text-sm text-env-muted">{vocabulary[m.position]}</span>
                )}
              </span>
              <span className="flex flex-wrap items-center justify-end gap-1.5">
                {badges.map((b) => (
                  <StatusBadge key={b} status={b} size="sm" />
                ))}
                <span aria-hidden className="text-env-muted">
                  →
                </span>
              </span>
            </button>
          </motion.li>
        )
      })}
    </ul>
  )
}
