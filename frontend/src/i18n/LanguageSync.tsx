import { useEffect, useRef } from 'react'
import { api, unwrap } from '../api/client'
import { useSession } from '../auth/session'
import { DEFAULT_VOCABULARY, useEnvironmentStore } from '../store/environment'
import { useLangStore } from './lang'

/**
 * Al cambiar de idioma, vuelve a pedir el entorno activo para traer su vocabulario
 * («astronauta» → «astronaut»), que se guarda en el dispositivo, y el usuario de la sesión (su
 * papel, «Comandante» → «Commander»). El resto de datos se recargan
 * solos: la app se vuelve a montar con el idioma nuevo (App.tsx).
 */
export function LanguageSync() {
  const lang = useLangStore((s) => s.lang)
  const first = useRef(true)
  useEffect(() => {
    // En el primer montaje solo si el idioma no es el de por defecto (el guardado puede venir de
    // otro idioma).
    if (first.current) {
      first.current = false
      if (lang === 'es') return
    }
    let cancelled = false
    unwrap(api.GET('/api/v1/environments'))
      .then((envs) => {
        if (cancelled) return
        const { envId } = useEnvironmentStore.getState()
        const env = envs.find((e) => e.id === envId)
        if (env) {
          useEnvironmentStore.setState({ vocabulary: { ...DEFAULT_VOCABULARY, ...env.vocabulary } })
        }
      })
      .catch(() => {
        // sin servidor: se queda el vocabulario guardado hasta la próxima vez
      })
    if (useSession.getState().status === 'authenticated') {
      unwrap(api.GET('/api/v1/auth/me'))
        .then((user) => {
          if (!cancelled) useSession.setState({ user })
        })
        .catch(() => {
          // sin servidor: se queda el guardado
        })
    }
    return () => {
      cancelled = true
    }
  }, [lang])
  return null
}
