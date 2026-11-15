import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMembers } from '../api/useMembers'
import { CrewOverview } from '../components/members/CrewOverview'
import { pickIndividual } from '../components/members/crewOverview'
import { MemberStrip } from '../components/members/MemberStrip'
import { capitalize, useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'
import Dashboard from './Dashboard'

type View = 'conjunto' | 'individual'

/**
 * Estado de los members del entorno (vista inicial de medic y commander, FE-27/FE-35), en dos
 * modos:
 * - **Conjunto** (`/members`): un resumen por member que se adapta a cuántos hay; clic → detalle.
 * - **Individual** (`/members?vista=individual`): selector de members y el panel completo del
 *   elegido. El elegido es el member activo de toda la app (el mismo que el selector global).
 */
export default function Members() {
  const vocab = useVocab()
  const envId = useEnvironmentStore((s) => s.envId)
  const activeId = useEnvironmentStore((s) => s.memberId)
  const selectMember = useEnvironmentStore((s) => s.selectMember)
  const members = useMembers(envId)
  const [params, setParams] = useSearchParams()
  const view: View = params.get('vista') === 'individual' ? 'individual' : 'conjunto'
  const list = members.state === 'ready' ? members.data : []
  const selectedId = view === 'individual' ? pickIndividual(list, activeId) : null

  // Individual: si el member activo no es de este entorno (o no hay), se elige el más urgente.
  useEffect(() => {
    if (selectedId !== null && selectedId !== activeId) selectMember(selectedId)
  }, [selectedId, activeId, selectMember])

  const show = (next: View) => setParams(next === 'individual' ? { vista: 'individual' } : {})
  const open = (id: number) => {
    selectMember(id)
    show('individual')
  }

  const toggle = (
    <div
      role="group"
      aria-label="Vista"
      className={`grid grid-cols-2 gap-1.5 ${view === 'individual' ? 'max-md:hidden' : ''}`}
    >
      {(
        [
          ['conjunto', 'Conjunto'],
          ['individual', 'Individual'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => show(id)}
          disabled={members.state === 'ready' && list.length === 0}
          className={`flex min-h-11 min-w-28 items-center justify-center border px-3 font-mono text-[0.75rem] tracking-[0.1em] uppercase focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-env-primary disabled:opacity-50 ${
            view === id
              ? 'border-env-primary bg-env-primary/12 text-env-text'
              : 'border-env-border text-env-muted hover:text-env-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4">
      {/* Móvil, vista individual: el detalle a pantalla completa (el título solo para lectores
          de pantalla; «← Todos» va junto al selector). */}
      <header
        className={`flex flex-wrap items-center justify-between gap-3 ${view === 'individual' ? 'max-md:contents' : ''}`}
      >
        <div className={`min-w-0 ${view === 'individual' ? 'max-md:sr-only' : ''}`}>
          <p className="hud-label">{capitalize(vocab.crew)}</p>
          <h1 className="text-2xl font-semibold">Estado de {vocab.crew}</h1>
        </div>
        {toggle}
      </header>

      {!envId && <p className="text-env-muted">Tu usuario no tiene entorno asignado.</p>}

      {envId && members.state === 'loading' && (
        <ul className="grid gap-3 md:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-28 animate-pulse bg-env-surface" />
          ))}
        </ul>
      )}

      {envId && members.state === 'error' && (
        <div className="hud-panel p-4">
          <p>No se ha podido cargar la lista.</p>
          <button
            type="button"
            onClick={members.retry}
            className="mt-3 rounded-md bg-env-primary px-3 py-1.5 text-sm font-medium text-env-primary-text"
          >
            Reintentar
          </button>
        </div>
      )}

      {members.state === 'ready' && list.length === 0 && (
        <p className="text-env-muted">No hay nadie dado de alta en este entorno.</p>
      )}

      {list.length > 0 && view === 'conjunto' && (
        <CrewOverview members={list} vocabulary={vocab} onOpen={open} />
      )}

      {list.length > 0 && view === 'individual' && (
        <>
          <div className="flex shrink-0 items-start gap-2">
            <button
              type="button"
              onClick={() => show('conjunto')}
              className="flex min-h-11 shrink-0 items-center gap-2 border border-env-border px-3 text-sm whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-env-primary md:hidden"
            >
              <span aria-hidden>←</span> Todos
            </button>
            <MemberStrip
              members={list}
              selectedId={selectedId}
              vocabulary={vocab}
              onSelect={selectMember}
              className="min-w-0 flex-1"
            />
          </div>
          {/* El panel completo del member elegido (el mismo que /dashboard). */}
          {selectedId !== null && selectedId === activeId && <Dashboard key={selectedId} />}
        </>
      )}
    </section>
  )
}
