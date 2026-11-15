import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  /**
   * Escape lo cierra (y se llama a `onClose`). Sin `onClose`, el modal no se puede cerrar con
   * Escape: hay que resolverlo con sus propios botones (p. ej. el «R U OK?»).
   */
  onClose?: () => void
  /** `alertdialog` para los que piden una respuesta urgente (SOS, «R U OK?»). */
  role?: 'dialog' | 'alertdialog'
  labelledBy?: string
  describedBy?: string
  /** Fondo oscuro (`::backdrop`). `false` si el modal pinta el suyo (p. ej. con animación). */
  backdrop?: boolean
  children: ReactNode
}

/**
 * Modal bloqueante sobre el `<dialog>` nativo con `showModal()`: el resto de la interfaz queda
 * inerte (no se puede pulsar ni tabular) hasta que el modal se resuelve o se cierra. Un clic
 * fuera no cierra nada. El foco va al elemento con `data-autofocus` (si no, al primero que se
 * pueda enfocar) y, al cerrar, vuelve a donde estaba.
 *
 * El `<dialog>` ocupa toda la ventana y es transparente: cada modal pinta su caja (centrada,
 * hoja inferior en móvil o pantalla completa).
 */
export function Modal({
  onClose,
  role = 'dialog',
  labelledBy,
  describedBy,
  backdrop = true,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) {
      // Sin `showModal` (navegadores muy antiguos, jsdom): al menos se ve.
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      // Escape: el navegador lanza `cancel`. Se cierra desde React (o no se cierra).
      onCancel={(e) => {
        e.preventDefault()
        onCloseRef.current?.()
      }}
      // El evento `close` llega después, en otra tarea. Se ignora si el diálogo ya está abierto
      // otra vez (React en modo estricto monta, desmonta y vuelve a montar) o si ya se desmontó.
      // Si no, es Chrome cerrándolo tras varios Escape seguidos: se avisa a React o se reabre.
      onClose={() => {
        const dialog = ref.current
        if (!dialog || dialog.open || !dialog.isConnected) return
        if (onCloseRef.current) onCloseRef.current()
        else dialog.showModal()
      }}
      className={`fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-transparent p-0 text-env-text ${
        backdrop ? 'backdrop:bg-black/60' : 'backdrop:bg-transparent'
      }`}
    >
      {children}
    </dialog>
  )
}
