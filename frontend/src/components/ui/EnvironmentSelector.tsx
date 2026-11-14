import { PLACEHOLDER_ENVIRONMENTS, type EnvironmentId } from '../../environments'
import { useEnvironmentStore } from '../../store/environment'

export function EnvironmentSelector() {
  const envId = useEnvironmentStore((s) => s.envId)
  const setEnvId = useEnvironmentStore((s) => s.setEnvId)

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">Entorno</span>
      <select
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-sky-400 focus:outline-none"
        value={envId ?? ''}
        onChange={(e) => setEnvId(e.target.value as EnvironmentId)}
      >
        <option value="" disabled>
          Elige un entorno…
        </option>
        {PLACEHOLDER_ENVIRONMENTS.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
    </label>
  )
}
