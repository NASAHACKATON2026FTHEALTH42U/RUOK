import { useCallback, useSyncExternalStore } from 'react'

/** ¿Se cumple la media query (p. ej. `(min-width: 768px)`)? Se actualiza si deja de cumplirse. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
