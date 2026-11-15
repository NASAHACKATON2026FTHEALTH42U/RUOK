import { useMemo } from 'react'
import { dateLocale, useLangStore } from '../i18n/lang'
import { translate } from '../i18n/t'
import { DEFAULT_VOCABULARY, useEnvironmentStore, type Vocabulary } from '../store/environment'

/**
 * Textos del entorno activo (astronauta, paciente, residente…).
 * Nunca escribas "astronauta" fijo en un componente: usa este hook.
 *
 * Sin plurales ni artículos generados en código: si hacen falta, se añaden al contrato
 * (`Environment.vocabulary`). Mientras tanto, redacta sin artículo ("Consola de {ground}").
 *
 * El vocabulario lo traduce el servidor (FE-38); aquí solo se traducen los términos neutros de
 * `DEFAULT_VOCABULARY` (sin entorno elegido), que son del cliente.
 */
export function useVocab(): Vocabulary {
  const vocabulary = useEnvironmentStore((s) => s.vocabulary)
  const lang = useLangStore((s) => s.lang)
  return useMemo(() => {
    let out: Vocabulary | null = null
    for (const key of ['member', 'crew', 'ground'] as const) {
      if (vocabulary[key] === DEFAULT_VOCABULARY[key]) {
        out ??= { ...vocabulary }
        out[key] = lang === 'es' ? DEFAULT_VOCABULARY[key] : translate(DEFAULT_VOCABULARY[key])
      }
    }
    return out ?? vocabulary
  }, [vocabulary, lang])
}

/** Para empezar una frase: capitalize('astronauta') → 'Astronauta'. */
export function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase(dateLocale()) + word.slice(1)
}
