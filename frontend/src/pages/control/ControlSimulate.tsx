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
import { useT } from '../../i18n/t'

/**
 * Simulación (FE-32): el banco de pruebas del operador para el entorno activo y, si se elige, un
 * member. Alertas y notificaciones, mediciones provocadas, escenarios guionizados, enlace,
 * vigilancia de contacto y reloj. Todo llega al momento a los móviles conectados.
 */
export default function ControlSimulate() {
  const t = useT()
  const { envId, env, recipients, memberId, memberName } = useControlScope()
  const vocab = useVocab()
  const overview = useControlOverview(envId)
  const envOv = overview.state === 'ready' ? overview.data.environments[0] : undefined
  const scope = `${envId}-${memberId ?? 'all'}`

  return (
    <section className="flex flex-col gap-4">
      <ControlHeader
        title={t('Simulación')}
        subtitle={
          memberId !== null
            ? t(
                'Provoca situaciones en {env} para {member}: llegan al momento a los móviles y tablets conectados.',
                { env: env?.name ?? t('el entorno'), member: memberName(memberId) },
              )
            : t(
                'Provoca situaciones en {env}: llegan al momento a los móviles y tablets conectados.',
                { env: env?.name ?? t('el entorno') },
              )
        }
        memberScope
      />
      {!env ? (
        <p className="text-env-muted">{t('Elige un entorno para simular.')}</p>
      ) : (
        // Tres columnas equilibradas por contenido: a quién (alerta o notificación + vigilancia de
        // contacto) | qué datos (medición + enlace) | el guion de la demo (escenarios + reloj). El
        // último panel de cada columna se estira para que todas acaben a la misma altura. En
        // pantallas medias, dos columnas y el guion en una fila; en móvil, una.
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col gap-4">
            <ControlPanel title={t('Alerta o notificación')}>
              <OperatorMessageForm
                key={scope}
                recipients={recipients}
                memberId={memberId}
                ladder={env.escalation_ladder}
                vocabulary={env.vocabulary}
              />
            </ControlPanel>
            {envOv && <LivenessPanel className="flex-1" env={envOv} onChanged={overview.refresh} />}
          </div>
          <div className="flex flex-col gap-4">
            <ControlPanel title={t('Provocar una medición')}>
              <MeasurementInjector
                key={scope}
                env={env}
                recipients={recipients}
                memberId={memberId}
              />
            </ControlPanel>
            {envOv && (
              <LinkPanel
                className="flex-1"
                env={envOv}
                groundLabel={vocab.ground}
                onChanged={overview.refresh}
              />
            )}
          </div>
          <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:flex xl:flex-col">
            <ScenarioPanel
              scenarios={scenariosFor(envId, memberId)}
              memberName={memberName}
              onChanged={overview.refresh}
            />
            <ClockPanel className="xl:flex-1" onChanged={overview.refresh} />
          </div>
          <div className="lg:col-span-2 xl:col-span-3">
            <EnvironmentConfig env={env} />
          </div>
        </div>
      )}
    </section>
  )
}
