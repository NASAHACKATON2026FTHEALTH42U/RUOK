import { ControlHeader } from '../../components/control/ControlHeader'
import { UsersPanel } from '../../components/control/UsersPanel'
import { useControlScope } from '../../components/control/useControlScope'
import { useT } from '../../i18n/t'

/** Usuarios (FS-07, solo admin): las cuentas del entorno activo. */
export default function ControlUsers() {
  const t = useT()
  const { env } = useControlScope()
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <ControlHeader
        title={t('Usuarios')}
        subtitle={t('Cuentas de {env}: alta y activación.', { env: env?.name ?? t('el entorno') })}
      />
      {env ? (
        <UsersPanel env={env} />
      ) : (
        <p className="text-env-muted">{t('Elige un entorno para gestionar sus usuarios.')}</p>
      )}
    </section>
  )
}
