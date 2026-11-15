import { ControlHeader } from '../../components/control/ControlHeader'
import { UsersPanel } from '../../components/control/UsersPanel'
import { useControlScope } from '../../components/control/useControlScope'

/** Usuarios (FS-07, solo admin): las cuentas del entorno activo. */
export default function ControlUsers() {
  const { env } = useControlScope()
  return (
    <section className="flex flex-col gap-4">
      <ControlHeader
        title="Usuarios"
        subtitle={`Cuentas de ${env?.name ?? 'el entorno'}: alta y activación.`}
      />
      {env ? (
        <UsersPanel env={env} />
      ) : (
        <p className="text-env-muted">Elige un entorno para gestionar sus usuarios.</p>
      )}
    </section>
  )
}
