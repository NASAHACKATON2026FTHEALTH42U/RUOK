import { create } from 'zustand'

/**
 * Idioma de la interfaz (FE-38). Español por defecto; se guarda en el dispositivo (no es un dato
 * de salud) y se elige en Ajustes o en el login. Al cambiarlo, la app se vuelve a montar y el
 * servidor responde a `Accept-Language` con los catálogos en ese idioma.
 */
export type Lang = 'es' | 'en'

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
]

export const LANG_KEY = 'ruok.lang'

function initial(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === 'en' || v === 'es') return v
  } catch {
    // sin almacenamiento (modo privado): español
  }
  return 'es'
}

interface LangState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useLangStore = create<LangState>((set) => ({
  lang: initial(),
  setLang: (lang) => {
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      // sin almacenamiento: vale para esta sesión
    }
    if (typeof document !== 'undefined') document.documentElement.lang = lang
    set({ lang })
  },
}))

/** Idioma activo (fuera de React). */
export const currentLang = (): Lang => useLangStore.getState().lang

/** Locale para fechas y números (`toLocaleString`, `Intl`). */
export const dateLocale = (): string => (currentLang() === 'en' ? 'en-GB' : 'es-ES')

if (typeof document !== 'undefined') document.documentElement.lang = initial()
