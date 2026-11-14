import { api, unwrap } from './client'
import { useLoad } from './useLoad'

/** URLs del servidor en la red local (`GET /system/network-info`), para el QR de conexión. */
export function useNetworkInfo() {
  return useLoad(() => unwrap(api.GET('/api/v1/system/network-info')), [])
}
