import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initMockModeFromUrl } from './api/mocks/mode'
import './styles/index.css'

// ?mocks=1 activa el modo demo sin servidor (se recuerda); ?mocks=0 lo desactiva.
initMockModeFromUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
