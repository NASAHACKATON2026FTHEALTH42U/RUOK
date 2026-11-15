import { useState, type FormEvent } from 'react'
import { ApiError, NetworkError, type Schema } from '../../api/client'
import type { Environment } from '../../api/useEnvironments'
import { createUser, setUserActive, useUsers, type UserAccount } from '../../api/useUsers'
import { useMembers } from '../../api/useMembers'
import { userRoleLabel } from '../../auth/permissions'
import { capitalize } from '../../environments/useVocab'
import { ControlPanel } from './ControlHeader'

type Role = Schema<'Role'>

// El admin es global: no se crea desde un entorno.
const ROLES: Role[] = ['member', 'medic', 'commander', 'responder', 'psych', 'family']

const btn =
  'min-h-8 border border-env-border px-2.5 text-sm hover:border-env-text disabled:opacity-50'
const field = 'hud-input w-full !font-sans !text-[0.9375rem]'

function errorText(err: unknown): string {
  if (err instanceof NetworkError) return 'sin conexión con el servidor'
  if (err instanceof ApiError) return err.message
  return String(err)
}

/**
 * Gestión de usuarios (FS-07, solo admin) del entorno activo: listado, alta y activar/desactivar.
 * El backend valida rol, entorno y member; aquí solo se guía el formulario.
 */
export function UsersPanel({ env }: { env: Environment }) {
  const users = useUsers()
  const vocab = env.vocabulary as Record<string, string>
  const label = (r: Role, server: string = r) => capitalize(userRoleLabel(r, vocab, server))
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

  const list = users.state === 'ready' ? users.data.filter((u) => u.env_id === env.id) : []

  return (
    <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
      <ControlPanel
        title={`Usuarios de ${env.name}`}
        aside={users.state === 'ready' ? `${list.length} cuentas` : undefined}
        aria-label="Usuarios"
        className="xl:max-h-full xl:min-h-0"
        bodyClassName="min-h-0 flex-1 overflow-auto [scrollbar-color:var(--env-border)_transparent]"
      >
        <p aria-live="polite" className="min-h-0 px-4 pt-3 text-sm text-env-muted empty:hidden">
          {log}
        </p>
        {users.state === 'loading' && <div className="m-4 h-32 animate-pulse bg-env-bg" />}
        {users.state === 'error' && (
          <p className="p-4 text-env-muted">
            No se han podido cargar los usuarios.{' '}
            <button type="button" onClick={users.retry} className="underline">
              Reintentar
            </button>
          </p>
        )}
        {users.state === 'ready' && (
          <div>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-env-surface text-left">
                <tr>
                  {['Nombre', 'Usuario', 'Rol', 'Estado', ''].map((h) => (
                    <th key={h} className="hud-label px-4 py-2 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} className="border-t border-env-border/60">
                    <td className="px-4 py-2 font-medium">{u.display_name}</td>
                    <td className="px-4 py-2 font-mono text-env-muted">{u.username}</td>
                    <td className="px-4 py-2">{label(u.role, u.role_label)}</td>
                    <td className={`px-4 py-2 ${u.active ? '' : 'text-env-muted'}`}>
                      {u.active ? 'Activo' : 'Desactivado'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggle(u)}
                        className={btn}
                      >
                        {u.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ControlPanel>

      <CreateUserForm env={env} label={label} busy={busy} onCreate={run} />
    </div>
  )
}

function CreateUserForm({
  env,
  label,
  busy,
  onCreate,
}: {
  env: Environment
  label: (r: Role) => string
  busy: boolean
  onCreate: (label: string, fn: () => Promise<unknown>) => Promise<boolean>
}) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<Role>('medic')
  const envId = env.id
  const [memberId, setMemberId] = useState('')
  const [password, setPassword] = useState('')

  const needsMember = role === 'member'
  // Members de un entorno: solo se piden cuando el rol lo necesita.
  const members = useMembers(needsMember && envId ? envId : null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await onCreate(`Crear a ${username}`, () =>
      createUser({
        username,
        display_name: displayName,
        role,
        env_id: envId,
        member_id: needsMember ? Number(memberId) : null,
        password,
      }),
    )
    if (ok) {
      setUsername('')
      setDisplayName('')
      setPassword('')
      setMemberId('')
    }
  }

  return (
    <form onSubmit={submit} aria-label="Nuevo usuario" className="hud-panel">
      <h2 className="hud-panel-head">Nuevo usuario en {env.name}</h2>
      <div className="grid gap-3 p-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
        <label className="flex flex-col gap-1">
          <span className="hud-label">Usuario</span>
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
          <span className="hud-label">Nombre</span>
          <input
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="hud-label">Rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={field}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
          </select>
        </label>
        {needsMember && (
          <label className="flex flex-col gap-1">
            <span className="hud-label">Member</span>
            <select
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className={field}
            >
              <option value="">Elige…</option>
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
          <span className="hud-label">Contraseña (mín. 8)</span>
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
      </div>
      <div className="px-4 pb-4">
        <button type="submit" disabled={busy} className="hud-btn hud-btn-primary w-full">
          Crear usuario
        </button>
      </div>
    </form>
  )
}
