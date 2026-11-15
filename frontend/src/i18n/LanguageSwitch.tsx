import { LANGS, useLangStore } from './lang'

/**
 * Selector de idioma (ES / EN): botones segmentados. En Ajustes y, compacto, en el login.
 * Los nombres de los idiomas van siempre en su propio idioma.
 */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const lang = useLangStore((s) => s.lang)
  const setLang = useLangStore((s) => s.setLang)
  return (
    <div role="radiogroup" aria-label="Idioma / Language" className="flex gap-2">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={lang === l.id}
          lang={l.id}
          onClick={() => setLang(l.id)}
          className={`hud-btn ${compact ? '!h-9 px-3 !text-xs' : '!h-11 flex-1 px-4'} ${
            lang === l.id ? 'hud-btn-primary' : ''
          }`}
        >
          {compact ? l.id.toUpperCase() : l.label}
        </button>
      ))}
    </div>
  )
}
