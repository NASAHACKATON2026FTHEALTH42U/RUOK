import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { configureApi } from './api/client'
import { initMockModeFromUrl } from './api/mocks/mode'
import { initTheme } from './environments/applyTheme'
import { getDb } from './offline/db'
import { getDevice } from './offline/device'
import './styles/index.css'

// ?mocks=1 activa el modo demo sin servidor (se recuerda); ?mocks=0 lo desactiva.
initMockModeFromUrl()
// Identidad del dispositivo/pestaña (?device=<nombre>): va en X-Device-Id de cada petición
// y decide la base IndexedDB `ruok-<device_id>` (FE-30).
configureApi({ getDeviceId: () => getDevice().id })
void getDb()
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
