import type { RefObject } from 'react'
import { useT } from '../../i18n/t'
import { useCanScrollDown } from './scroll'

/**
 * Indicador al pie de un panel con scroll: un degradado y «Más abajo» mientras quede contenido
 * por ver. Pulsarlo baja una pantalla. Va como último hijo del contenedor (`sticky`).
 */
export function ScrollHint({ target }: { target: RefObject<HTMLElement | null> }) {
  const t = useT()
  const more = useCanScrollDown(target)
  if (!more) return null
  return (
    <div className="pointer-events-none sticky bottom-0 flex h-14 items-end justify-center bg-gradient-to-t from-env-surface via-env-surface/85 to-transparent pb-2">
      <button
        type="button"
        onClick={() => {
          const el = target.current
          el?.scrollBy({ top: el.clientHeight * 0.8, behavior: 'smooth' })
        }}
        className="pointer-events-auto flex min-h-9 items-center gap-1.5 border border-env-border bg-env-surface px-3 text-xs font-semibold tracking-[0.12em] text-env-muted uppercase hover:border-env-primary hover:text-env-text"
      >
        <span aria-hidden className="motion-safe:animate-bounce">
          ▾
        </span>
        {t('Más abajo')}
      </button>
    </div>
  )
}
