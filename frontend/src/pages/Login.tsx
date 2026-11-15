import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, unwrap } from '../api/client'
import { isShowcase } from '../api/mocks/mode'
import { useEnvironments } from '../api/useEnvironments'
import { useLoad } from '../api/useLoad'
import { homeFor } from '../auth/roles'
import { login, useSession, type LoginError } from '../auth/session'
import { SosButton } from '../components/alerts/SosButton'
import { useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'

/** PIN de los usuarios demo (docs/auth-and-roles.md, solo con DEMO_MODE). */
const DEMO_PIN = '1234'

/** Logo: anillos que giran despacio alrededor de "R U OK" (quietos con "reducir movimiento"). */
function RuokRings() {
  return (
    <div className="relative mx-auto h-[132px] w-full max-w-[390px]" aria-hidden="true">
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
      <span className="absolute inset-x-0 top-[56px] text-center font-mono text-[15px] tracking-[0.2em]">
        R U OK<span className="text-env-primary">?</span>
      </span>
    </div>
  )
}

/**
 * Login (FE-27) con el estilo de consola de a bordo (Login.dc.html): usuario + contraseña o PIN,
 * accesos de los usuarios demo y "Pedir ayuda sin sesión" (el SOS nunca depende del login).
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
  const [mode, setMode] = useState<'password' | 'pin'>('password')
  const [username, setUsername] = useState(previous?.username ?? '')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<LoginError | null>(null)
  const [busy, setBusy] = useState(false)
  // Usuarios demo a la vista, salvo en el escaparate público (plegados hasta que se pidan).
  const [showDemo, setShowDemo] = useState(() => !isShowcase())
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
          className="hud-panel mt-4"
          onSubmit={(e) => {
            e.preventDefault()
            void enter(
              username.trim(),
              mode === 'password' ? { password: secret } : { pin: secret },
            )
          }}
        >
          <div className="hud-head">
            <b>AUTH.01</b>Acceso
            {envName && <span className="hud-chip">{envName}</span>}
          </div>
          <div className="flex flex-col gap-3 px-3.5 pt-3 pb-3.5">
            <div
              role="tablist"
              aria-label="Método"
              className="grid grid-cols-2 border border-env-border"
            >
              {(['password', 'pin'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => {
                    setMode(m)
                    setSecret('')
                    setError(null)
                  }}
                  className={`h-10 font-mono text-[11px] tracking-[0.14em] uppercase ${
                    mode === m
                      ? 'bg-env-primary/15 text-env-text shadow-[inset_0_-2px_0_var(--env-primary)]'
                      : 'text-env-muted hover:text-env-text'
                  }`}
                >
                  {m === 'password' ? 'Contraseña' : 'PIN rápido'}
                </button>
              ))}
            </div>

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
              <span className="hud-label">
                {mode === 'password' ? 'Contraseña' : 'PIN · 4–6 dígitos'}
              </span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete={mode === 'password' ? 'current-password' : 'one-time-code'}
                inputMode={mode === 'pin' ? 'numeric' : undefined}
                pattern={mode === 'pin' ? '[0-9]{4,6}' : undefined}
                required
                className={`hud-input ${mode === 'pin' ? 'text-lg tracking-[0.5em]' : ''}`}
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

        {/* Escaparate público: la lista va plegada en un botón, para que el login salga limpio. */}
        {demo.state === 'ready' && demo.data.length > 0 && !showDemo && (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => setShowDemo(true)}
            className="hud-btn mt-3 w-full"
          >
            Usuarios demo ({demo.data.length})
          </button>
        )}
        {demo.state === 'ready' && demo.data.length > 0 && showDemo && (
          <section className="hud-panel mt-3" aria-label="Usuarios de la demo">
            <div className="hud-head">
              <b>DEMO.02</b>Usuarios
              <span className="hud-chip">PIN {DEMO_PIN}</span>
            </div>
            <ul className="grid grid-cols-2">
              {demo.data.map((u) => (
                <li key={u.username} className="border-r border-b border-env-border/60">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void enter(u.username, { pin: DEMO_PIN })}
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
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-4">
          <SosButton variant="inline" label="Pedir ayuda sin sesión" />
          <p className="text-center text-xs leading-snug text-env-muted">
            Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni sustituye
            el criterio de un profesional sanitario.
          </p>
        </div>
      </main>
    </div>
  )
}
