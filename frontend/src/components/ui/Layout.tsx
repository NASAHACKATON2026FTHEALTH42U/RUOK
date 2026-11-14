import { NavLink, Outlet } from 'react-router-dom'
import { ROUTE_PERMISSIONS } from '../../auth/permissions'
import { homeFor } from '../../auth/roles'
import { useAuth } from '../../auth/useAuth'
import { capitalize, useVocab } from '../../environments/useVocab'
import { EnvironmentSelector } from './EnvironmentSelector'
import { MockBanner } from './MockBanner'
import { SessionMenu } from '../auth/SessionMenu'
import { LinkStatusChip } from './LinkStatusChip'
import { PendingSyncChip } from './PendingSyncChip'
import { ServerStatus } from './ServerStatus'
import { getDevice } from '../../offline/device'
import { SosButton } from '../alerts/SosButton'

const NAV_ITEMS = [
  { to: '/', label: 'Entornos' },
  { to: '/members', label: '' }, // etiqueta con el vocabulario (tripulación, planta…)
  { to: '/dashboard', label: 'Panel' },
  { to: '/measure', label: 'Medir' },
  { to: '/checkin', label: 'Check-in' },
  { to: '/history', label: 'Historial' },
  { to: '/missions', label: 'Misiones' },
  { to: '/alerts', label: 'Alertas' },
]

export function Layout() {
  const device = getDevice()
  const { ground, crew } = useVocab()
  const { role, can } = useAuth()
  // Solo las vistas que permite el rol (FE-28, src/auth/permissions.ts).
  const navItems = [...NAV_ITEMS, { to: '/ground', label: `Consola de ${ground}` }]
    .map((i) => (i.to === '/members' ? { ...i, label: capitalize(crew) } : i))
    .filter((i) => can(ROUTE_PERMISSIONS[i.to]))

  return (
    <div className="flex min-h-full flex-col">
      <MockBanner />
      <header className="border-b border-env-border bg-env-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to={role ? homeFor(role) : '/'} className="text-lg font-bold tracking-tight">
            R U OK<span className="text-env-primary">?</span>
          </NavLink>
          <div className="flex items-center gap-3">
            <LinkStatusChip />
            <PendingSyncChip />
            <SessionMenu />
            <ServerStatus />
            {can('action:change-environment') && <EnvironmentSelector />}
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2 text-sm">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `block whitespace-nowrap rounded-md px-3 py-1.5 ${
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
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-env-border px-4 pt-3 pb-20 text-center text-xs text-env-muted">
        Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni sustituye el
        criterio de un profesional sanitario.
        {device.mode === 'tab' && (
          <span className="mt-1 block" title={device.id}>
            Dispositivo: {device.name ?? `pestaña ${device.id.slice(0, 8)}`}
          </span>
        )}
      </footer>
      <SosButton />
    </div>
  )
}
