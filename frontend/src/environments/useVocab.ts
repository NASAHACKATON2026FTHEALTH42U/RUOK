import { useEnvironmentStore, type Vocabulary } from '../store/environment'

/**
 * Textos del entorno activo (astronauta, paciente, residente…).
 * Nunca escribas "astronauta" fijo en un componente: usa este hook.
 *
 * Sin plurales ni artículos generados en código: si hacen falta, se añaden al contrato
 * (`Environment.vocabulary`). Mientras tanto, redacta sin artículo ("Consola de {ground}").
 */
export function useVocab(): Vocabulary {
  return useEnvironmentStore((s) => s.vocabulary)
}

/** Para empezar una frase: capitalize('astronauta') → 'Astronauta'. */
export function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase('es') + word.slice(1)
}
