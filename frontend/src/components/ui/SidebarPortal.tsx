import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Hueco de la barra lateral donde una página puede poner su resumen (p. ej. el estado general). */
export const SIDEBAR_SLOT_ID = 'sidebar-page-slot'

/** Pinta `children` en la barra lateral (Layout), no en el contenido de la página. */
export function SidebarPortal({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById(SIDEBAR_SLOT_ID)), [])
  return slot ? createPortal(children, slot) : null
}
