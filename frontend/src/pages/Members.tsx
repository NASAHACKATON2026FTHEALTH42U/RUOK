import { useNavigate } from 'react-router-dom'
import { MemberList } from '../components/environment/MemberList'
import { capitalize, useVocab } from '../environments/useVocab'
import { useEnvironmentStore } from '../store/environment'

/** Members del entorno (vista inicial de medic y commander, FE-27). Elegir uno → su dashboard. */
export default function Members() {
  const vocab = useVocab()
  const envId = useEnvironmentStore((s) => s.envId)
  const selectMember = useEnvironmentStore((s) => s.selectMember)
  const navigate = useNavigate()

  return (
    <section className="space-y-4">
      <p className="text-sm font-medium tracking-wide text-env-muted uppercase">
        {capitalize(vocab.crew)}
      </p>
      <h1 className="text-2xl font-semibold">Estado de {vocab.crew}</h1>
      {envId ? (
        <MemberList
          envId={envId}
          vocabulary={vocab}
          onSelect={(id) => {
            selectMember(id)
            navigate('/dashboard')
          }}
        />
      ) : (
        <p className="text-env-muted">Tu usuario no tiene entorno asignado.</p>
      )}
    </section>
  )
}
