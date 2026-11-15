import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { ROUTE_PERMISSIONS } from './auth/permissions'
import { RequireRole } from './components/auth/RequireRole'
import { RequireSession } from './components/auth/RequireSession'
import { Layout } from './components/ui/Layout'
import Alerts from './pages/Alerts'
import Control from './pages/Control'
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
          { path: '/control', element: guard('/control', <Control />) },
          { path: '/control/users', element: guard('/control/users', <Control />) },
          // «Más» (estilo HUD): cualquier rol con sesión.
          { path: '/more', element: <More /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
