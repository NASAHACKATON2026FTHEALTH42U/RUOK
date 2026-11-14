import { useCallback, useState } from 'react'
import { useEnvironments } from '../../api/useEnvironments'
import { useInterventions } from '../../api/useInterventions'
import { useAuth } from '../../auth/useAuth'
import { useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'
import { SosDialog } from '../alerts/SosDialog'
import { ActivitySelector } from './ActivitySelector'
import { RuokModal } from './RuokModal'
import { useHeartbeat } from './useHeartbeat'

/**
 * Liveness del dispositivo (FE-15). Solo en la sesión de un `member` (es SU dispositivo el que
 * da señales de vida): heartbeat cada 15 s y modal "R U OK?" cuando el servidor lo pide.
 * "Necesito ayuda" puede abrir el diálogo SOS (FE-13). Va montado siempre en el Layout; el
 * selector de actividad va aparte (`MemberActivitySelector`), en «Más» y en la barra lateral.
 */
export function LivenessGuard() {
  const { role, user } = useAuth()
  const memberId = role === 'member' ? (user?.member_id ?? null) : null
  const { checkinRequired, answered } = useHeartbeat(memberId)
  const [sosOpen, setSosOpen] = useState(false)
  const closeSos = useCallback(() => setSosOpen(false), [])

  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined
  const vocabulary = useVocab()
  const interventions = useInterventions()

  if (memberId === null) return null

  return (
    <>
      {checkinRequired && (
        <RuokModal memberId={memberId} onAnswered={answered} onOpenSos={() => setSosOpen(true)} />
      )}
      {sosOpen && (
        <SosDialog
          memberId={memberId}
          env={env}
          vocabulary={vocabulary}
          interventions={interventions.state === 'ready' ? interventions.data : []}
          onClose={closeSos}
        />
      )}
    </>
  )
}

/** Selector de actividad (Normal / EVA / Sueño) del member de la sesión; nada para otros roles. */
export function MemberActivitySelector() {
  const { role } = useAuth()
  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  if (role !== 'member') return null
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined
  return <ActivitySelector isSpace={env?.kind === 'space'} />
}
