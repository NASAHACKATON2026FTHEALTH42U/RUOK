import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Schema } from '../api/client'

/**
 * Textos visibles que dependen del entorno (`Environment.vocabulary`).
 * El contrato lo define como diccionario abierto (member, crew, ground y roles como medic o
 * commander); aquí se garantizan las tres claves que usa toda la UI.
 */
export type Vocabulary = Schema<'Environment'>['vocabulary'] & {
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
  envId: string | null
  /** Member activo. Cada entorno tiene sus propios members, así que se borra al cambiar de entorno. */
  memberId: number | null
  /** Vocabulario del entorno activo. Siempre se actualiza a la vez que `envId`. */
  vocabulary: Vocabulary
  /** Cambia de entorno: actualiza `envId` y `vocabulary` juntos y deselecciona el member. */
  selectEnvironment: (env: Pick<Schema<'Environment'>, 'id' | 'vocabulary'>) => void
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
          // Si falta alguna clave, se usa el término neutro en lugar de `undefined`.
          vocabulary: { ...DEFAULT_VOCABULARY, ...env.vocabulary },
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
