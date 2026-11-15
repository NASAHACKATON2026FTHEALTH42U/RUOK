import { withCatalogCache } from '../offline/cache'
import { api, unwrap } from './client'
import { useLoad } from './useLoad'
import { currentLang } from '../i18n/lang'

const getInterventions = () => unwrap(api.GET('/api/v1/interventions'))
export type Intervention = Awaited<ReturnType<typeof getInterventions>>[number]

// Una sola petición compartida; se guarda en IndexedDB para tenerlas sin conexión (SOS offline).
let cache: Promise<Intervention[]> | null = null
// El catálogo llega en el idioma de la interfaz (FE-38): al cambiarlo, se vuelve a pedir.
let cacheLang = currentLang()

/** Catálogo de intervenciones (`GET /interventions`), con caché offline. */
export function useInterventions() {
  return useLoad(() => {
    if (cacheLang !== currentLang()) {
      cache = null
      cacheLang = currentLang()
    }
    cache ??= withCatalogCache('interventions', getInterventions)().catch((err: unknown) => {
      cache = null
      throw err
    })
    return cache
  }, [])
}
