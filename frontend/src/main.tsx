import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { configureApi } from './api/client'
import { initMockModeFromUrl } from './api/mocks/mode'
import { initSession } from './auth/session'
import { initTheme } from './environments/applyTheme'
import { getDb } from './offline/db'
import { getDevice } from './offline/device'
import { initOutbox } from './offline/outbox'
import './styles/index.css'

// ?mocks=1 activa el modo demo sin servidor (se recuerda); ?mocks=0 lo desactiva.
initMockModeFromUrl()
// Identidad del dispositivo/pestaña (?device=<nombre>): va en X-Device-Id de cada petición
// y decide la base IndexedDB `ruok-<device_id>` (FE-30).
configureApi({ getDeviceId: () => getDevice().id })
// IndexedDB puede no existir (p. ej. modo privado): la app sigue, sin outbox ni caché local.
getDb().catch((err) => console.warn('IndexedDB no disponible:', err))
// Outbox offline: reenvía lo pendiente al arrancar, con `online` y cada 5 s (FE-11).
initOutbox().catch((err) => console.warn('Outbox no disponible:', err))
// Sesión guardada en kv.auth + token y 401 en el cliente (FE-27).
initSession().catch((err) => console.warn('Sesión guardada no disponible:', err))
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
