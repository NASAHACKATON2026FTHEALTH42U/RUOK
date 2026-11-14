import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { ROUTE_PERMISSIONS } from '../../auth/permissions'
import { homeFor } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { capitalize, useVocab } from '../../environments/useVocab'
import { getDevice } from '../../offline/device'
import { RealtimeConnector } from '../../realtime/RealtimeConnector'
import { LiveAlertToast } from '../alerts/LiveAlertToast'
import { SosButton } from '../alerts/SosButton'
import { SessionMenu } from '../auth/SessionMenu'
import { LivenessGuard } from '../liveness/LivenessGuard'
import { EnvironmentSelector } from './EnvironmentSelector'
import { LinkStatusChip } from './LinkStatusChip'
import { MockBanner } from './MockBanner'
import { PendingSyncChip } from './PendingSyncChip'
import { ServerStatus } from './ServerStatus'
import { SIDEBAR_SLOT_ID } from './SidebarPortal'

const NAV_ITEMS = [
  { to: '/', label: 'Entornos' },
  { to: '/members', label: '' }, // etiqueta con el vocabulario (tripulación, planta…)
  { to: '/dashboard', label: 'Panel' },
  { to: '/measure', label: 'Medir' },
  { to: '/checkin', label: 'Check-in' },
  { to: '/pvt', label: 'Test PVT' },
  { to: '/earth', label: 'La Tierra' },
  { to: '/history', label: 'Historial' },
  { to: '/missions', label: 'Misiones' },
  { to: '/alerts', label: 'Alertas' },
]

/**
 * Estructura de la app con una barra lateral en columna (logo, usuario, navegación y estados).
 * En escritorio (≥ md) está fija a la izquierda; en móvil es un cajón que se abre con "Menú" y
 * se cierra al navegar, con Esc o tocando fuera. Es UN solo <aside>: lo que monta (heartbeat,
 * modal "R U OK?") existe una vez. Compacta para que quepa sin scroll (12 secciones del admin
 * en 720 px de alto o en un móvil de 375×667); la barra de scroll queda oculta por si acaso.
 */
export function Layout() {
  const device = getDevice()
  const { ground, crew } = useVocab()
  const { role, can } = useAuth()
  const { pathname } = useLocation()
  const wide = pathname.startsWith('/control')
  const [open, setOpen] = useState(false)

  // Solo las vistas que permite el rol (FE-28, src/auth/permissions.ts).
  const navItems = [
    ...NAV_ITEMS,
    { to: '/ground', label: `Consola de ${ground}` },
    { to: '/control', label: 'Centro de control' },
  ]
    .map((i) => (i.to === '/members' ? { ...i, label: capitalize(crew) } : i))
    .filter((i) => can(ROUTE_PERMISSIONS[i.to]))

  // El cajón móvil se cierra al navegar y con Esc.
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const logo = (
    <NavLink to={role ? homeFor(role) : '/'} className="text-lg font-bold tracking-tight">
      R U OK<span className="text-env-primary">?</span>
    </NavLink>
  )

  return (
    <div className="flex min-h-full flex-col">
      <MockBanner />

      {/* Barra superior mínima, solo en móvil */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-env-border bg-env-surface px-4 py-3 md:hidden">
        {logo}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="sidebar"
          className="rounded-md border border-env-border px-3 py-1.5 text-sm hover:border-env-text"
        >
          ☰ Menú
        </button>
      </div>

      <div className="flex flex-1">
        {/* Fondo del cajón móvil (tocar fuera = cerrar) */}
        {open && (
          <button
            type="button"
            aria-label="Cerrar el menú"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
          />
        )}

        <aside
          id="sidebar"
          aria-label="Menú principal"
          className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col gap-3 overflow-y-auto border-r border-env-border bg-env-surface px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between">
            {logo}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar el menú"
              className="rounded-md px-2 py-1 text-env-muted hover:text-env-text md:hidden"
            >
              ✕
            </button>
          </div>

          <SessionMenu />

          {/* Resumen de la página actual (p. ej. estado general del panel), vía SidebarPortal */}
          <div id={SIDEBAR_SLOT_ID} className="empty:hidden" />

          <nav aria-label="Secciones">
            <ul className="flex flex-col gap-0.5 text-sm">
              {navItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-1.5 ${
                        isActive
                          ? 'bg-env-primary text-env-primary-text'
                          : 'text-env-muted hover:bg-env-border/50 hover:text-env-text'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Estados y controles: en columna, al fondo de la barra */}
          <section
            aria-label="Estado"
            className="mt-auto flex flex-col items-start gap-1.5 border-t border-env-border pt-3 text-xs [&_label]:flex-wrap [&_select]:max-w-full"
          >
            <LinkStatusChip />
            <PendingSyncChip />
            <ServerStatus />
            <LivenessGuard />
            {can('action:change-environment') && <EnvironmentSelector />}
          </section>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* El centro de control usa todo el ancho (proyector o pantalla grande). */}
          <main
            className={`mx-auto w-full flex-1 px-4 py-4 ${wide ? 'max-w-[1800px]' : 'max-w-6xl'}`}
          >
            <Outlet />
          </main>

          <footer className="border-t border-env-border px-4 pt-3 pb-20 text-center text-xs text-env-muted">
            Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni sustituye
            el criterio de un profesional sanitario.
            {device.mode === 'tab' && (
              <span className="mt-1 block" title={device.id}>
                Dispositivo: {device.name ?? `pestaña ${device.id.slice(0, 8)}`}
              </span>
            )}
          </footer>
        </div>
      </div>
      <SosButton />
      <RealtimeConnector />
      <LiveAlertToast />
    </div>
  )
}
