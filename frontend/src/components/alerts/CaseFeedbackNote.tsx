import { useMemberAlerts } from '../../api/useAlerts'
import { useSystems } from '../../api/useSystems'
import { useActiveMemberId, useAuth } from '../../auth/useAuth'
import { useVocab } from '../../environments/useVocab'
import { caseFeedback, type CaseFeedback } from './caseFeedback'
import { roleLabel } from './sos'

/** Mensaje de seguimiento de un caso abierto (FE-38): «Estamos revisando tu caso». */
export function CaseFeedbackNote({
  feedback,
  className = '',
}: {
  feedback: CaseFeedback
  className?: string
}) {
  const improving = feedback.tone === 'improving'
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        improving ? 'border-st-ok/50 bg-st-ok/10' : 'border-env-primary/50 bg-env-primary/10'
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`mt-0.5 shrink-0 ${improving ? 'text-st-ok' : 'text-env-primary'}`}
      >
        {improving ? (
          // Flecha que sube: va a mejor.
          <path d="M4 17l6-6 4 4 6-7M14 8h6v6" />
        ) : (
          // Reloj de arena: lo están revisando.
          <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
        )}
      </svg>
      <div>
        <p className="font-semibold">{feedback.title}</p>
        <p className="text-sm text-env-muted">{feedback.text}</p>
      </div>
    </div>
  )
}

/** El seguimiento del caso de un sistema para el member de la sesión (nada para otros roles). */
function useCaseFeedback(systemId: string, current: string | undefined): CaseFeedback | null {
  const { role } = useAuth()
  const memberId = useActiveMemberId()
  const vocab = useVocab()
  const systems = useSystems()
  // Solo el propio member: a un sanitario no se le dice «nos alegra ver que estás mejor».
  const alerts = useMemberAlerts(role === 'member' ? memberId : null)
  if (role !== 'member' || alerts.state !== 'ready') return null
  const name =
    systems.state === 'ready' ? systems.data.find((s) => s.id === systemId)?.name : undefined
  return caseFeedback(alerts.data, systemId, current, {
    system: name ?? 'Este sistema',
    role: (r) => roleLabel(r, vocab),
  })
}

/** «Estamos revisando tu caso» para un sistema, si tiene un aviso abierto. */
export function CaseFeedbackFor({
  systemId,
  current,
  className = '',
}: {
  systemId: string
  /** Estado actual del sistema (de la evaluación más reciente). */
  current: string | undefined
  className?: string
}) {
  const feedback = useCaseFeedback(systemId, current)
  return feedback ? <CaseFeedbackNote feedback={feedback} className={className} /> : null
}
