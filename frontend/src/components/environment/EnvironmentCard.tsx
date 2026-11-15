import { motion } from 'framer-motion'
import type { Environment } from '../../api/useEnvironments'
import { formatDelay, formatGravity, formatKind } from '../../environments/format'
import { themeFor } from '../../environments/themes'
import { useT } from '../../i18n/t'

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
  const t = useT()
  const theme = themeFor(env.id)
  const content = (
    <>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: theme.primary }} />
      <span className="flex items-start justify-between gap-2">
        <span
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: theme.muted }}
        >
          {formatKind(env.kind)}
        </span>
        {current && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: theme.primary, color: theme.primaryText }}
          >
            {t('Actual')}
          </span>
        )}
      </span>
      <span className="mt-1 block text-lg font-semibold leading-snug">{env.name}</span>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt style={{ color: theme.muted }}>{t('Gravedad')}</dt>
        <dd>{formatGravity(env.gravity_g)}</dd>
        <dt style={{ color: theme.muted }}>{t('Retardo')}</dt>
        <dd>{formatDelay(env.comm_delay_s)}</dd>
      </dl>
    </>
  )

  const style = {
    background: theme.surface,
    color: theme.text,
    borderColor: theme.border,
    colorScheme: theme.scheme,
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
          aria-label={t('Entrar en {name}', { name: env.name })}
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
