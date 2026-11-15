import { animate, useReducedMotion } from 'framer-motion'
import { useLayoutEffect, useRef } from 'react'
import { dateLocale } from '../../i18n/lang'

const fmt = (n: number) => Math.round(n).toLocaleString(dateLocale())

/**
 * Número que cuenta hasta su nuevo valor (los puntos al completar una tarea, FE-18).
 * El texto lo escribe solo este efecto (React no renderiza hijos), para que la animación y
 * React no se pisen el mismo nodo de texto.
 */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const from = shown.current
    if (from === null || reduce || from === value) {
      el.textContent = fmt(value)
      shown.current = value
      return
    }
    const controls = animate(from, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => {
        el.textContent = fmt(v)
        shown.current = v
      },
    })
    return () => controls.stop()
  }, [value, reduce])

  return <span ref={ref} aria-label={fmt(value)} className={`tabular-nums ${className ?? ''}`} />
}
