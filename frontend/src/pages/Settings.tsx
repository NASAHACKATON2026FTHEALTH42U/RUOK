import { useT } from '../i18n/t'
import { LanguageSwitch } from '../i18n/LanguageSwitch'
import { setVoicePref, useVoicePref } from '../components/behavioral/useVoice'

/**
 * Ajustes (FE-38): preferencias de este dispositivo. Idioma de la interfaz y voz guía. Se
 * guardan en el dispositivo (no son datos de salud) y valen para cualquier usuario que entre en él.
 */
export default function Settings() {
  const t = useT()
  const voice = useVoicePref()
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-3">
      <h1 className="text-2xl font-semibold">{t('Ajustes')}</h1>

      <section aria-labelledby="settings-lang" className="hud-panel">
        <h2 id="settings-lang" className="hud-panel-head">
          {t('Idioma')}
        </h2>
        <div className="flex flex-col gap-2 px-4 py-3">
          <LanguageSwitch />
          <p className="text-sm text-env-muted">
            {t(
              'Cambia los textos de la app y de los catálogos del servidor. Los datos y mensajes ya guardados se quedan en su idioma.',
            )}
          </p>
        </div>
      </section>

      <section aria-labelledby="settings-voice" className="hud-panel">
        <h2 id="settings-voice" className="hud-panel-head">
          {t('Voz guía')}
        </h2>
        <label className="flex min-h-12 items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm">
            {t('Leer en voz alta los pasos guiados, las preguntas y los protocolos')}
          </span>
          <input
            type="checkbox"
            checked={voice}
            onChange={(e) => setVoicePref(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--env-primary)]"
          />
        </label>
      </section>

      <p className="px-1 text-xs text-env-muted">
        {t('Estos ajustes se guardan en este dispositivo.')}
      </p>
    </section>
  )
}
