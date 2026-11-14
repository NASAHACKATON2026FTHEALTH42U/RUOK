import { api, unwrap } from './client'
import { withCatalogCache } from '../offline/cache'
import { useLoad } from './useLoad'

const getIndicators = () => unwrap(api.GET('/api/v1/indicators'))
export type Indicator = Awaited<ReturnType<typeof getIndicators>>[number]

// El catálogo no cambia durante la sesión: una sola petición compartida.
let cache: Promise<Indicator[]> | null = null

/** Catálogo de indicadores (`GET /indicators`): nombre, unidad, rangos, instrucciones… */
export function useIndicators() {
  return useLoad(() => {
    cache ??= withCatalogCache('indicators', getIndicators)().catch((err: unknown) => {
      cache = null
      throw err
    })
    return cache
  }, [])
}
