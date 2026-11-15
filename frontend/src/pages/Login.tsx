import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, unwrap, type Schema } from '../api/client'
import { isShowcase } from '../api/mocks/mode'
import { useEnvironments } from '../api/useEnvironments'
import { useLoad } from '../api/useLoad'
import { homeFor } from '../auth/roles'
import { login, useSession, type LoginError } from '../auth/session'
import { SosButton } from '../components/alerts/SosButton'
import { RuokRings } from '../components/ui/RuokLogo'
import { capitalize } from '../environments/useVocab'
import {
  DEFAULT_LOGIN_ENV,
  demoPassword,
  demoUsersFor,
  shortDisplayName,
} from '../components/auth/demoUsers'
import { useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'

/** Lista vacía estable mientras carga el catálogo (no cambia de identidad en cada render). */
const NO_ENVS: Schema<'Environment'>[] = []

/** Grupo de cada rol que no es member, debajo de su nombre en la lista de la demo. */
const ROLE_GROUP: Partial<Record<string, string>> = {
  medic: 'atención sanitaria',
  commander: 'mando',
  responder: 'control externo',
  psych: 'apoyo psicológico',
  family: 'familia',
  admin: 'global',
}

/**
 * Login (FE-27) con el estilo de consola de a bordo (Login.dc.html): usuario + contraseña,
 * accesos de los usuarios demo del entorno elegido y el botón SOS (el SOS nunca
 * depende del login). Colores del entorno activo; tras entrar, cada rol va a su vista inicial
 * (o a donde iba, si la sesión había caducado).
 *
 * - Entorno: si el dispositivo no tiene ninguno, arranca en la misión espacial (Marte). Se
 *   puede cambiar aquí; solo se enseñan los usuarios demo de ese entorno (y el operador).
 * - Responsive: una columna en móvil; desde `lg`, el acceso a la izquierda y los usuarios
 *   demo y la ayuda a la derecha.
 */
export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const previous = useSession((s) => s.user)
  const vocab = useVocab()
  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const envList = envs.state === 'ready' ? envs.data : NO_ENVS
  const envName = envList.find((e) => e.id === envId)?.name
  const selectEnvironment = useEnvironmentStore((s) => s.selectEnvironment)
  const [username, setUsername] = useState(previous?.username ?? '')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<LoginError | null>(null)
  const [busy, setBusy] = useState(false)
  // Usuarios demo a la vista, salvo en el escaparate público y en pantallas estrechas (móvil):
  // ahí van plegados en un botón para que el login quepa sin scroll.
  const [showDemo, setShowDemo] = useState(
    () => !isShowcase() && window.matchMedia('(min-width: 768px)').matches,
  )
  // Se reintenta cada 10 s: si se abrió sin servidor, los usuarios demo aparecen al volver.
  const demo = useLoad(() => unwrap(api.GET('/api/v1/auth/demo-users')), [], { refreshMs: 10_000 })
  const expired = params.get('expired') === '1'

  // Sin entorno en el dispositivo, el login arranca en la misión espacial.
  useEffect(() => {
    if (envId !== null || envList.length === 0) return
    const initial = envList.find((e) => e.id === DEFAULT_LOGIN_ENV) ?? envList[0]
    selectEnvironment(initial)
  }, [envId, envList, selectEnvironment])

  const demoUsers = demo.state === 'ready' ? demoUsersFor(demo.data, envId) : []

  const enter = async (user: string, password: string) => {
    setBusy(true)
    setError(null)
    try {
      const u = await login(user, { password })
      const next = params.get('next')
      navigate(next && expired ? next : homeFor(u.role), { replace: true })
    } catch (err) {
      setError(err as LoginError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hud-grid flex min-h-full flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-3.5 pt-4 pb-4 md:max-w-xl md:px-6 lg:max-w-5xl lg:justify-center lg:py-8">
        <div className="flex justify-between px-1">
          <span className="hud-label text-[9px] lg:text-[10px]">
            Nodo{envName ? `.${envName}` : ''} / Servidor a bordo
          </span>
          <span className="hud-label text-[9px] lg:text-[10px]">Sin internet · Local</span>
        </div>

        <div className="mt-2 lg:mt-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
          {/* Columna 1: marca y acceso */}
          <div className="flex flex-col">
            <RuokRings />

            <div className="mt-1 text-center">
              <h1 className="text-[30px] leading-tight font-light lg:text-[34px]">
                Hola de nuevo, <span className="text-env-primary">{vocab.member}.</span>
              </h1>
              <p className="mt-0.5 text-sm text-env-muted">
                Inicia sesión en el sistema de a bordo.
              </p>
            </div>

            {expired && (
              <p role="status" className="hud-panel mt-4 p-3 text-sm">
                Tu sesión ha caducado. Vuelve a entrar: lo que tengas pendiente en este dispositivo
                se enviará después, no se ha perdido nada.
              </p>
            )}

            <form
              className="hud-panel mt-4"
              onSubmit={(e) => {
                e.preventDefault()
                void enter(username.trim(), secret)
              }}
            >
              <div className="hud-head">
                <b>AUTH.01</b>Acceso
                {envName && <span className="hud-chip mr-[22px]">{envName}</span>}
              </div>
              <div className="flex flex-col gap-3 px-3.5 pt-3 pb-3.5">
                <label className="flex flex-col gap-1.5">
                  <span className="hud-label">Usuario</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    required
                    className="hud-input"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="hud-label">Contraseña</span>
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="hud-input"
                  />
                </label>
                {error && (
                  <p role="alert" className="text-sm">
                    ⚠ {error.message}
                    {error.kind === 'offline' &&
                      ' Si es una emergencia, pulsa SOS: funciona sin sesión.'}
                  </p>
                )}
                <button type="submit" disabled={busy} className="hud-btn hud-btn-primary w-full">
                  {busy ? 'Entrando…' : 'Entrar'}
                </button>
              </div>
            </form>
          </div>

          {/* Columna 2: entorno, usuarios demo y ayuda */}
          <div className="mt-3 flex flex-1 flex-col gap-3 lg:mt-0">
            {envList.length > 0 && (
              <label className="hud-panel flex items-center gap-3 py-1.5 pr-[22px] pl-3.5">
                <span className="hud-label shrink-0">
                  <b className="font-normal text-env-primary">ENV.02</b> Entorno
                </span>
                <select
                  value={envId ?? ''}
                  onChange={(e) => {
                    const next = envList.find((x) => x.id === e.target.value)
                    if (next) selectEnvironment(next)
                  }}
                  className="hud-input min-w-0 flex-1 !border-0 !bg-transparent !px-1 !font-sans !text-[15px]"
                >
                  {envList.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* Plegada en un botón en el escaparate público y en móvil. */}
            {demoUsers.length > 0 && !showDemo && (
              <button
                type="button"
                aria-expanded={false}
                onClick={() => setShowDemo(true)}
                className="hud-btn !h-11 w-full"
              >
                Usuarios demo ({demoUsers.length})
              </button>
            )}
            {demoUsers.length > 0 && showDemo && (
              <section className="hud-panel" aria-label="Usuarios de la demo">
                <div className="hud-head">
                  <b>DEMO.03</b>Usuarios
                  <span className="hud-chip mr-[22px]">Un toque para entrar</span>
                </div>
                <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
                  {demoUsers.map((u) => (
                    <li key={u.username} className="border-r border-b border-env-border/60">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void enter(u.username, demoPassword(u))}
                        className="flex min-h-11 w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-env-primary/10 disabled:opacity-60"
                      >
                        {/* Members por su nombre; el resto, por su rol con las palabras del
                            entorno ("Oficial médico") y debajo su grupo. */}
                        <span className="text-sm">
                          {u.role === 'member' || u.role === 'admin'
                            ? shortDisplayName(u.display_name, envName)
                            : capitalize(u.role_label)}
                        </span>
                        <span className="hud-label text-[9px]">
                          {u.role === 'member'
                            ? u.role_label
                            : (ROLE_GROUP[u.role] ?? u.role_label)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="mt-auto flex flex-col gap-2.5 pt-1 lg:mt-0">
              <SosButton variant="inline" />
              <p className="text-center text-xs leading-snug text-env-muted">
                Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni
                sustituye el criterio de un profesional sanitario.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
