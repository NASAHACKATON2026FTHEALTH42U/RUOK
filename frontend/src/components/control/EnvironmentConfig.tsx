import type { Environment } from '../../api/useEnvironments'
import { useIndicators } from '../../api/useIndicators'
import { roleLabel } from '../alerts/sos'
import { formatDelay, formatGravity, formatKind } from '../../environments/format'
import { ControlPanel } from './ControlHeader'
import { formatDuration } from './feed'

/**
 * Parámetros del entorno activo, de solo lectura (FE-32): explican lo que pasa al simular
 * (retardo, escalera, plazos de contacto, umbrales). La edición de umbrales es P2: los perfiles
 * viven en backend/app/data/environments.json ("configuración, no código").
 */
export function EnvironmentConfig({ env }: { env: Environment | undefined }) {
  const catalog = useIndicators()
  const name = (id: string) =>
    (catalog.state === 'ready' ? catalog.data.find((i) => i.id === id)?.name : undefined) ?? id

  return (
    <ControlPanel title="Parámetros del entorno" aria-label="Parámetros del entorno">
      {!env ? (
        <p className="text-env-muted">Elige un entorno para ver su configuración.</p>
      ) : (
        <div className="grid gap-x-6 gap-y-4 text-sm md:grid-cols-2 xl:grid-cols-3">
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
    </ControlPanel>
  )
}
