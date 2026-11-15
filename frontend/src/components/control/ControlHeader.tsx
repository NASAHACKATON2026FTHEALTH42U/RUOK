import type { ReactNode } from 'react'
import { useVocab } from '../../environments/useVocab'
import { useControlScope } from './useControlScope'

/**
 * Cabecera común de las secciones del centro de control: título, ámbito y acciones. El ámbito
 * (entorno y, si se ha elegido, un member) se elige en un solo sitio, arriba de la barra lateral;
 * aquí solo se recuerda.
 */
export function ControlHeader({
  title,
  subtitle,
  actions,
  memberScope = false,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** La sección se puede centrar en un member (si no, es siempre de todo el entorno). */
  memberScope?: boolean
}) {
  const { env, memberId, memberName } = useControlScope()
  const vocab = useVocab()

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <p className="hud-label">
          {env ? env.name : 'Sin entorno'}
          {memberScope &&
            env &&
            ` · ${memberId !== null ? memberName(memberId) : `todo ${vocab.crew}`}`}
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-env-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Panel HUD con cabecera: el bloque común de todas las secciones del centro de control. */
export function ControlPanel({
  title,
  aside,
  className = '',
  bodyClassName = 'p-4',
  children,
  ...rest
}: {
  title: ReactNode
  aside?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={`hud-panel flex min-w-0 flex-col ${className}`} {...rest}>
      <h2 className="hud-panel-head">
        {title}
        {aside && (
          <span className="mr-2.5 ml-auto flex items-center gap-2 normal-case tracking-normal text-env-muted">
            {aside}
          </span>
        )}
      </h2>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
