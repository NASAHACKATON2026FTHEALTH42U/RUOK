import { useEnvironments } from '../../api/useEnvironments'
import { useEnvironmentStore } from '../../store/environment'

export function EnvironmentSelector() {
  const envs = useEnvironments()
  const envId = useEnvironmentStore((s) => s.envId)
  const selectEnvironment = useEnvironmentStore((s) => s.selectEnvironment)
  const list = envs.state === 'ready' ? envs.data : []

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-env-muted">Entorno</span>
      <select
        className="rounded-md border border-env-border bg-env-bg px-2 py-1 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary disabled:opacity-60"
        value={envId ?? ''}
        disabled={envs.state !== 'ready'}
        onChange={(e) => {
          const env = list.find((x) => x.id === e.target.value)
          if (env) selectEnvironment(env)
        }}
      >
        <option value="" disabled>
          {envs.state === 'loading'
            ? 'Cargando…'
            : envs.state === 'error'
              ? 'Sin conexión'
              : 'Elige un entorno…'}
        </option>
        {list.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
    </label>
  )
}
