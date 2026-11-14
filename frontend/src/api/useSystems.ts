import { api, unwrap } from './client'
import { withCatalogCache } from '../offline/cache'
import { useLoad } from './useLoad'

const getSystems = () => unwrap(api.GET('/api/v1/systems'))
export type BodySystem = Awaited<ReturnType<typeof getSystems>>[number]

// El catálogo no cambia durante la sesión: una sola petición compartida.
let cache: Promise<BodySystem[]> | null = null

/** Catálogo de sistemas del cuerpo (`GET /systems`), con su `svg_region`. */
export function useSystems() {
  return useLoad(() => {
    cache ??= withCatalogCache('systems', getSystems)().catch((err: unknown) => {
      cache = null
      throw err
    })
    return cache
  }, [])
}
