import { motion, MotionConfig } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useEnvironments, type Environment } from '../api/useEnvironments'
import { EnvironmentCard } from '../components/environment/EnvironmentCard'
import { useT } from '../i18n/t'
import { useEnvironmentStore } from '../store/environment'

/**
 * Selección de entorno (FE-03). Solo para el operador (admin): la ruta está protegida con
 * RequireRole (FE-28); el resto entra en su entorno. Al elegir uno, el tema y los textos cambian
 * y se va al centro de control de ese entorno (gestión y monitorización, no la vista de un member).
 */
export default function EnvironmentSelect() {
  const t = useT()
  const envs = useEnvironments()
  const currentEnvId = useEnvironmentStore((s) => s.envId)
  const selectEnvironment = useEnvironmentStore((s) => s.selectEnvironment)
  const navigate = useNavigate()

  const choose = (env: Environment) => {
    selectEnvironment(env) // el tema y los textos cambian ya, con la transición de FE-02
    navigate('/control')
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-semibold">{t('Elige el entorno')}</h1>
        <p className="mt-1 text-env-muted">
          {t('Cada entorno cambia los umbrales, el escalado de alertas, los textos y los colores.')}
        </p>

        {envs.state === 'loading' && (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-36 animate-pulse  bg-env-surface" />
            ))}
          </ul>
        )}

        {envs.state === 'error' && (
          <div className="mt-6  border border-env-border bg-env-surface p-4">
            <p>
              {t('No se han podido cargar los entornos. Comprueba la conexión con el servidor.')}
            </p>
            <button
              type="button"
              onClick={envs.retry}
              className="mt-3  bg-env-primary px-3 py-1.5 text-sm font-medium text-env-primary-text"
            >
              {t('Reintentar')}
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
    </MotionConfig>
  )
}
