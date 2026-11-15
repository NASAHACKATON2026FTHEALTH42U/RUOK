import { useCallback, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/**
 * Textarea que crece con lo que se escribe y no se puede agrandar con el ratón. Siempre tiene un
 * alto mínimo (las líneas de `rows`, 3 por defecto), también vacío o dentro de un modal que aún no
 * se ha abierto. Todos los campos de texto largo de la app usan este.
 */
export function AutoTextarea({
  className = '',
  onInput,
  value,
  rows = 3,
  style,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const lastWidth = useRef(0)

  const fit = useCallback(() => {
    const el = ref.current
    if (!el) return
    // Vuelve al alto base (el mínimo) y, si el texto no cabe, crece hasta mostrarlo entero.
    el.style.removeProperty('height')
    if (el.clientWidth === 0) return // oculto (p. ej. un modal sin abrir): se mide al mostrarse
    const borders = el.offsetHeight - el.clientHeight // scrollHeight no incluye los bordes
    const wanted = el.scrollHeight + borders
    if (wanted > el.offsetHeight) el.style.setProperty('height', `${wanted}px`, 'important')
  }, [])

  // Al montar y al cambiar el valor desde fuera (enviar, vaciar).
  useLayoutEffect(fit, [value, fit])
  // Al mostrarse o cambiar de ancho (las líneas se reparten distinto).
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth.current) return
      lastWidth.current = el.clientWidth
      fit()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fit])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      onInput={(e) => {
        fit()
        onInput?.(e)
      }}
      className={`resize-none overflow-hidden ${className}`}
      // Alto mínimo explícito: algunas clases fijan el alto y `rows` dejaría de contar.
      style={{ minHeight: `calc(${rows} * 1.45em + 1.5rem)`, ...style }}
      {...props}
    />
  )
}
