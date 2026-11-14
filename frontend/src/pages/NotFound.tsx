import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <Link to="/" className="mt-2 inline-block underline hover:text-env-muted">
        Volver al inicio
      </Link>
    </section>
  )
}
