import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { SessionMenu } from '../components/auth/SessionMenu'
import { MemberActivitySelector } from '../components/liveness/LivenessGuard'
import { ScopeSelector } from '../components/ui/ScopeSelector'
import { LinkStatusChip } from '../components/ui/LinkStatusChip'
import { ChevronIcon } from '../components/ui/NavIcon'
import { allowedItems, menuFor, navItems, tabsFor } from '../components/ui/navigation'
import { PendingSyncChip } from '../components/ui/PendingSyncChip'
import { ServerStatus } from '../components/ui/ServerStatus'
import { useVocab } from '../environments/useVocab'
import { useT } from '../i18n/t'
import { getDevice } from '../offline/device'

/**
 * «Más» (maqueta `More`): las secciones que no están en las pestañas del rol, la actividad
 * (Normal / EVA / Sueño), el estado de la conexión y la sesión. En móvil sustituye al cajón.
 */
export default function More() {
  const t = useT()
  const vocab = useVocab()
  const { role, can } = useAuth()
  const device = getDevice()
  const allowed = menuFor(role, allowedItems(navItems(vocab), can))
  const inTabs = new Set(tabsFor(role, allowed).map((tab) => tab.to))
  const rest = allowed.filter((i) => !inTabs.has(i.to))

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3">
      <h1 className="text-[1.375rem] font-light">{t('Más')}</h1>

      {rest.length > 0 && (
        <nav aria-label={t('Secciones')} className="hud-panel">
          <ul>
            {rest.map((item, i) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`hud-row !min-h-[46px] hover:text-env-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary ${
                    i === rest.length - 1 ? '!border-b-0' : ''
                  }`}
                >
                  <span className="flex-1">{item.label}</span>
                  <ChevronIcon />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <MemberActivitySelector />

      <ScopeSelector />

      <section aria-label={t('Estado del dispositivo')} className="hud-panel">
        <div className="hud-panel-head">{t('Conexión')}</div>
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-3 text-xs">
          <ServerStatus />
          <LinkStatusChip />
          <PendingSyncChip />
        </div>
      </section>

      {/* Sesión: quién ha entrado y «Salir», bien visible (en móvil no hay barra superior). */}
      <section aria-label={t('Sesión')} className="hud-panel">
        <div className="hud-panel-head">{t('Sesión')}</div>
        <div className="flex flex-col gap-3 px-3.5 py-3">
          <SessionMenu part="user" />
          <SessionMenu part="logout" block />
        </div>
      </section>

      <p className="px-1 text-center text-sm text-env-muted">
        {t('Prototipo de autoevaluación.')} <strong>{t('No es un dispositivo médico')}</strong>{' '}
        {t('ni sustituye el criterio de un profesional sanitario.')}
        {device.mode === 'tab' && (
          <span className="mt-1 block" title={device.id}>
            {t('Dispositivo: {name}', {
              name: device.name ?? t('pestaña {id}', { id: device.id.slice(0, 8) }),
            })}
          </span>
        )}
      </p>
    </section>
  )
}
