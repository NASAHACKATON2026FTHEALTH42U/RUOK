import { EN } from './en'
import { currentLang, useLangStore } from './lang'

/** Valores para los huecos `{nombre}` del texto. */
export type Vars = Record<string, string | number>

/**
 * Traduce un texto de la interfaz (FE-38). La clave es **el propio texto en español**: en español
 * se devuelve tal cual y en inglés, su entrada de `src/i18n/en/*.ts` (si falta, el español: nunca
 * un hueco vacío). Los huecos `{n}` se rellenan con `vars`.
 *
 *     t('Hace {n} min', { n: 5 })   // «Hace 5 min» | «5 min ago»
 *
 * Fuera de React (formateadores, avisos), `translate`; en componentes, `useT()` (re-renderiza al
 * cambiar de idioma).
 */
export function translate(es: string, vars?: Vars): string {
  let text = currentLang() === 'en' ? (EN[es] ?? es) : es
  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (hole: string, key: string) =>
      key in vars ? String(vars[key]) : hole,
    )
  }
  return text
}

/** `t` para componentes: se suscribe al idioma. */
export function useT(): typeof translate {
  useLangStore((s) => s.lang)
  return translate
}
