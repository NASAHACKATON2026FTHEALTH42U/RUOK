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
          <span className="text-env-text">{user.display_name}</span>
          {/* El rol solo en «Más»; en la barra superior (part="user") va solo el nombre. */}
          {part === 'all' && <> · {userRoleLabel(user.role, vocabulary, user.role_label)}</>}
        </span>
      )}
      {part !== 'user' && (
        <button
          type="button"
          onClick={async () => {
            await logout()
            navigate('/login')
          }}
          className="relative inline-flex min-h-10 items-center gap-2 rounded-md border border-env-primary/70 bg-env-primary/10 px-3.5 font-medium text-env-text md:min-h-11 md:px-4 md:text-base before:absolute before:inset-x-0 before:-inset-y-[4px] before:content-[''] hover:bg-env-primary hover:text-env-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary"
        >
          <svg
            viewBox="0 0 16 16"
            width="18"
            height="18"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6.5 2.5h-3v11h3M10 5l3 3-3 3M13 8H6.5" />
          </svg>
          Salir
        </button>
      )}
    </span>
  )
}
