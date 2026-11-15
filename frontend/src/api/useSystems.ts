import { api, unwrap } from './client'
import { withCatalogCache } from '../offline/cache'
import { useLoad } from './useLoad'
import { currentLang } from '../i18n/lang'

const getSystems = () => unwrap(api.GET('/api/v1/systems'))
export type BodySystem = Awaited<ReturnType<typeof getSystems>>[number]

// El catálogo no cambia durante la sesión: una sola petición compartida.
let cache: Promise<BodySystem[]> | null = null
// El catálogo llega en el idioma de la interfaz (FE-38): al cambiarlo, se vuelve a pedir.
let cacheLang = currentLang()

/** Catálogo de sistemas del cuerpo (`GET /systems`), con su `svg_region`. */
export function useSystems() {
  return useLoad(() => {
    if (cacheLang !== currentLang()) {
      cache = null
      cacheLang = currentLang()
    }
    cache ??= withCatalogCache('systems', getSystems)().catch((err: unknown) => {
      cache = null
      throw err
    })
    return cache
  }, [])
}
