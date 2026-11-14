import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Hueco de la barra superior de escritorio (Layout) donde una página puede poner su resumen
 * (p. ej. el estado general y los avisos del panel).
 */
export const TOPBAR_SLOT_ID = 'topbar-page-slot'

/** Pinta `children` en la barra superior de escritorio (Layout), no en el contenido de la página. */
export function TopBarPortal({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById(TOPBAR_SLOT_ID)), [])
  return slot ? createPortal(children, slot) : null
}
