import { Link } from 'react-router-dom'
import { useT } from '../i18n/t'

export default function NotFound() {
  const t = useT()
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t('Página no encontrada')}</h1>
      <Link to="/" className="mt-2 inline-block underline hover:text-env-muted">
        {t('Volver al inicio')}
      </Link>
    </section>
  )
}
