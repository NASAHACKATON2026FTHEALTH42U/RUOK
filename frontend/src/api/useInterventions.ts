import { withCatalogCache } from '../offline/cache'
import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getInterventions = () => unwrap(api.GET('/api/v1/interventions'))
export type Intervention = Awaited<ReturnType<typeof getInterventions>>[number]

// Una sola petición compartida; se guarda en IndexedDB para tenerlas sin conexión (SOS offline).
let cache: Promise<Intervention[]> | null = null

/** Catálogo de intervenciones (`GET /interventions`), con caché offline. */
export function useInterventions() {
  return useLoad(() => {
    cache ??= withCatalogCache('interventions', getInterventions)().catch((err: unknown) => {
      cache = null
      throw err
    })
    return cache
  }, [])
}
