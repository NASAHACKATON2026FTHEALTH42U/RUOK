import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEnvironments } from '../../api/useEnvironments'
import { homeFor } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { useVocab } from '../../environments/useVocab'
import { getDevice } from '../../offline/device'
import { RealtimeConnector } from '../../realtime/RealtimeConnector'
import { useEnvironmentStore } from '../../store/environment'
import { LiveAlertToast } from '../alerts/LiveAlertToast'
import { SosButton } from '../alerts/SosButton'
import { SessionMenu } from '../auth/SessionMenu'
import { LivenessGuard, MemberActivitySelector } from '../liveness/LivenessGuard'
import { EnvironmentSelector } from './EnvironmentSelector'
import { HudClock } from './HudClock'
import { LinkStatusChip } from './LinkStatusChip'
import { MockBanner } from './MockBanner'
import { NavIcon } from './NavIcon'
import { allowedItems, MORE, navItems, tabsFor } from './navigation'
import { PendingSyncChip } from './PendingSyncChip'
import { ServerStatus } from './ServerStatus'

/**
 * Estructura de la app con el estilo HUD (docs/design/hud-style.md §6).
 * - **Móvil:** cabecera (R U OK, nodo, reloj y `SOS`), contenido y 4 pestañas abajo según el
 *   rol (3 + «Más»). Sin cajón: lo secundario está en la pantalla «Más».
 * - **Escritorio (≥ md):** barra lateral con todas las secciones, estados y controles.
 * `LivenessGuard` (heartbeat y modal "R U OK?"), el SSE y los avisos en vivo se montan UNA vez.
 */
export function Layout() {
  const device = getDevice()
  const vocab = useVocab()
  const { role, can } = useAuth()
  const { pathname } = useLocation()
  const wide = pathname.startsWith('/control')
  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined

  // Solo las vistas que permite el rol (FE-28, src/auth/permissions.ts).
  const allowed = allowedItems(navItems(vocab), can)
  const tabs = tabsFor(role, allowed)

  const logo = (
    <NavLink
      to={role ? homeFor(role) : '/'}
      className="font-mono text-[13px] tracking-[0.24em] text-env-text"
      aria-label="R U OK: inicio"
    >
      R U OK
    </NavLink>
  )
  const node = env ? `Nodo.${env.id} / ${env.name}` : 'Sin entorno'

  return (
    <div className="flex h-dvh flex-col">
      <MockBanner />

      {/* Cabecera móvil: logo + nodo, reloj y SOS siempre visible */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hud-line px-[18px] pt-3.5 pb-3 md:hidden">
        <div className="min-w-0">
          {logo}
          <div className="hud-label mt-0.5 truncate text-[9px]">{node}</div>
        </div>
        <div className="flex items-center gap-2.5">
          <HudClock env={env} />
          <SosButton variant="header" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Barra lateral de escritorio */}
        <aside
          aria-label="Menú principal"
          className="hidden w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r border-hud-line px-4 py-4 [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {logo}
              <div className="hud-label mt-0.5 truncate text-[9px]">{node}</div>
            </div>
            <SosButton variant="header" />
          </div>
          <HudClock env={env} />
          <SessionMenu />

          <nav aria-label="Secciones" className="hud-panel">
            <div className="hud-panel-head">
              <b>NAV.01</b>Secciones
            </div>
            <ul>
              {[...allowed, MORE].map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      `hud-row !min-h-10 !text-sm ${isActive ? 'is-active' : 'hover:text-env-text'}`
                    }
                  >
                    <span className="w-8 font-mono text-[10px] text-env-muted">{item.code}</span>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <section
            aria-label="Estado"
            className="mt-auto flex flex-col items-start gap-1.5 pt-2 text-xs [&_label]:flex-wrap [&_select]:max-w-full"
          >
            <MemberActivitySelector />
            <LinkStatusChip />
            <PendingSyncChip />
            <ServerStatus />
            {can('action:change-environment') && <EnvironmentSelector />}
            <p className="mt-2 text-[11px] text-env-muted">
              Prototipo de autoevaluación. <strong>No es un dispositivo médico.</strong>
              {device.mode === 'tab' && (
                <span className="mt-1 block" title={device.id}>
                  Dispositivo: {device.name ?? `pestaña ${device.id.slice(0, 8)}`}
                </span>
              )}
            </p>
          </section>
        </aside>

        {/* Contenido. En móvil, cada pantalla debería caber sin scroll (hud-style.md §5). */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div
            className={`mx-auto w-full px-3.5 py-3.5 md:px-6 md:py-6 ${wide ? 'max-w-[1800px]' : 'max-w-6xl'}`}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Pestañas móviles: 3 del rol + «Más» */}
      <nav aria-label="Principal" className="hud-tabs shrink-0 md:hidden">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            className="hud-tab focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary"
          >
            <NavIcon name={t.icon} />
            {t.to === '/members' ? t.label.slice(0, 11) : t.label}
          </NavLink>
        ))}
      </nav>

      <LivenessGuard />
      <RealtimeConnector />
      <LiveAlertToast />
    </div>
  )
}
