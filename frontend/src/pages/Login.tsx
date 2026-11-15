import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, unwrap } from '../api/client'
import { useEnvironments } from '../api/useEnvironments'
import { useLoad } from '../api/useLoad'
import { homeFor } from '../auth/roles'
import { login, useSession, type LoginError } from '../auth/session'
import { SosButton } from '../components/alerts/SosButton'
import { useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'

/** PIN de los usuarios demo (docs/auth-and-roles.md, solo con DEMO_MODE). */
const DEMO_PIN = '1234'
/** Roles con PIN (tablets compartidas); el resto de usuarios demo entra con contraseña. */
const PIN_ROLES = ['member', 'medic']

/**
 * Credencial de un usuario demo (docs/auth-and-roles.md, solo existe con DEMO_MODE): PIN para
 * los roles con PIN y la contraseña de demo `ruok-<entorno>` para los demás, que no tienen PIN.
 */
function demoCredential(u: { role: string; env_id?: string | null }) {
  return PIN_ROLES.includes(u.role)
    ? { pin: DEMO_PIN }
    : { password: `ruok-${u.env_id ?? 'admin'}` }
}

/** Logo: anillos que giran despacio alrededor de "R U OK" (quietos con "reducir movimiento"). */
function RuokRings() {
  return (
    <div
      // En pantallas bajas (≤ 700 px de alto) el logo encoge para que el login quepa sin scroll.
      className="relative mx-auto h-[132px] w-full max-w-[390px] [@media(max-height:700px)]:h-[64px]"
      aria-hidden="true"
    >
      <svg viewBox="0 0 390 132" className="absolute inset-0 h-full w-full">
        <circle
          cx="195"
          cy="66"
          r="62"
          fill="none"
          stroke="var(--env-border)"
          strokeWidth="4"
          strokeDasharray="1 4.4"
        />
        <circle
          className="ruok-spin"
          cx="195"
          cy="66"
          r="50"
          fill="none"
          stroke="var(--env-primary)"
          strokeWidth="7"
          strokeDasharray="38 14"
          strokeOpacity="0.8"
        />
        <circle
          className="ruok-spin ruok-spin-reverse"
          cx="195"
          cy="66"
          r="38"
          fill="none"
          stroke="var(--env-primary)"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeDasharray="6 5"
        />
        <path d="M40 66H118M272 66H350" stroke="var(--env-border)" />
        <rect x="116" y="64" width="5" height="5" fill="var(--env-primary)" />
        <rect x="269" y="64" width="5" height="5" fill="var(--env-primary)" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[15px] tracking-[0.2em] [@media(max-height:700px)]:text-[11px]">
        R U OK<span className="text-env-primary">?</span>
      </span>
    </div>
  )
}

/**
 * Login (FE-27) con el estilo de consola de a bordo (Login.dc.html): usuario + contraseña, un
 * botón que abre la lista de usuarios demo en una ventana modal y "Pedir ayuda sin sesión" (el
 * SOS nunca depende del login). Cabe en la pantalla sin scroll.
 * Colores del entorno activo; tras entrar, cada rol va a su vista inicial (o a donde iba, si la
 * sesión había caducado).
 */
export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const previous = useSession((s) => s.user)
  const vocab = useVocab()
  const envId = useEnvironmentStore((s) => s.envId)
  const envs = useEnvironments()
  const envName = envs.state === 'ready' ? envs.data.find((e) => e.id === envId)?.name : undefined
  const [username, setUsername] = useState(previous?.username ?? '')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<LoginError | null>(null)
  const [busy, setBusy] = useState(false)
  // La lista de usuarios demo va en una ventana modal (con scroll propio): el login cabe en la
  // pantalla sin scroll.
  const [showDemo, setShowDemo] = useState(false)
  const closeDemoRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!showDemo) return
    closeDemoRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowDemo(false)
    document.addEventListener('keydown', onKey)
    // Con la ventana abierta, el fondo no se desplaza.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [showDemo])
  // Se reintenta cada 10 s: si se abrió sin servidor, los usuarios demo aparecen al volver.
  const demo = useLoad(() => unwrap(api.GET('/api/v1/auth/demo-users')), [], { refreshMs: 10_000 })
  const expired = params.get('expired') === '1'

  const enter = async (user: string, cred: { password: string } | { pin: string }) => {
    setBusy(true)
    setError(null)
    try {
      const u = await login(user, cred)
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
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-3.5 pt-4 pb-4">
        <div className="flex justify-between px-1">
          <span className="hud-label text-[9px]">
            Nodo{envName ? `.${envName}` : ''} / Servidor a bordo
          </span>
          <span className="hud-label text-[9px]">Sin internet · Local</span>
        </div>

        <div className="mt-2">
          <RuokRings />
        </div>

        <div className="mt-1 text-center">
          <h1 className="text-[30px] leading-tight font-light">
            Hola de nuevo, <span className="text-env-primary">{vocab.member}.</span>
          </h1>
          <p className="mt-0.5 text-sm text-env-muted">Inicia sesión en el sistema de a bordo.</p>
        </div>

        {expired && (
          <p role="status" className="hud-panel mt-4 p-3 text-sm">
            Tu sesión ha caducado. Vuelve a entrar: lo que tengas pendiente en este dispositivo se
            enviará después, no se ha perdido nada.
          </p>
        )}

        <form
          className="hud-panel mt-4 [@media(max-height:700px)]:mt-2"
          onSubmit={(e) => {
            e.preventDefault()
            void enter(username.trim(), { password: secret })
          }}
        >
          <div className="hud-head">
            <b>AUTH.01</b>Acceso
            {envName && <span className="hud-chip">{envName}</span>}
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
                {error.kind === 'offline' && ' Si necesitas ayuda, usa "Pedir ayuda sin sesión".'}
              </p>
            )}
            <button type="submit" disabled={busy} className="hud-btn hud-btn-primary w-full">
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
        </form>

        {demo.state === 'ready' && demo.data.length > 0 && (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setShowDemo(true)}
            className="hud-btn mt-3 w-full"
          >
            Usuarios demo ({demo.data.length})
          </button>
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-4">
          <SosButton variant="inline" label="Pedir ayuda sin sesión" />
          <p className="text-center text-xs leading-snug text-env-muted">
            Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni sustituye
            el criterio de un profesional sanitario.
          </p>
        </div>
      </main>

      {showDemo && demo.state === 'ready' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 md:p-8">
          {/* Clic fuera = cerrar */}
          <button
            type="button"
            aria-label="Cerrar la lista de usuarios"
            tabIndex={-1}
            onClick={() => setShowDemo(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/50"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Usuarios de la demo"
            className="hud-panel relative flex max-h-[85dvh] w-full max-w-2xl flex-col !bg-env-surface"
          >
            <div className="hud-head shrink-0">
              <b>DEMO.02</b>Usuarios
              <span className="hud-chip">{demo.data.length}</span>
              <button
                ref={closeDemoRef}
                type="button"
                onClick={() => setShowDemo(false)}
                aria-label="Cerrar"
                className="mr-3 px-2 text-base text-env-muted hover:text-env-text"
              >
                ✕
              </button>
            </div>
            {error && (
              <p role="alert" className="shrink-0 border-b border-env-border px-3.5 py-2 text-sm">
                ⚠ {error.message}
              </p>
            )}
            <ul className="grid min-h-0 flex-1 grid-cols-2 overflow-y-auto [scrollbar-color:var(--env-border)_transparent] sm:grid-cols-3">
              {demo.data.map((u) => (
                <li key={u.username} className="border-r border-b border-env-border/60">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void enter(u.username, demoCredential(u))}
                    className="flex min-h-11 w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-env-primary/10 disabled:opacity-60"
                  >
                    <span className="text-sm">{u.display_name}</span>
                    <span className="hud-label text-[9px]">
                      {u.role_label}
                      {u.env_id ? ` · ${u.env_id}` : ' · global'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
