import type { Environment } from '../../api/useEnvironments'
import { useIndicators } from '../../api/useIndicators'
import { useEnvironmentStore } from '../../store/environment'
import { roleLabel } from '../alerts/sos'
import { formatDelay, formatGravity, formatKind } from '../../environments/format'
import { formatDuration } from './feed'

/**
 * Cambio de entorno y configuración de solo lectura (FE-32). La edición de umbrales es P2:
 * los perfiles viven en backend/app/data/environments.json ("configuración, no código").
 */
export function EnvironmentConfig({ environments }: { environments: Environment[] }) {
  const envId = useEnvironmentStore((s) => s.envId)
  const selectEnvironment = useEnvironmentStore((s) => s.selectEnvironment)
  const catalog = useIndicators()
  const env = environments.find((e) => e.id === envId)
  const name = (id: string) =>
    (catalog.state === 'ready' ? catalog.data.find((i) => i.id === id)?.name : undefined) ?? id

  return (
    <section
      aria-label="Entorno activo"
      className="rounded-xl border border-env-border bg-env-surface p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Entorno activo</h2>
        <label className="text-sm">
          <span className="block text-env-muted">
            Cambiar a (cambia tema, textos y datos de toda la app)
          </span>
          <select
            value={envId ?? ''}
            onChange={(e) => {
              const next = environments.find((x) => x.id === e.target.value)
              if (next) selectEnvironment(next)
            }}
            className="mt-1 rounded-md border border-env-border bg-env-bg px-2 py-1.5 text-env-text"
          >
            <option value="" disabled>
              Elige un entorno…
            </option>
            {environments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!env ? (
        <p className="mt-3 text-env-muted">Elige un entorno para ver su configuración.</p>
      ) : (
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-env-muted">Tipo</dt>
            <dd>{formatKind(env.kind)}</dd>
            <dt className="text-env-muted">Gravedad</dt>
            <dd>{formatGravity(env.gravity_g)}</dd>
            <dt className="text-env-muted">Retardo</dt>
            <dd>{formatDelay(env.comm_delay_s)}</dd>
            <dt className="text-env-muted">Radiación</dt>
            <dd>{env.radiation_level}</dd>
            {env.mission && (
              <>
                <dt className="text-env-muted">Misión</dt>
                <dd>
                  {env.mission.start} → {env.mission.end}
                </dd>
              </>
            )}
          </dl>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-env-muted">Escalera</dt>
            <dd>{env.escalation_ladder.map((r) => roleLabel(r, env.vocabulary)).join(' → ')}</dd>
            <dt className="text-env-muted">Liveness</dt>
            <dd>
              stale {formatDuration(env.liveness.stale_after_s)} · lost{' '}
              {formatDuration(env.liveness.lost_after_s)} · EVA{' '}
              {formatDuration(env.liveness.eva_stale_after_s)} · R U OK?{' '}
              {formatDuration(env.liveness.ruok_timeout_s)}
            </dd>
            <dt className="text-env-muted">Vocabulario</dt>
            <dd>
              {Object.entries(env.vocabulary)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' · ')}
            </dd>
          </dl>
          <div className="space-y-2">
            <p>
              <span className="text-env-muted">Indicadores activos:</span>{' '}
              {env.indicators.map(name).join(', ')}
            </p>
            {env.threshold_overrides && Object.keys(env.threshold_overrides).length > 0 && (
              <div>
                <p className="text-env-muted">Umbrales ajustados al entorno:</p>
                <ul className="mt-1 list-disc pl-5">
                  {Object.entries(env.threshold_overrides).map(([ind, r]) => (
                    <li key={ind}>
                      {name(ind)}:{' '}
                      {Object.entries(r)
                        .filter(([, v]) => v != null)
                        .map(([k, v]) => `${k} ${Array.isArray(v) ? v.join('–') : v}`)
                        .join(' · ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {env.routine && env.routine.length > 0 && (
              <p>
                <span className="text-env-muted">Rutina:</span>{' '}
                {env.routine
                  .map((t) => `${t.task_type} ×${t.times_per_day} (${t.points} pts)`)
                  .join(', ')}
              </p>
            )}
            <p className="text-xs text-env-muted">
              Solo lectura: los perfiles se editan en backend/app/data/environments.json.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
