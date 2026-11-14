import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Activity } from '../components/liveness/heartbeat'
import { getDevice } from '../offline/device'

interface ActivityState {
  /** Actividad que se envía en el heartbeat (FE-15): cambia los umbrales de liveness del servidor. */
  activity: Activity
  setActivity: (a: Activity) => void
}

/** Actividad actual de este dispositivo (normal, EVA o sueño). Se recuerda al recargar. */
export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      activity: 'normal',
      setActivity: (activity) => set({ activity }),
    }),
    {
      // Por dispositivo, igual que la sesión: dos pestañas ?device=a y ?device=b no la comparten.
      name: `ruok-activity-${getDevice().id}`,
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
