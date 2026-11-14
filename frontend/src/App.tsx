import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from './components/ui/Layout'
import Alerts from './pages/Alerts'
import CheckIn from './pages/CheckIn'
import Dashboard from './pages/Dashboard'
import EnvironmentSelect from './pages/EnvironmentSelect'
import Ground from './pages/Ground'
import History from './pages/History'
import Measure from './pages/Measure'
import Missions from './pages/Missions'
import NotFound from './pages/NotFound'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <EnvironmentSelect /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/measure', element: <Measure /> },
      { path: '/checkin', element: <CheckIn /> },
      { path: '/history', element: <History /> },
      { path: '/missions', element: <Missions /> },
      { path: '/alerts', element: <Alerts /> },
      { path: '/ground', element: <Ground /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
