import { AnimatePresence, LayoutGroup, motion, MotionConfig } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEnvironments, type Environment } from '../api/useEnvironments'
import { EnvironmentCard } from '../components/environment/EnvironmentCard'
import { MemberList } from '../components/environment/MemberList'
import { capitalize, useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'

/**
 * Selección de entorno y de member (FE-03).
 * Paso 1: una tarjeta por entorno. Paso 2: members de ese entorno → /dashboard.
 * TODO(FE-28): solo para el rol admin; el resto entra directamente en su entorno.
 */
export default function EnvironmentSelect() {
  const envs = useEnvironments()
  const currentEnvId = useEnvironmentStore((s) => s.envId)
  const selectEnvironment = useEnvironmentStore((s) => s.selectEnvironment)
  const selectMember = useEnvironmentStore((s) => s.selectMember)
  const vocabulary = useVocab()
  const navigate = useNavigate()
  const [chosen, setChosen] = useState<Environment | null>(null)

  const choose = (env: Environment) => {
    selectEnvironment(env) // el tema y los textos cambian ya, con la transición de FE-02
    setChosen(env)
  }

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <AnimatePresence mode="wait" initial={false}>
          {chosen ? (
            <motion.section
              key="members"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <button
                type="button"
                onClick={() => setChosen(null)}
                className="text-sm text-env-muted underline-offset-2 hover:text-env-text hover:underline"
              >
                ← Cambiar de entorno
              </button>
              <div className="max-w-sm">
                <EnvironmentCard env={chosen} />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-env-muted">
                  {capitalize(vocabulary.crew)}
                </p>
                <h1 className="mt-1 mb-4 text-2xl font-semibold">¿Quién eres?</h1>
                <MemberList
                  envId={chosen.id}
                  vocabulary={vocabulary}
                  onSelect={(memberId) => {
                    selectMember(memberId)
                    navigate('/dashboard')
                  }}
                />
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="envs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <h1 className="text-2xl font-semibold">Elige el entorno</h1>
              <p className="mt-1 text-env-muted">
                Cada entorno cambia los umbrales, el escalado de alertas, los textos y los colores.
              </p>

              {envs.state === 'loading' && (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
                  {Array.from({ length: 6 }, (_, i) => (
                    <li key={i} className="h-36 animate-pulse rounded-xl bg-env-surface" />
                  ))}
                </ul>
              )}

              {envs.state === 'error' && (
                <div className="mt-6 rounded-lg border border-env-border bg-env-surface p-4">
                  <p>
                    No se han podido cargar los entornos. Comprueba la conexión con el servidor.
                  </p>
                  <button
                    type="button"
                    onClick={envs.retry}
                    className="mt-3 rounded-md bg-env-primary px-3 py-1.5 text-sm font-medium text-env-primary-text"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {envs.state === 'ready' && (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {envs.data.map((env, i) => (
                    <motion.li
                      key={env.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 * i }}
                    >
                      <EnvironmentCard
                        env={env}
                        current={env.id === currentEnvId}
                        onSelect={() => choose(env)}
                      />
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </MotionConfig>
  )
}
