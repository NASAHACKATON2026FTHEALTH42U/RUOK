import { useEffect, useState, type RefObject } from 'react'

/** ¿Queda contenido por debajo en este contenedor con scroll? Se recalcula al hacer scroll o al
 * cambiar su tamaño o su contenido (p. ej. al desplegar una sección). */
export function useCanScrollDown(ref: RefObject<HTMLElement | null>): boolean {
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    const mo = new MutationObserver(check)
    mo.observe(el, { childList: true, subtree: true })
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
      mo.disconnect()
    }
  }, [ref])
  return more
}

/** Tras desplegar una sección, la lleva a la vista dentro de su panel (suave si se puede). */
export function revealSection(el: HTMLElement | null) {
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.requestAnimationFrame(() =>
    el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }),
  )
}
