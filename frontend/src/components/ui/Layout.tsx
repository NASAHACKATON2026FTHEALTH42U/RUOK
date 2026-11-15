import { motion, useReducedMotion } from 'framer-motion'
import { Fragment } from 'react'
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
import { UserIdentity } from '../auth/UserIdentity'
import { RuokMark } from './RuokLogo'
import { SessionMenu } from '../auth/SessionMenu'
import { LivenessGuard, MemberActivitySelector } from '../liveness/LivenessGuard'
import { HudClock } from './HudClock'
import { LinkStatusChip } from './LinkStatusChip'
import { ScopeSelector } from './ScopeSelector'
import { MockBanner } from './MockBanner'
import { NavIcon } from './NavIcon'
import { allowedItems, menuFor, navItems, OPERATOR_FILL_ROUTES, tabsFor } from './navigation'
import { PendingSyncChip } from './PendingSyncChip'
import { ServerStatus } from './ServerStatus'
import { TOPBAR_SLOT_ID } from './TopBarPortal'

/**
 * Estructura de la app con el estilo HUD (docs/design/hud-style.md §6).
 * - **Móvil:** cabecera (R U OK, reloj y `SOS`), contenido y 4 pestañas abajo según el
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
  // Páginas que ocupan justo el alto disponible y reparten el espacio por dentro, sin scroll
  // de página (misiones, La Tierra).
  const fill = ['/dashboard', '/missions', '/meditation', '/home', '/alerts', '/members'].some(
    (p) => pathname.startsWith(p),
  )
  const reducedMotion = useReducedMotion()
  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const env = envs.state === 'ready' ? envs.data.find((e) => e.id === envId) : undefined

  // Solo las vistas que permite el rol (FE-28, src/auth/permissions.ts).
  // Menú del rol (el operador tiene el suyo: gestión y monitorización).
  const allowed = menuFor(role, allowedItems(navItems(vocab), can))
  const tabs = tabsFor(role, allowed)
  // Vistas que ocupan el alto disponible (el scroll es de sus paneles, no de la página).
  const fillPage = fill || OPERATOR_FILL_ROUTES.includes(pathname)

  // Logo de las maquetas HUD (emblema de anillos y "R U OK?"); lleva a la vista inicial del rol.
  const logo = (
    <NavLink
      to={role ? homeFor(role) : '/'}
      className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-env-primary"
      aria-label="R U OK?: inicio"
    >
      <RuokMark />
    </NavLink>
  )

  return (
    <div className="flex h-dvh flex-col">
      <MockBanner />

      {/* Cabecera móvil: logo y reloj. El SOS va en la barra inferior, al alcance del pulgar. */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hud-line px-[18px] pt-3.5 pb-3 md:hidden">
        {logo}
        <HudClock env={env} />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Barra lateral de escritorio */}
        <aside
          aria-label="Menú principal"
          // En pantallas bajas (≤ 800 px de alto), menos aire para que quepa todo sin scroll.
          className="hidden w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-hud-line px-3 py-4 lg:w-64 lg:px-4 [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden [@media(max-height:800px)]:gap-2 [@media(max-height:800px)]:py-3"
        >
          {/* SOS: lo primero del menú, arriba a la izquierda y siempre a la vista. */}
          {role === 'admin' ? (
            // El operador es control: en vez del SOS, una placa (sin función) que lo recuerda.
            // En el móvil no hay nada en su lugar (el SOS de la barra inferior no sale).
            <p className="sos-font hud-btn pointer-events-none mb-3 !h-16 w-full shrink-0 border-env-primary/70 bg-env-primary/10 !text-xl !font-semibold !tracking-[0.3em] text-env-primary [@media(max-height:800px)]:mb-4 [@media(max-height:800px)]:!h-14">
              Control
            </p>
          ) : (
            <SosButton variant="sidebar" />
          )}
          {/* Ámbito (entorno y member): el único sitio donde se eligen, para todas las vistas. */}
          <ScopeSelector />

          <nav aria-label="Secciones" className="hud-panel">
            <ul>
              {allowed.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      `hud-row !min-h-10 !text-sm [@media(max-height:800px)]:!min-h-9 ${isActive ? 'is-active' : 'hover:text-env-text'}`
                    }
                  >
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
            {/* Enlace y servidor: solo si hay algo que avisar (retardo, sin enlace, sin conexión). */}
            <LinkStatusChip quiet />
            <PendingSyncChip />
            <ServerStatus quiet />
            {/* Aviso siempre visible en escritorio; en móvil va en «Más» y en el login. */}
            <p className="mt-2 text-[0.75rem] leading-snug text-env-muted">
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

        {/* La cuadrícula de fondo va en toda la columna (barra superior + contenido), para que
            no se corte a la altura de la cabecera. */}
        <div className="bg-grid flex min-w-0 flex-1 flex-col">
          {/* Barra superior de escritorio, con el estilo de la de fase de misión: identidad,
              usuario y el resumen de la página (TopBarPortal: estado general, avisos…) a la
              izquierda; reloj y «Salir» pegados a la derecha. El SOS va arriba del menú
              lateral. */}
          <div className="hidden shrink-0 px-4 pt-4 md:block lg:px-6">
            <div
              className={`mx-auto flex w-full flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-env-border bg-env-surface px-5 py-3.5 lg:gap-x-8 lg:px-7 max-w-[1800px]`}
            >
              {logo}
              <span aria-hidden="true" className="h-8 w-px shrink-0 bg-env-border" />
              {/* Quién ha entrado: nombre y su papel con las palabras del entorno. */}
              <UserIdentity />
              <div
                id={TOPBAR_SLOT_ID}
                // Por debajo de lg no cabe todo en una línea: el resumen de la página baja a una
                // segunda línea (y no ocupa nada si está vacío) en vez de solaparse con el reloj.
                className="flex flex-wrap items-center gap-2 max-lg:order-last max-lg:basis-full max-lg:empty:hidden lg:flex-1"
              />
              <div className="max-lg:ml-auto">
                <HudClock env={env} />
              </div>
              <SessionMenu part="logout" />
            </div>
          </div>

          {/* Contenido. En móvil, cada pantalla debería caber sin scroll (hud-style.md §5). */}
          <main className="min-w-0 flex-1 overflow-x-clip overflow-y-auto [scrollbar-color:var(--env-border)_transparent]">
            <div
              className={`mx-auto w-full px-3.5 py-3.5 md:px-4 md:py-4 lg:px-6 lg:py-6 max-w-[1800px] ${fillPage ? 'flex h-full flex-col' : 'flex min-h-full flex-col'}`}
            >
              {/* Fundido corto al cambiar de página (FE-26). Solo opacidad: un transform crearía un
                bloque contenedor y descolocaría las modales `fixed` de las páginas. */}
              <motion.div
                key={pathname}
                className={fillPage ? 'flex min-h-0 flex-1 flex-col' : 'flex flex-1 flex-col'}
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

      {/* Pestañas móviles: 3 del rol + «Más», con el SOS en el centro */}
      <nav aria-label="Principal" className="hud-tabs shrink-0 md:hidden">
        {tabs.map((t, i) => (
          <Fragment key={t.to}>
            {/* SOS en el centro de la barra (entre la 2.ª y la 3.ª pestaña) */}
            {i === Math.floor(tabs.length / 2) && <SosButton variant="tab" />}
            <NavLink
              to={t.to}
              end
              className="hud-tab focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary"
            >
              <NavIcon name={t.icon} />
              {t.to === '/members' ? t.label.slice(0, 11) : t.label}
            </NavLink>
          </Fragment>
        ))}
      </nav>

      <LivenessGuard />
      <RealtimeConnector />
      <LiveAlertToast />
    </div>
  )
}
