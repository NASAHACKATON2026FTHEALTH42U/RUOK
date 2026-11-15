import { create } from 'zustand'
import type { IconGlyph } from '../components/ui/Icon'

export type ToastTone = 'info' | 'success' | 'warning' | 'critical'

export interface ToastAction {
  label: string
  /** Ruta a la que lleva (si no, solo ejecuta `onClick` y cierra el aviso). */
  to?: string
  onClick?: () => void
  primary?: boolean
}

export interface Toast {
  id: number
  tone: ToastTone
  icon: IconGlyph
  /** Etiqueta corta de arriba: el tipo de aviso o el entorno. */
  label: string
  title: string
  body?: string
  meta?: string
  actions?: ToastAction[]
  /** Se queda hasta que se cierra (alertas y notificaciones); si no, desaparece sola. */
  sticky?: boolean
  /** Lleva el interruptor de sonido (avisos de alertas). */
  sound?: boolean
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => number
  dismiss: (id: number) => void
}

let nextId = 1

/** Avisos emergentes de toda la app (los pinta `Toaster`, abajo a la derecha). Como mucho, 4. */
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-4) }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const pushToast = (toast: Omit<Toast, 'id'>) => useToasts.getState().push(toast)
