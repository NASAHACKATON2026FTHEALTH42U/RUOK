import { NavLink, Outlet } from 'react-router-dom'
import { useVocab } from '../../environments/useVocab'
import { EnvironmentSelector } from './EnvironmentSelector'
import { MockBanner } from './MockBanner'
import { ServerStatus } from './ServerStatus'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Panel' },
  { to: '/measure', label: 'Medir' },
  { to: '/checkin', label: 'Check-in' },
  { to: '/history', label: 'Historial' },
  { to: '/missions', label: 'Misiones' },
  { to: '/alerts', label: 'Alertas' },
]

export function Layout() {
  const { ground } = useVocab()
  const navItems = [...NAV_ITEMS, { to: '/ground', label: `Consola de ${ground}` }]

  return (
    <div className="flex min-h-full flex-col">
      <MockBanner />
      <header className="border-b border-env-border bg-env-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="text-lg font-bold tracking-tight">
            R U OK<span className="text-env-primary">?</span>
          </NavLink>
          <div className="flex items-center gap-3">
            <ServerStatus />
            <EnvironmentSelector />
          </div>
        </div>
        <nav className="mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2 text-sm">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
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

      <footer className="border-t border-env-border px-4 py-3 text-center text-xs text-env-muted">
        Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni sustituye el
        criterio de un profesional sanitario.
      </footer>
    </div>
  )
}
