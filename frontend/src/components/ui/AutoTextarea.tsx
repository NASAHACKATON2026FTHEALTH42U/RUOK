import { useCallback, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/**
 * Textarea que crece con lo que se escribe (desde `rows` líneas como mínimo) y no se puede
 * agrandar con el ratón. Todos los campos de texto largo de la app usan este.
 */
export function AutoTextarea({
  className = '',
  onInput,
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fit = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('height', 'auto')
    // scrollHeight no incluye los bordes: se suman para que no aparezca scroll.
    const borders = el.offsetHeight - el.clientHeight
    el.style.setProperty('height', `${el.scrollHeight + borders}px`, 'important')
  }, [])
  // Al cambiar el valor desde fuera (enviar, vaciar) y al montar.
  useLayoutEffect(fit, [value, fit])

  return (
    <textarea
      ref={ref}
      value={value}
      onInput={(e) => {
        fit()
        onInput?.(e)
      }}
      className={`resize-none overflow-hidden ${className}`}
      {...props}
    />
  )
}
