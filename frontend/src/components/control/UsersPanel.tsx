import { useState, type FormEvent } from 'react'
import { ApiError, NetworkError, type Schema } from '../../api/client'
import type { Environment } from '../../api/useEnvironments'
import {
  createUser,
  resetUserPin,
  setUserActive,
  useUsers,
  type UserAccount,
} from '../../api/useUsers'
import { useMembers } from '../../api/useMembers'

type Role = Schema<'Role'>

const ROLES: Role[] = ['member', 'medic', 'commander', 'responder', 'psych', 'family', 'admin']
const PIN_ROLES: Role[] = ['member', 'medic']

const btn =
  'rounded-lg border border-env-border px-3 py-1.5 text-sm hover:border-env-text disabled:opacity-50'
const field = 'rounded-md border border-env-border bg-env-bg px-2 py-1.5 text-env-text'

function errorText(err: unknown): string {
  if (err instanceof NetworkError) return 'sin conexión con el servidor'
  if (err instanceof ApiError) return err.message
  return String(err)
}

/**
 * Gestión de usuarios (FS-07, solo admin): listado, alta, activar/desactivar y restablecer PIN.
 * El backend valida rol, entorno y member; aquí solo se guía el formulario.
 */
export function UsersPanel({ environments }: { environments: Environment[] }) {
  const users = useUsers()
  const [log, setLog] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      setLog(`✓ ${label}`)
      users.refresh()
      return true
    } catch (err) {
      setLog(`⚠ ${label}: ${errorText(err)}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  const toggle = (u: UserAccount) =>
    run(`${u.active ? 'Desactivar' : 'Activar'} a ${u.username}`, () =>
      setUserActive(u.id, !u.active),
    )

  const pin = (u: UserAccount) => {
    const value = window.prompt(`Nuevo PIN para ${u.username} (4 a 6 dígitos)`)
    if (value === null) return
    if (!/^\d{4,6}$/.test(value)) {
      setLog('⚠ El PIN tiene que ser de 4 a 6 dígitos')
      return
    }
    return run(`Restablecer el PIN de ${u.username}`, () => resetUserPin(u.id, value))
  }

  const envName = (id: string | null | undefined) =>
    id ? (environments.find((e) => e.id === id)?.name ?? id) : 'Global'

  return (
    <div className="space-y-6">
      <CreateUserForm environments={environments} busy={busy} onCreate={run} />

      <p aria-live="polite" className="min-h-5 text-sm text-env-muted">
        {log}
      </p>

      <section aria-label="Usuarios">
        <h2 className="mb-3 text-xl font-semibold">Usuarios</h2>
        {users.state === 'loading' && (
          <div className="h-32 animate-pulse rounded-xl bg-env-surface" />
        )}
        {users.state === 'error' && (
          <p className="text-env-muted">
            No se han podido cargar los usuarios.{' '}
            <button type="button" onClick={users.retry} className="underline">
              Reintentar
            </button>
          </p>
        )}
        {users.state === 'ready' && (
          <div className="overflow-x-auto rounded-xl border border-env-border">
            <table className="w-full text-sm">
              <thead className="bg-env-surface text-left text-env-muted">
                <tr>
                  {['Usuario', 'Nombre', 'Rol', 'Entorno', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id} className="border-t border-env-border">
                    <td className="px-3 py-2 font-medium">{u.username}</td>
                    <td className="px-3 py-2">{u.display_name}</td>
                    <td className="px-3 py-2">
                      {u.role}
                      <span className="text-env-muted"> · {u.role_label}</span>
                    </td>
                    <td className="px-3 py-2">{envName(u.env_id)}</td>
                    <td className="px-3 py-2">{u.active ? 'Activo' : 'Desactivado'}</td>
                    <td className="flex flex-wrap gap-2 px-3 py-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggle(u)}
                        className={btn}
                      >
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
                      {PIN_ROLES.includes(u.role) && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => pin(u)}
                          className={btn}
                        >
                          Restablecer PIN
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function CreateUserForm({
  environments,
  busy,
  onCreate,
}: {
  environments: Environment[]
  busy: boolean
  onCreate: (label: string, fn: () => Promise<unknown>) => Promise<boolean>
}) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<Role>('medic')
  const [envId, setEnvId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')

  const isAdmin = role === 'admin'
  const needsMember = role === 'member'
  const usesPin = PIN_ROLES.includes(role)
  // Members de un entorno: solo se piden cuando el rol lo necesita.
  const members = useMembers(needsMember && envId ? envId : null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await onCreate(`Crear a ${username}`, () =>
      createUser({
        username,
        display_name: displayName,
        role,
        env_id: isAdmin ? null : envId,
        member_id: needsMember ? Number(memberId) : null,
        password,
        pin: usesPin && pin ? pin : null,
      }),
    )
    if (ok) {
      setUsername('')
      setDisplayName('')
      setPassword('')
      setPin('')
      setMemberId('')
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Nuevo usuario"
      className="rounded-xl border border-env-border bg-env-surface p-4"
    >
      <h2 className="mb-3 text-xl font-semibold">Nuevo usuario</h2>
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-env-muted">Usuario</span>
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="[a-z0-9][a-z0-9._\-]{1,31}"
            title="Minúsculas, números, punto, guion o guion bajo (2 a 32)"
            autoCapitalize="none"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-env-muted">Nombre</span>
          <input
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-env-muted">Rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-env-muted">Entorno</span>
          <select
            required={!isAdmin}
            disabled={isAdmin}
            value={isAdmin ? '' : envId}
            onChange={(e) => {
              setEnvId(e.target.value)
              setMemberId('')
            }}
            className={field}
          >
            <option value="">{isAdmin ? 'Global' : 'Elige…'}</option>
            {!isAdmin &&
              environments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </label>
        {needsMember && (
          <label className="flex flex-col gap-1">
            <span className="text-env-muted">Member</span>
            <select
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className={field}
            >
              <option value="">{envId ? 'Elige…' : 'Elige antes un entorno'}</option>
              {members.state === 'ready' &&
                members.data.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-env-muted">Contraseña (mín. 8)</span>
          <input
            required
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>
        {usesPin && (
          <label className="flex flex-col gap-1">
            <span className="text-env-muted">PIN rápido (opcional, 4 a 6 dígitos)</span>
            <input
              inputMode="numeric"
              pattern="\d{4,6}"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className={field}
            />
          </label>
        )}
      </div>
      <button type="submit" disabled={busy} className={`${btn} mt-4`}>
        Crear usuario
      </button>
    </form>
  )
}
