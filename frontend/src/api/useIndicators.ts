import { api, unwrap } from './client'
import { withCatalogCache } from '../offline/cache'
import { useLoad } from './useLoad'
import { currentLang } from '../i18n/lang'

const getIndicators = () => unwrap(api.GET('/api/v1/indicators'))
export type Indicator = Awaited<ReturnType<typeof getIndicators>>[number]

// El catálogo no cambia durante la sesión: una sola petición compartida.
let cache: Promise<Indicator[]> | null = null
// El catálogo llega en el idioma de la interfaz (FE-38): al cambiarlo, se vuelve a pedir.
let cacheLang = currentLang()

/** Catálogo de indicadores (`GET /indicators`): nombre, unidad, rangos, instrucciones… */
export function useIndicators() {
  return useLoad(() => {
    if (cacheLang !== currentLang()) {
      cache = null
      cacheLang = currentLang()
    }
    cache ??= withCatalogCache('indicators', getIndicators)().catch((err: unknown) => {
      cache = null
      throw err
    })
    return cache
  }, [])
}
