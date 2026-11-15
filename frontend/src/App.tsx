import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ROUTE_PERMISSIONS } from './auth/permissions'
import { RequireRole } from './components/auth/RequireRole'
import { RequireSession } from './components/auth/RequireSession'
import { Layout } from './components/ui/Layout'
import Alerts from './pages/Alerts'
import ControlDevices from './pages/control/ControlDevices'
import ControlLog from './pages/control/ControlLog'
import ControlOverview from './pages/control/ControlOverview'
import ControlSimulate from './pages/control/ControlSimulate'
import ControlUsers from './pages/control/ControlUsers'
import CheckIn from './pages/CheckIn'
import Dashboard from './pages/Dashboard'
import EnvironmentSelect from './pages/EnvironmentSelect'
import Ground from './pages/Ground'
import History from './pages/History'
import HomeMessages from './pages/HomeMessages'
import Login from './pages/Login'
import Measure from './pages/Measure'
import Meditation from './pages/Meditation'
import Members from './pages/Members'
import Missions from './pages/Missions'
import More from './pages/More'
import NotFound from './pages/NotFound'
import Pvt from './pages/Pvt'
import Settings from './pages/Settings'
import { LanguageSync } from './i18n/LanguageSync'
import { useLangStore } from './i18n/lang'

/** Envuelve la página con el permiso de vista de su ruta (FE-28). */
function guard(path: string, page: ReactNode) {
  const permission = ROUTE_PERMISSIONS[path]
  return permission ? <RequireRole permission={permission}>{page}</RequireRole> : page
}

const router = createBrowserRouter([
  // El login va fuera del Layout, pero con su propio botón SOS (FE-27).
  { path: '/login', element: <Login /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: guard('/', <EnvironmentSelect />) },
          { path: '/members', element: guard('/members', <Members />) },
          { path: '/dashboard', element: guard('/dashboard', <Dashboard />) },
          { path: '/measure', element: guard('/measure', <Measure />) },
          { path: '/checkin', element: guard('/checkin', <CheckIn />) },
          { path: '/pvt', element: guard('/pvt', <Pvt />) },
          { path: '/meditation', element: guard('/meditation', <Meditation />) },
          // La antigua galería «La Tierra» (FE-25) es ahora Meditación (FE-36).
          { path: '/earth', element: <Navigate to="/meditation" replace /> },
          { path: '/home', element: guard('/home', <HomeMessages />) },
          { path: '/history', element: guard('/history', <History />) },
          { path: '/missions', element: guard('/missions', <Missions />) },
          { path: '/alerts', element: guard('/alerts', <Alerts />) },
          { path: '/ground', element: guard('/ground', <Ground />) },
          { path: '/control', element: guard('/control', <ControlOverview />) },
          { path: '/control/simulate', element: guard('/control/simulate', <ControlSimulate />) },
          { path: '/control/users', element: guard('/control/users', <ControlUsers />) },
          { path: '/control/devices', element: guard('/control/devices', <ControlDevices />) },
          { path: '/control/log', element: guard('/control/log', <ControlLog />) },
          // «Más» (estilo HUD): cualquier rol con sesión.
          { path: '/more', element: <More /> },
          // Ajustes del dispositivo (idioma, voz guía): cualquier rol con sesión.
          { path: '/settings', element: <Settings /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  // Al cambiar de idioma se vuelve a montar todo: textos, formateadores y datos del servidor
  // (que llegan en el idioma nuevo por `Accept-Language`).
  const lang = useLangStore((s) => s.lang)
  return (
    <>
      <LanguageSync />
      <RouterProvider key={lang} router={router} />
    </>
  )
}
