import { useControlOverview } from '../../api/useControl'
import { ControlHeader, ControlPanel } from '../../components/control/ControlHeader'
import { EnvironmentConfig } from '../../components/control/EnvironmentConfig'
import { MeasurementInjector } from '../../components/control/MeasurementInjector'
import { OperatorMessageForm } from '../../components/control/OperatorMessageForm'
import { scenariosFor } from '../../components/control/simulate'
import {
  ClockPanel,
  LinkPanel,
  LivenessPanel,
  ScenarioPanel,
} from '../../components/control/SimulationControls'
import { useControlScope } from '../../components/control/useControlScope'
import { useVocab } from '../../environments/useVocab'

/**
 * Simulación (FE-32): el banco de pruebas del operador para el entorno activo y, si se elige, un
 * member. Alertas y notificaciones, mediciones provocadas, escenarios guionizados, enlace,
 * vigilancia de contacto y reloj. Todo llega al momento a los móviles conectados.
 */
export default function ControlSimulate() {
  const { envId, env, recipients, memberId, memberName } = useControlScope()
  const vocab = useVocab()
  const overview = useControlOverview(envId)
  const envOv = overview.state === 'ready' ? overview.data.environments[0] : undefined
  const scope = `${envId}-${memberId ?? 'all'}`

  return (
    <section className="flex flex-col gap-4">
      <ControlHeader
        title="Simulación"
        subtitle={`Provoca situaciones en ${env?.name ?? 'el entorno'}${
          memberId !== null ? ` para ${memberName(memberId)}` : ''
        }: llegan al momento a los móviles y tablets conectados.`}
        memberScope
      />
      {!env ? (
        <p className="text-env-muted">Elige un entorno para simular.</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <ControlPanel title="Alerta o notificación">
            <OperatorMessageForm
              key={scope}
              recipients={recipients}
              memberId={memberId}
              ladder={env.escalation_ladder}
              vocabulary={env.vocabulary}
            />
          </ControlPanel>
          <div className="flex flex-col gap-4">
            <ControlPanel title="Provocar una medición">
              <MeasurementInjector
                key={scope}
                env={env}
                recipients={recipients}
                memberId={memberId}
              />
            </ControlPanel>
            <ScenarioPanel
              scenarios={scenariosFor(envId, memberId)}
              memberName={memberName}
              onChanged={overview.refresh}
            />
          </div>
          {envOv && (
            <LinkPanel env={envOv} groundLabel={vocab.ground} onChanged={overview.refresh} />
          )}
          <div className="flex flex-col gap-4">
            {envOv && <LivenessPanel env={envOv} onChanged={overview.refresh} />}
            <ClockPanel onChanged={overview.refresh} />
          </div>
          <div className="xl:col-span-2">
            <EnvironmentConfig env={env} />
          </div>
        </div>
      )}
    </section>
  )
}
