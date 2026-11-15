import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'
import { noMemberAction } from './noMember'

/**
 * Estado vacío común de las páginas de un member (FE-35): en vez de un enlace que el rol no
 * puede abrir, indica lo que sí puede hacer (elegir member o entorno en el ámbito, o ir a su consola).
 */
export function NoMemberSelected({ className = 'mt-2' }: { className?: string }) {
  const { role } = useAuth()
  const vocab = useVocab()
  const envId = useEnvironmentStore((s) => s.envId)
  const link = 'underline hover:text-env-text'

  switch (noMemberAction(role, envId)) {
    case 'pick':
      return (
        <div className={`flex flex-col items-start gap-2 text-env-muted ${className}`}>
          <p>
            No hay nadie seleccionado. Elige a quién quieres ver en el selector de {vocab.member}{' '}
            (arriba de la barra lateral; en el móvil, en «Más») o mira el estado de todos en{' '}
            <Link to="/members" className={link}>
              {vocab.crew}
            </Link>
            .
          </p>
        </div>
      )
    case 'choose-env':
      return (
        <p className={`text-env-muted ${className}`}>
          No hay nadie seleccionado. Elige el entorno y {vocab.member} arriba de la barra lateral
          (en el móvil, en «Más»).
        </p>
      )
    case 'ground':
      return (
        <p className={`text-env-muted ${className}`}>
          Desde tierra, el estado de {vocab.crew} está en la{' '}
          <Link to="/ground" className={link}>
            consola
          </Link>
          .
        </p>
      )
    case 'none':
      return <p className={`text-env-muted ${className}`}>No hay nadie seleccionado.</p>
  }
}
