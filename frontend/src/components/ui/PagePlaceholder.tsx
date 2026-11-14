interface PagePlaceholderProps {
  title: string
  /** Issue que implementará la página (p. ej. "FE-07"). */
  issue?: string
}

/** Contenido provisional de las rutas vacías de FE-01. */
export function PagePlaceholder({ title, issue }: PagePlaceholderProps) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-400">Página en construcción{issue ? ` (${issue})` : ''}.</p>
    </section>
  )
}
