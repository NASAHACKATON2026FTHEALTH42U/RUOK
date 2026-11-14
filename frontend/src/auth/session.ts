import { create } from 'zustand'
import { api, ApiError, configureApi, NetworkError, unwrap, type Schema } from '../api/client'
import { getDb } from '../offline/db'
import { resumeSync } from '../offline/outbox'
import { useEnvironmentStore } from '../store/environment'
import { isValid } from './roles'

/**
 * Sesión (FE-27, docs/auth-and-roles.md). El token vive en IndexedDB del dispositivo
 * (`kv.auth = {token, user, exp}`), junto con `kv.last_member_id` para el SOS sin sesión.
 * - Todas las peticiones llevan `Authorization: Bearer` (configureApi).
 * - Un 401 marca la sesión como caducada y lleva al login SIN borrar nada: el outbox se pausa
 *   solo (FE-11) y se reanuda al volver a entrar.
 * - Cerrar sesión borra `kv.auth` pero NUNCA el outbox.
 */

export type User = Schema<'User'>

interface StoredAuth {
  token: string
  user: User
  exp: string
}

type Status = 'loading' | 'anonymous' | 'authenticated' | 'expired'

interface SessionState {
  status: Status
  token: string | null
  user: User | null
  exp: string | null
  /** Último member que usó el dispositivo (para el SOS sin sesión). */
  lastMemberId: number | null
}

export const useSession = create<SessionState>(() => ({
  status: 'loading',
  token: null,
  user: null,
  exp: null,
  lastMemberId: null,
}))

async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await getDb()).get('kv', key))?.value as T | undefined
}
async function kvPut(key: string, value: unknown) {
  await (await getDb()).put('kv', { key, value })
}

/** Carga la sesión guardada y conecta el cliente (token y 401). Se llama en main.tsx. */
export async function initSession(): Promise<void> {
  configureApi({
    getToken: () => useSession.getState().token,
    onUnauthorized: () => {
      // Solo una sesión activa pasa a "caducada"; durante el login un 401 es "credenciales".
      if (useSession.getState().status === 'authenticated') {
        useSession.setState({ status: 'expired', token: null })
      }
    },
  })
  const [auth, lastMemberId] = await Promise.all([
    kvGet<StoredAuth>('auth'),
    kvGet<number>('last_member_id'),
  ])
  if (auth && isValid(auth.exp, Date.now())) {
    useSession.setState({ status: 'authenticated', ...auth, lastMemberId: lastMemberId ?? null })
  } else {
    useSession.setState({
      status: auth ? 'expired' : 'anonymous',
      user: auth?.user ?? null,
      lastMemberId: lastMemberId ?? null,
    })
  }
  // Caducidad local mientras la app está abierta (sin esperar a un 401 del servidor).
  setInterval(() => {
    const { status, exp } = useSession.getState()
    if (status === 'authenticated' && exp && !isValid(exp, Date.now())) {
      useSession.setState({ status: 'expired', token: null })
    }
  }, 60_000)
}

export type LoginError = { kind: 'credentials' | 'offline' | 'locked' | 'other'; message: string }

/** Inicia sesión con contraseña o PIN. Lanza `LoginError` con un mensaje para la UI. */
export async function login(
  username: string,
  secret: { password: string } | { pin: string },
): Promise<User> {
  let res: Schema<'TokenResponse'>
  try {
    res =
      'password' in secret
        ? await unwrap(
            api.POST('/api/v1/auth/login', { body: { username, password: secret.password } }),
          )
        : await unwrap(api.POST('/api/v1/auth/pin', { body: { username, pin: secret.pin } }))
  } catch (err) {
    throw toLoginError(err)
  }
  const auth: StoredAuth = { token: res.access_token, user: res.user, exp: res.expires_at }
  await kvPut('auth', auth)
  if (res.user.member_id != null) await kvPut('last_member_id', res.user.member_id)
  useSession.setState({
    status: 'authenticated',
    ...auth,
    lastMemberId: res.user.member_id ?? useSession.getState().lastMemberId,
  })
  await applyUserContext(res.user)
  // Lo que se quedó en el outbox (sin red o por un 401) se envía ahora.
  void resumeSync()
  return res.user
}

function toLoginError(err: unknown): LoginError {
  if (err instanceof NetworkError || (err instanceof ApiError && err.status >= 502)) {
    return { kind: 'offline', message: 'Sin conexión con el servidor de a bordo.' }
  }
  if (err instanceof ApiError && err.status === 401) {
    return { kind: 'credentials', message: 'Usuario, contraseña o PIN incorrectos.' }
  }
  if (err instanceof ApiError && err.status === 429) {
    return { kind: 'locked', message: 'Demasiados intentos. Espera unos minutos.' }
  }
  return { kind: 'other', message: err instanceof Error ? err.message : String(err) }
}

/** Fija el entorno (y el member, si es un member) del usuario en el store de la app. */
async function applyUserContext(user: User) {
  const env = useEnvironmentStore.getState()
  if (user.env_id) {
    try {
      const envs = await unwrap(api.GET('/api/v1/environments'))
      const target = envs.find((e) => e.id === user.env_id)
      if (target) env.selectEnvironment(target)
    } catch {
      // Sin catálogo: se mantiene el entorno que hubiera.
    }
  }
  if (user.member_id != null) useEnvironmentStore.getState().selectMember(user.member_id)
}

/** Cierra la sesión: borra `kv.auth` pero conserva el outbox (los pendientes se enviarán al volver). */
export async function logout(): Promise<void> {
  await (await getDb()).delete('kv', 'auth')
  useSession.setState({ status: 'anonymous', token: null, user: null, exp: null })
}
