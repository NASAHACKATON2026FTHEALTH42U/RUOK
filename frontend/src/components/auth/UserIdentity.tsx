import { useEnvironments } from '../../api/useEnvironments'
import { useMember } from '../../api/useMember'
import { userRoleLabel } from '../../auth/permissions'
import { useSession } from '../../auth/session'
import { capitalize, useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'
import { initials, shortDisplayName } from './demoUsers'

/**
 * Quién ha entrado (cabecera): avatar con iniciales, el nombre y, debajo, su papel con las
 * palabras del entorno.
 * - Member: su nombre y "Comandante · Astronauta · Base lunar Artemis" (el puesto, si el
 *   vocabulario lo nombra; el sustantivo del entorno; y el entorno).
 * - Resto de roles: el rol como nombre ("Oficial médico") y el entorno debajo.
 */
export function UserIdentity() {
  const user = useSession((s) => s.user)
  const vocabulary = useVocab() as Record<string, string | undefined>
  const selectedEnvId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const member = useMember(user?.role === 'member' ? (user.member_id ?? null) : null)
  if (!user) return null

  const envId = user.env_id ?? selectedEnvId
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined
  const role = capitalize(
    userRoleLabel(user.role, vocabulary as Record<string, string>, user.role_label),
  )

  let name: string
  let detail: (string | undefined)[]
  if (user.role === 'member') {
    name = shortDisplayName(user.display_name, env?.name)
    const position = member.state === 'ready' ? vocabulary[member.data.position] : undefined
    const title = position ? capitalize(position) : undefined
    detail = [
      title && title.toLowerCase() !== role.toLowerCase() ? title : undefined,
      role,
      env?.name,
    ]
  } else if (user.role === 'admin') {
    name = user.display_name
    detail = ['Administración del sistema']
  } else {
    name = role
    detail = [env?.name]
  }
  const line = detail.filter(Boolean).join(' · ')

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-env-primary/60 bg-env-primary/10 font-mono text-xs font-medium tracking-wider text-env-primary"
      >
        {initials(name)}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[0.9375rem] font-medium text-env-text">{name}</span>
        {line && <span className="block truncate text-xs text-env-muted">{line}</span>}
      </span>
    </span>
  )
}
