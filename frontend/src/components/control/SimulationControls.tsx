import { useState } from 'react'
import { ApiError, NetworkError, type Schema } from '../../api/client'
import type { EnvironmentOverview } from '../../api/useControl'
import { useT } from '../../i18n/t'
import {
  demoFastForward,
  demoLink,
  demoReset,
  demoScenario,
  pauseLiveness,
} from '../../offline/outbox'
import { describeLink } from '../ui/link'
import { ControlPanel } from './ControlHeader'
import { formatDuration } from './feed'
import { Segmented } from './OperatorMessageForm'
import type { Scenario } from './simulate'
import { Icon } from '../ui/Icon'

const FAST_FORWARD: number[] = [60, 300, 900, 3600]
const LINK_STATES: { id: Schema<'LinkState'>; label: string }[] = [
  { id: 'online', label: 'En línea' },
  { id: 'delayed', label: 'Con retardo' },
  { id: 'los', label: 'Sin enlace (LOS)' },
]
const BTN =
  'min-h-9 border border-env-border px-3 text-sm hover:border-env-text disabled:opacity-50'

/** Ejecuta una acción de simulación y deja una línea de resultado. */
function useSimulationRun(onChanged: () => void) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string | null>(null)
  const run = async (label: string, fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    try {
      await fn()
      setLog(`✓ ${label}`)
      onChanged()
    } catch (err) {
      setLog(
        `⚠ ${label}: ${
          err instanceof NetworkError
            ? t('sin conexión con el servidor')
            : err instanceof ApiError
              ? err.message
              : String(err)
        }`,
      )
    } finally {
      setBusy(false)
    }
  }
  return { busy, log, run }
}

/** Escenarios guionizados del entorno (y del member elegido). */
export function ScenarioPanel({
  scenarios,
  memberName,
  onChanged,
  className,
}: {
  scenarios: Scenario[]
  memberName: (id: number) => string
  onChanged: () => void
  className?: string
}) {
  const t = useT()
  const { busy, log, run } = useSimulationRun(onChanged)
  return (
    <ControlPanel title={t('Escenarios')} aside={log} className={className}>
      {scenarios.length === 0 ? (
        <p className="text-sm text-env-muted">
          {t(
            'No hay escenarios guionizados para esta selección. Provoca la situación con una medición, una alerta o el estado del enlace.',
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {scenarios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {t(s.label)} <span className="text-env-muted">· {memberName(s.memberId)}</span>
                </p>
                <p className="text-sm text-env-muted">{t(s.detail)}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                className={BTN}
                onClick={() =>
                  run(t('Escenario «{name}» cargado', { name: t(s.label) }), () =>
                    demoScenario(s.id),
                  )
                }
              >
                <Icon name="play" size={14} className="mr-1" />
                {t('Lanzar')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ControlPanel>
  )
}

/** Enlace con el nivel externo del entorno: en línea, con retardo o sin enlace. */
export function LinkPanel({
  env,
  groundLabel,
  onChanged,
  className,
}: {
  env: EnvironmentOverview
  groundLabel: string
  onChanged: () => void
  className?: string
}) {
  const t = useT()
  const { busy, log, run } = useSimulationRun(onChanged)
  const link = describeLink(env.link)
  const linkStates = LINK_STATES.map((l) => ({ id: l.id, label: t(l.label) }))
  return (
    <ControlPanel
      title={t('Enlace con {ground}', { ground: groundLabel })}
      aside={log}
      className={className}
    >
      <p className="mb-3 text-sm">
        {t('Ahora:')}{' '}
        <span title={link.long}>
          {link.icon} {link.short}
        </span>
        {env.link.queued > 0 && (
          <span className="text-env-muted">
            {' '}
            · {t('{n} mensajes en cola', { n: env.link.queued })}
          </span>
        )}
      </p>
      <fieldset disabled={busy}>
        <Segmented
          label={t('Estado del enlace con {ground}', { ground: groundLabel })}
          value={env.link.state}
          options={linkStates}
          onChange={(state) =>
            run(
              t('Enlace → {state}', {
                state: linkStates.find((l) => l.id === state)?.label ?? state,
              }),
              () => demoLink(env.environment.id, state),
            )
          }
        />
      </fieldset>
      <p className="mt-3 text-xs text-env-muted">
        {t(
          'Lo que va a {ground} espera en la cola mientras no hay enlace y llega con el retardo del entorno.',
          { ground: groundLabel },
        )}
      </p>
    </ControlPanel>
  )
}

/** Vigilancia de contacto («R U OK?» y alertas de sin contacto) del entorno. */
export function LivenessPanel({
  env,
  onChanged,
  className,
}: {
  env: EnvironmentOverview
  onChanged: () => void
  className?: string
}) {
  const t = useT()
  const { busy, log, run } = useSimulationRun(onChanged)
  return (
    <ControlPanel title={t('Vigilancia de contacto')} aside={log} className={className}>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          disabled={busy}
          checked={env.liveness_paused}
          onChange={(e) =>
            run(e.target.checked ? t('Vigilancia en pausa') : t('Vigilancia reanudada'), () =>
              pauseLiveness(env.environment.id, e.target.checked),
            )
          }
        />
        <span>
          {t('Pausar los «R U OK?» y las alertas de sin contacto')}
          <span className="block text-env-muted">
            {t('Útil durante la presentación. El contacto se sigue calculando y mostrando igual.')}
          </span>
        </span>
      </label>
    </ControlPanel>
  )
}

/** Reloj de la demo y reinicio de los datos. */
export function ClockPanel({
  onChanged,
  className,
}: {
  onChanged: () => void
  className?: string
}) {
  const t = useT()
  const { busy, log, run } = useSimulationRun(onChanged)
  return (
    <ControlPanel title={t('Reloj y datos de la demo')} aside={log} className={className}>
      <p className="hud-label mb-2">{t('Adelantar el reloj')}</p>
      <div className="flex flex-wrap gap-1.5">
        {FAST_FORWARD.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            className={BTN}
            onClick={() =>
              run(t('Reloj adelantado {d}', { d: formatDuration(s) }), () => demoFastForward(s))
            }
          >
            +{formatDuration(s)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-env-muted">
        {t('Afecta a todo el servidor: datos que caducan, tareas del día y falta de contacto.')}
      </p>
      <div className="mt-4 border-t border-env-border/60 pt-4">
        <button
          type="button"
          disabled={busy}
          className="hud-btn hud-btn-danger !h-auto min-h-10 px-4"
          onClick={() =>
            run(
              t('Datos de la demo reiniciados'),
              demoReset,
              t('¿Reiniciar TODOS los datos de la demo (todos los entornos) con el seed inicial?'),
            )
          }
        >
          ↺ {t('Reiniciar los datos de la demo')}
        </button>
      </div>
    </ControlPanel>
  )
}
