import { create } from 'zustand'
import type { EnvironmentId } from '../environments'

interface EnvironmentState {
  /** Entorno activo. `null` hasta que se elige en la pantalla de selección. */
  envId: EnvironmentId | null
  setEnvId: (envId: EnvironmentId) => void
}

export const useEnvironmentStore = create<EnvironmentState>((set) => ({
  envId: null,
  setEnvId: (envId) => set({ envId }),
}))
