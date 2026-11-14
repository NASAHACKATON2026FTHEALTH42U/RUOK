import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { SessionMenu } from '../components/auth/SessionMenu'
import { MemberActivitySelector } from '../components/liveness/LivenessGuard'
import { EnvironmentSelector } from '../components/ui/EnvironmentSelector'
import { LinkStatusChip } from '../components/ui/LinkStatusChip'
import { ChevronIcon } from '../components/ui/NavIcon'
import { allowedItems, navItems, tabsFor } from '../components/ui/navigation'
import { PendingSyncChip } from '../components/ui/PendingSyncChip'
import { ServerStatus } from '../components/ui/ServerStatus'
import { useVocab } from '../environments/useVocab'
import { getDevice } from '../offline/device'

/**
 * «Más» (maqueta `More`): las secciones que no están en las pestañas del rol, la actividad
 * (Normal / EVA / Sueño), el estado de la conexión y la sesión. En móvil sustituye al cajón.
 */
export default function More() {
  const vocab = useVocab()
  const { role, can } = useAuth()
  const device = getDevice()
  const allowed = allowedItems(navItems(vocab), can)
  const inTabs = new Set(tabsFor(role, allowed).map((t) => t.to))
  const rest = allowed.filter((i) => !inTabs.has(i.to))

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3">
      <header className="flex items-end justify-between gap-3">
        <h1 className="text-[22px] font-light">Más</h1>
        <SessionMenu />
      </header>

      {rest.length > 0 && (
        <nav aria-label="Secciones" className="hud-panel">
          <ul>
            {rest.map((item, i) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`hud-row !min-h-[46px] hover:text-env-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary ${
                    i === rest.length - 1 ? '!border-b-0' : ''
                  }`}
                >
                  <span className="w-[34px] font-mono text-[11px] text-env-muted">{item.code}</span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <MemberActivitySelector />

      <section aria-label="Estado del dispositivo" className="hud-panel">
        <div className="hud-panel-head">
          <b>NET.02</b>Conexión
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 text-xs">
          <ServerStatus />
          <LinkStatusChip />
          <PendingSyncChip />
        </div>
        {can('action:change-environment') && (
          <div className="border-t border-hud-row px-3.5 py-3 text-sm">
            <EnvironmentSelector />
          </div>
        )}
      </section>

      <p className="px-1 text-center text-xs text-env-muted">
        Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni sustituye el
        criterio de un profesional sanitario.
        {device.mode === 'tab' && (
          <span className="mt-1 block" title={device.id}>
            Dispositivo: {device.name ?? `pestaña ${device.id.slice(0, 8)}`}
          </span>
        )}
      </p>
    </section>
  )
}
