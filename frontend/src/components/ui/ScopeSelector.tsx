import { useEnvironments } from '../../api/useEnvironments'
import { useMembers } from '../../api/useMembers'
import { useAuth } from '../../auth/useAuth'
import { capitalize, useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'
import { useT } from '../../i18n/t'

const SELECT = 'hud-input w-full min-w-0 !py-1.5 !font-sans !text-[0.9375rem] disabled:opacity-60'

/**
 * Ámbito de trabajo: el ÚNICO sitio donde se elige el entorno (solo el operador) y el member
 * (quien supervisa: operador, medic, commander). Todas las vistas muestran y actúan sobre lo
 * elegido aquí. Va arriba de la barra lateral y, en el móvil, en «Más».
 */
export function ScopeSelector({ className = '' }: { className?: string }) {
  const t = useT()
  const { can } = useAuth()
  const vocab = useVocab()
  const showEnv = can('action:change-environment')
  const showMember = can('view:members')
  const envId = useEnvironmentStore((s) => s.envId)
  const memberId = useEnvironmentStore((s) => s.memberId)
  const selectEnvironment = useEnvironmentStore((s) => s.selectEnvironment)
  const selectMember = useEnvironmentStore((s) => s.selectMember)
  const envs = useEnvironments()
  const members = useMembers(showMember ? envId : null)

  if (!showEnv && !showMember) return null
  const envList = envs.state === 'ready' ? envs.data : []
  const list = members.state === 'ready' ? members.data : []
  // El member guardado puede ser de otro entorno o ya no existir: entonces, todo el entorno.
  const memberValue = list.some((m) => m.id === memberId) ? String(memberId) : ''

  return (
    <section
      aria-label={t('Ámbito')}
      className={`hud-panel flex flex-col gap-2.5 p-3 ${className}`}
    >
      {showEnv && (
        <label className="flex min-w-0 flex-col gap-1">
          <span className="hud-label">{t('Entorno')}</span>
          <select
            value={envId ?? ''}
            disabled={envs.state !== 'ready'}
            onChange={(e) => {
              const next = envList.find((x) => x.id === e.target.value)
              if (next) selectEnvironment(next)
            }}
            className={SELECT}
          >
            {!envId && (
              <option value="" disabled>
                {envs.state === 'loading' ? t('Cargando…') : t('Elige un entorno…')}
              </option>
            )}
            {envList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {showMember && envId && (
        <label className="flex min-w-0 flex-col gap-1">
          <span className="hud-label">{capitalize(vocab.member)}</span>
          <select
            value={memberValue}
            disabled={members.state !== 'ready'}
            onChange={(e) => {
              if (e.target.value) selectMember(Number(e.target.value))
              else useEnvironmentStore.setState({ memberId: null })
            }}
            className={SELECT}
          >
            <option value="">
              {members.state === 'loading'
                ? t('Cargando…')
                : members.state === 'error'
                  ? t('Sin conexión')
                  : t('Todo {crew}', { crew: vocab.crew })}
            </option>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  )
}
