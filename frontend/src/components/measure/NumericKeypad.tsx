import { useT } from '../../i18n/t'
import { Icon } from '../ui/Icon'

const KEY =
  'flex h-12 items-center justify-center border border-env-border bg-env-bg text-2xl tabular-nums transition-colors select-none md:h-14 hover:border-env-text hover:bg-env-primary/10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary active:bg-env-primary/25 disabled:opacity-40'

/**
 * Teclado numérico en pantalla: teclas grandes para escribir un valor sin abrir el teclado del
 * dispositivo (que sigue funcionando: son dos formas de escribir en el mismo campo). Las teclas no
 * quitan el foco del campo (`onPointerDown` lo evita), así que se puede alternar con el teclado.
 */
export function NumericKeypad({
  onKey,
  decimal,
  disabled = false,
  label,
}: {
  onKey: (key: string) => void
  decimal: boolean
  disabled?: boolean
  label?: string
}) {
  const t = useT()
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', decimal ? ',' : 'clear', '0', 'back']
  return (
    <div
      role="group"
      aria-label={label ?? t('Teclado numérico')}
      className="grid grid-cols-3 gap-1.5 md:gap-2"
    >
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onKey(k)}
          aria-label={
            k === 'back'
              ? t('Borrar el último dígito')
              : k === 'clear'
                ? t('Vaciar')
                : k === ','
                  ? t('Coma decimal')
                  : undefined
          }
          className={`${KEY} ${k === 'clear' ? '!text-sm tracking-wide text-env-muted uppercase' : ''}`}
        >
          {k === 'back' ? <Icon name="backspace" size={26} /> : k === 'clear' ? t('Vaciar') : k}
        </button>
      ))}
    </div>
  )
}
