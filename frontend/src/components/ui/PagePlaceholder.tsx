import { useT } from '../../i18n/t'

interface PagePlaceholderProps {
  title: string
  /** Issue que implementará la página (p. ej. "FE-07"). */
  issue?: string
}

/** Contenido provisional de las rutas vacías de FE-01. */
export function PagePlaceholder({ title, issue }: PagePlaceholderProps) {
  const t = useT()
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-env-muted">
        {issue ? t('Página en construcción ({issue}).', { issue }) : t('Página en construcción.')}
      </p>
    </section>
  )
}
