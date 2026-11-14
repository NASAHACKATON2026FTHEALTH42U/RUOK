import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { RequireSession } from './components/auth/RequireSession'
import { Layout } from './components/ui/Layout'
import Alerts from './pages/Alerts'
import CheckIn from './pages/CheckIn'
import Dashboard from './pages/Dashboard'
import EnvironmentSelect from './pages/EnvironmentSelect'
import Ground from './pages/Ground'
import History from './pages/History'
import Login from './pages/Login'
import Measure from './pages/Measure'
import Members from './pages/Members'
import Missions from './pages/Missions'
import NotFound from './pages/NotFound'
import Pvt from './pages/Pvt'

const router = createBrowserRouter([
  // El login va fuera del Layout, pero con su propio botón "Pedir ayuda" (FE-27).
  { path: '/login', element: <Login /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <EnvironmentSelect /> },
          { path: '/members', element: <Members /> },
          { path: '/dashboard', element: <Dashboard /> },
          { path: '/measure', element: <Measure /> },
          { path: '/checkin', element: <CheckIn /> },
          { path: '/pvt', element: <Pvt /> },
          { path: '/history', element: <History /> },
          { path: '/missions', element: <Missions /> },
          { path: '/alerts', element: <Alerts /> },
          { path: '/ground', element: <Ground /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
