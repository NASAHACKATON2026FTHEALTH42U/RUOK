import { useEnvironments } from '../../api/useEnvironments'
import { useMembers } from '../../api/useMembers'
import { useEnvironmentStore } from '../../store/environment'
import type { Recipient } from './OperatorMessageForm'

/**
 * Ámbito del centro de control: el entorno activo (completo) y, si se ha elegido, un member de
 * ese entorno. Todo lo que se ve y se hace en las secciones del operador sale de aquí.
 */
export function useControlScope() {
  const envId = useEnvironmentStore((s) => s.envId)
  const storedMemberId = useEnvironmentStore((s) => s.memberId)
  const envs = useEnvironments()
  const members = useMembers(envId)
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined
  const recipients: Recipient[] =
    members.state === 'ready' ? members.data.map((m) => ({ id: m.id, name: m.name })) : []
  // El member guardado puede ser de otro entorno: entonces, todo el entorno.
  const memberId = recipients.some((r) => r.id === storedMemberId) ? storedMemberId : null
  const memberName = (id: number | null | undefined) =>
    recipients.find((r) => r.id === id)?.name ?? (id != null ? `#${id}` : '')
  return { envId, env, members, recipients, memberId, memberName }
}
