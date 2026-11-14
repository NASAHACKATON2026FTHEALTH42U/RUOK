import { motion, useReducedMotion } from 'framer-motion'
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
import { TOPBAR_SLOT_ID } from './TopBarPortal'

/**
 * Estructura de la app con el estilo HUD (docs/design/hud-style.md §6).
 * - **Móvil:** cabecera (R U OK, nodo, reloj y `SOS`), contenido y 4 pestañas abajo según el
 *   rol (3 + «Más»). Sin cajón: lo secundario está en la pantalla «Más».
 * - **Escritorio (≥ md):** barra superior (identidad, reloj, sesión, resumen de la página y SOS)
 *   y barra lateral con las secciones, estados y controles.
 * `LivenessGuard` (heartbeat y modal "R U OK?"), el SSE y los avisos en vivo se montan UNA vez.
 */
export function Layout() {
  const device = getDevice()
  const vocab = useVocab()
  const { role, can } = useAuth()
  const { pathname } = useLocation()
  const wide = pathname.startsWith('/control')
  const reducedMotion = useReducedMotion()
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
            className="mt-auto flex w-full flex-col items-start gap-1.5 pt-2 text-xs [&_label]:flex-wrap [&_select]:max-w-full"
          >
            <MemberActivitySelector compact />
            <LinkStatusChip />
            <PendingSyncChip />
            <ServerStatus />
            {can('action:change-environment') && <EnvironmentSelector />}
            {/* Aviso siempre visible en escritorio; en móvil va en «Más» y en el login. */}
            <p className="mt-2 text-[11px] leading-snug text-env-muted">
              Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni sustituye
              el criterio de un profesional sanitario.
              {device.mode === 'tab' && (
                <span className="mt-1 block" title={device.id}>
                  Dispositivo: {device.name ?? `pestaña ${device.id.slice(0, 8)}`}
                </span>
              )}
            </p>
          </section>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra superior de escritorio, con el estilo de la de fase de misión: identidad, reloj,
              sesión, el resumen de la página (TopBarPortal: estado general, avisos…) y SOS. Fuera
              del área con scroll, para que el SOS esté siempre a la vista. */}
          <div className="hidden shrink-0 px-6 pt-4 md:block">
            <div
              className={`mx-auto flex w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-env-border bg-env-surface px-4 py-2.5 ${wide ? 'max-w-[1800px]' : 'max-w-6xl'}`}
            >
              <div className="min-w-0">
                {logo}
                <div className="hud-label mt-0.5 truncate text-[9px]">{node}</div>
              </div>
              <HudClock env={env} />
              <SessionMenu />
              <div
                id={TOPBAR_SLOT_ID}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              />
              <SosButton variant="header" />
            </div>
          </div>

          {/* Contenido. En móvil, cada pantalla debería caber sin scroll (hud-style.md §5). */}
          <main className="bg-grid min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-color:var(--env-border)_transparent]">
            <div
              className={`mx-auto w-full px-3.5 py-3.5 md:px-6 md:py-6 ${wide ? 'max-w-[1800px]' : 'max-w-6xl'}`}
            >
              {/* Fundido corto al cambiar de página (FE-26). Solo opacidad: un transform crearía un
                bloque contenedor y descolocaría las modales `fixed` de las páginas. */}
              <motion.div
                key={pathname}
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </div>
          </main>
        </div>
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
