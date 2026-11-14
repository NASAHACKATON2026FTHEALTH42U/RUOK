import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { EnvironmentId } from '../environments'

/**
 * Textos visibles que dependen del entorno (api-contract.md → `Environment.vocabulary`).
 *
 * TODO(FS-03): sustituir por `components['schemas']['Environment']['vocabulary']` de types.gen.ts.
 */
export interface Vocabulary {
  member: string
  crew: string
  ground: string
}

/** Vocabulario neutro mientras no hay entorno elegido: la UI nunca dice "astronauta" por defecto. */
export const DEFAULT_VOCABULARY: Vocabulary = {
  member: 'persona',
  crew: 'equipo',
  ground: 'control externo',
}

interface EnvironmentState {
  /** Entorno activo. `null` hasta que se elige en la pantalla de selección. */
  envId: EnvironmentId | null
  /** Member activo. Cada entorno tiene sus propios members, así que se borra al cambiar de entorno. */
  memberId: number | null
  /** Vocabulario del entorno activo. Siempre se actualiza a la vez que `envId`. */
  vocabulary: Vocabulary
  /** Cambia de entorno: actualiza `envId` y `vocabulary` juntos y deselecciona el member. */
  selectEnvironment: (env: { id: EnvironmentId; vocabulary: Vocabulary }) => void
  selectMember: (memberId: number) => void
}

export const useEnvironmentStore = create<EnvironmentState>()(
  persist(
    (set) => ({
      envId: null,
      memberId: null,
      vocabulary: DEFAULT_VOCABULARY,
      selectEnvironment: (env) =>
        set((state) => ({
          envId: env.id,
          vocabulary: { ...env.vocabulary },
          memberId: state.envId === env.id ? state.memberId : null,
        })),
      selectMember: (memberId) => set({ memberId }),
    }),
    {
      // Se recuerda la sesión al recargar la tablet, también sin conexión.
      name: 'ruok-session',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ envId, memberId, vocabulary }) => ({ envId, memberId, vocabulary }),
    },
  ),
)
