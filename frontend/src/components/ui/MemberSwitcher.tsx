import { useMembers } from '../../api/useMembers'
import { useAuth } from '../../auth/useAuth'
import { capitalize, useVocab } from '../../environments/useVocab'
import { useEnvironmentStore } from '../../store/environment'

/**
 * Selector del member activo (FE-35) para quien supervisa a otros (`view:members`: admin,
 * medic, commander). Cambia el member de todas las páginas (panel, medir, historial…) sin
 * pasar por la lista de la tripulación. Un `member` no lo ve: siempre es él mismo.
 */
export function MemberSwitcher({ label = true }: { label?: boolean }) {
  const { can } = useAuth()
  const vocab = useVocab()
  const envId = useEnvironmentStore((s) => s.envId)
  const memberId = useEnvironmentStore((s) => s.memberId)
  const selectMember = useEnvironmentStore((s) => s.selectMember)
  const members = useMembers(can('view:members') ? envId : null)

  if (!can('view:members') || !envId) return null
  const list = members.state === 'ready' ? members.data : []
  // El member guardado puede ser de otra sesión o ya no existir: entonces, «elige…».
  const value = list.some((m) => m.id === memberId) ? String(memberId) : ''

  return (
    <label className="flex items-center gap-2 text-sm">
      {label && <span className="text-env-muted">{capitalize(vocab.member)}</span>}
      <select
        aria-label={label ? undefined : capitalize(vocab.member)}
        className="min-w-0 rounded-md border border-env-border bg-env-bg px-2 py-1 text-env-text focus:outline-2 focus:outline-offset-1 focus:outline-env-primary disabled:opacity-60"
        value={value}
        disabled={members.state !== 'ready'}
        onChange={(e) => {
          if (e.target.value) selectMember(Number(e.target.value))
        }}
      >
        <option value="" disabled>
          {members.state === 'loading'
            ? 'Cargando…'
            : members.state === 'error'
              ? 'Sin conexión'
              : `Elige ${vocab.member}…`}
        </option>
        {list.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  )
}
