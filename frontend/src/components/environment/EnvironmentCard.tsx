import { motion } from 'framer-motion'
import type { Environment } from '../../api/useEnvironments'
import { formatDelay, formatGravity, formatKind } from '../../environments/format'
import { themeFor } from '../../environments/themes'

interface EnvironmentCardProps {
  env: Environment
  /** Es el entorno activo ahora mismo. */
  current?: boolean
  /** Sin `onSelect`, la tarjeta es solo informativa (cabecera del paso 2). */
  onSelect?: () => void
}

/**
 * Tarjeta de un entorno, pintada con SU propia paleta (no la del entorno activo),
 * para que se vea el tema antes de entrar.
 */
export function EnvironmentCard({ env, current, onSelect }: EnvironmentCardProps) {
  const t = themeFor(env.id)
  const content = (
    <>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: t.primary }} />
      <span className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: t.muted }}>
          {formatKind(env.kind)}
        </span>
        {current && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: t.primary, color: t.primaryText }}
          >
            Actual
          </span>
        )}
      </span>
      <span className="mt-1 block text-lg font-semibold leading-snug">{env.name}</span>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt style={{ color: t.muted }}>Gravedad</dt>
        <dd>{formatGravity(env.gravity_g)}</dd>
        <dt style={{ color: t.muted }}>Retardo</dt>
        <dd>{formatDelay(env.comm_delay_s)}</dd>
      </dl>
    </>
  )

  const style = {
    background: t.surface,
    color: t.text,
    borderColor: t.border,
    colorScheme: t.scheme,
  }
  const className = 'relative block w-full overflow-hidden  border p-4 pt-5 text-left'

  return (
    <motion.div layoutId={`env-card-${env.id}`} className="h-full">
      {onSelect ? (
        <motion.button
          type="button"
          onClick={onSelect}
          className={`${className} flex h-full cursor-pointer flex-col justify-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary`}
          style={style}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          aria-label={`Entrar en ${env.name}`}
        >
          {content}
        </motion.button>
      ) : (
        <div className={className} style={style}>
          {content}
        </div>
      )}
    </motion.div>
  )
}
