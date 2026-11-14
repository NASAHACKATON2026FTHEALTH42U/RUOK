import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, unwrap } from '../api/client'
import { useLoad } from '../api/useLoad'
import { homeFor } from '../auth/roles'
import { login, useSession, type LoginError } from '../auth/session'
import { SosButton } from '../components/alerts/SosButton'

/** PIN de los usuarios demo (docs/auth-and-roles.md, solo con DEMO_MODE). */
const DEMO_PIN = '1234'

const inputCls =
  'mt-1 w-full rounded-md border border-env-border bg-env-bg px-3 py-2 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary'

/**
 * Login (FE-27): usuario + contraseña, pestaña PIN y selector de usuarios demo. Tras entrar,
 * cada rol va a su vista inicial (o a donde iba, si la sesión había caducado). El botón
 * "Pedir ayuda" está también aquí: el SOS nunca depende del login.
 */
export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const previous = useSession((s) => s.user)
  const [mode, setMode] = useState<'password' | 'pin'>('password')
  const [username, setUsername] = useState(previous?.username ?? '')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState<LoginError | null>(null)
  const [busy, setBusy] = useState(false)
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
    <div className="flex min-h-full flex-col">
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">
          R U OK<span className="text-env-primary">?</span>
        </h1>
        <p className="mt-1 text-env-muted">Inicia sesión en el sistema de a bordo.</p>

        {expired && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-env-border bg-env-surface p-3 text-sm"
          >
            Tu sesión ha caducado. Vuelve a entrar: lo que tengas pendiente en este dispositivo se
            enviará después, no se ha perdido nada.
          </p>
        )}

        <div
          role="tablist"
          aria-label="Método"
          className="mt-6 flex rounded-lg border border-env-border p-1 text-sm"
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
              className={`flex-1 rounded-md px-3 py-1.5 ${
                mode === m
                  ? 'bg-env-primary text-env-primary-text'
                  : 'text-env-muted hover:text-env-text'
              }`}
            >
              {m === 'password' ? 'Contraseña' : 'PIN rápido'}
            </button>
          ))}
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void enter(
              username.trim(),
              mode === 'password' ? { password: secret } : { pin: secret },
            )
          }}
        >
          <label className="block text-sm">
            Usuario
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            {mode === 'password' ? 'Contraseña' : 'PIN (4–6 dígitos)'}
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete={mode === 'password' ? 'current-password' : 'one-time-code'}
              inputMode={mode === 'pin' ? 'numeric' : undefined}
              pattern={mode === 'pin' ? '[0-9]{4,6}' : undefined}
              required
              className={inputCls}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm">
              ⚠ {error.message}
              {error.kind === 'offline' && ' Si necesitas ayuda, usa el botón "Pedir ayuda".'}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-env-primary px-4 py-2.5 font-medium text-env-primary-text disabled:opacity-60"
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {demo.state === 'ready' && demo.data.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium text-env-muted">
              Usuarios de la demo (PIN {DEMO_PIN})
            </h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {demo.data.map((u) => (
                <li key={u.username}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void enter(u.username, { pin: DEMO_PIN })}
                    className="w-full rounded-lg border border-env-border bg-env-surface px-3 py-2 text-left hover:border-env-text disabled:opacity-60"
                  >
                    <span className="block font-medium">{u.display_name}</span>
                    <span className="block text-xs text-env-muted">
                      {u.role_label}
                      {u.env_id ? ` · ${u.env_id}` : ' · global'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="border-t border-env-border px-4 pt-3 pb-20 text-center text-xs text-env-muted">
        Prototipo de autoevaluación. <strong>No es un dispositivo médico</strong> ni sustituye el
        criterio de un profesional sanitario.
      </footer>
      <SosButton />
    </div>
  )
}
