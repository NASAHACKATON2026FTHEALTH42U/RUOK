import { useNavigate } from 'react-router-dom'
import { userRoleLabel } from '../../auth/permissions'
import { logout, useSession } from '../../auth/session'
import { useVocab } from '../../environments/useVocab'

/**
 * Usuario de la sesión y "Salir" en la cabecera. Cerrar sesión NO borra el outbox.
 * `part` permite pintar solo el usuario o solo el botón (la barra superior de escritorio los
 * separa: el usuario a la izquierda y "Salir" pegado a la derecha).
 */
export function SessionMenu({ part = 'all' }: { part?: 'all' | 'user' | 'logout' }) {
  const user = useSession((s) => s.user)
  const vocabulary = useVocab()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <span className="flex items-center gap-2 text-sm">
      {part !== 'logout' && (
        <span className="text-env-muted">
          <span className="text-env-text">{user.display_name}</span> ·{' '}
          {userRoleLabel(user.role, vocabulary, user.role_label)}
        </span>
      )}
      {part !== 'user' && (
        <button
          type="button"
          onClick={async () => {
            await logout()
            navigate('/login')
          }}
          className="rounded-md border border-env-border px-2 py-0.5 text-env-muted hover:border-env-text hover:text-env-text"
        >
          Salir
        </button>
      )}
    </span>
  )
}
