import { setMockMode } from '../../api/mocks/mode'
import { useMockStatus } from '../../api/mocks/useMockStatus'

/**
 * Banner obligatorio cuando se muestran datos de ejemplo: NUNCA deben confundirse con datos
 * reales de un member (principio "sin datos = desconocido").
 */
export function MockBanner() {
  const status = useMockStatus()
  if (status === 'real') return null

  return (
    <div
      role="alert"
      className="bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-slate-950"
    >
      {status === 'mock'
        ? 'DATOS DE EJEMPLO · modo demo sin servidor'
        : 'SERVIDOR SIN CONEXIÓN · mostrando datos de ejemplo (solo lectura; lo que registres se guarda para enviarlo)'}
      {status === 'mock' && (
        <button
          type="button"
          onClick={() => setMockMode(false)}
          className="ml-3 rounded bg-slate-950/15 px-2 py-0.5 text-xs underline-offset-2 hover:underline"
        >
          Salir del modo demo
        </button>
      )}
    </div>
  )
}
