import { isShowcase, setMockMode } from '../../api/mocks/mode'
import { useMockStatus } from '../../api/mocks/useMockStatus'
import { useT } from '../../i18n/t'

/**
 * Banner obligatorio cuando se muestran datos de ejemplo: NUNCA deben confundirse con datos
 * reales de un member (principio "sin datos = desconocido"). Única excepción: el escaparate
 * público (`VITE_SHOWCASE`), donde toda la web es una demo.
 */
export function MockBanner() {
  const t = useT()
  const status = useMockStatus()
  if (status === 'real') return null
  // Escaparate público: el modo demo no lleva banner (sigue el chip «Modo demo» de la barra
  // lateral y de «Más»). El aviso de servidor sin conexión se pinta siempre.
  if (status === 'mock' && isShowcase()) return null

  return (
    <div
      role="alert"
      className="bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-slate-950"
    >
      {status === 'mock'
        ? t('DATOS DE EJEMPLO · modo demo sin servidor')
        : t(
            'SERVIDOR SIN CONEXIÓN · mostrando datos de ejemplo (solo lectura; lo que registres se guarda para enviarlo)',
          )}
      {status === 'mock' && (
        <button
          type="button"
          onClick={() => setMockMode(false)}
          className="ml-3 rounded bg-slate-950/15 px-2 py-0.5 text-xs underline-offset-2 hover:underline"
        >
          {t('Salir del modo demo')}
        </button>
      )}
    </div>
  )
}
