import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  classifyResponse,
  PVT_MODES,
  randomIsi,
  summarize,
  type PvtMode,
  type PvtSummary,
} from './pvt'
import { useT } from '../../i18n/t'
import { Modal } from '../ui/Modal'
import { Icon } from '../ui/Icon'

/** Cuánto se muestra el resultado de cada respuesta antes de la siguiente espera. */
const FEEDBACK_MS = 800
/** Sin respuesta en este tiempo, el estímulo se da por perdido (cuenta como lapso). */
const STIMULUS_TIMEOUT_MS = 10_000

type View =
  { kind: 'waiting' } | { kind: 'stimulus' } | { kind: 'feedback'; rt: number } | { kind: 'early' }

interface PvtRunnerProps {
  mode: PvtMode
  onFinish: (summary: PvtSummary) => void
  onCancel: () => void
}

/**
 * Ejecuta el PVT a pantalla completa. Espera aleatoria de 2–10 s → aparece el estímulo →
 * se mide con `performance.now()` hasta el `pointerdown` (o la barra espaciadora).
 * Pulsar durante la espera es un falso inicio y reinicia la espera.
 * El test acaba al terminar la duración del modo (sin cortar un estímulo en pantalla).
 */
export function PvtRunner({ mode, onFinish, onCancel }: PvtRunnerProps) {
  const t = useT()
  const durationMs = PVT_MODES[mode].durationMs
  const [view, setView] = useState<View>({ kind: 'waiting' })
  const [remainingMs, setRemainingMs] = useState<number>(durationMs)

  const startRef = useRef(performance.now())
  const onsetRef = useRef<number | null>(null)
  const rtsRef = useRef<number[]>([])
  const earlyRef = useRef(0)
  const doneRef = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    finishRef.current(summarize(rtsRef.current, earlyRef.current))
  }, [])

  // Cuenta atrás visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingMs(Math.max(0, durationMs - (performance.now() - startRef.current)))
    }, 250)
    return () => window.clearInterval(id)
  }, [durationMs])

  // Hora de aparición del estímulo: en el siguiente frame, lo más cerca posible de que se pinte.
  useLayoutEffect(() => {
    if (view.kind !== 'stimulus') return
    onsetRef.current = null
    const raf = requestAnimationFrame(() => {
      onsetRef.current = performance.now()
    })
    return () => cancelAnimationFrame(raf)
  }, [view])

  // Máquina de estados con temporizadores.
  useEffect(() => {
    let t: number | undefined
    if (view.kind === 'waiting') {
      if (performance.now() - startRef.current >= durationMs) {
        finish()
        return
      }
      t = window.setTimeout(() => setView({ kind: 'stimulus' }), randomIsi())
    } else if (view.kind === 'stimulus') {
      t = window.setTimeout(() => {
        rtsRef.current.push(STIMULUS_TIMEOUT_MS)
        setView({ kind: 'feedback', rt: STIMULUS_TIMEOUT_MS })
      }, STIMULUS_TIMEOUT_MS)
    } else {
      t = window.setTimeout(() => setView({ kind: 'waiting' }), FEEDBACK_MS)
    }
    return () => window.clearTimeout(t)
  }, [view, durationMs, finish])

  const respond = useCallback(() => {
    if (view.kind === 'waiting') {
      earlyRef.current += 1
      setView({ kind: 'early' })
    } else if (view.kind === 'stimulus') {
      const onset = onsetRef.current
      // Si aún no se ha pintado el estímulo, es una anticipación (rt 0 → falso inicio).
      const rt = onset === null ? 0 : Math.round(performance.now() - onset)
      rtsRef.current.push(rt)
      setView({ kind: 'feedback', rt })
    }
  }, [view])

  // Barra espaciadora en ordenador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault()
        respond()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [respond])

  const secs = Math.ceil(remainingMs / 1000)
  const progress = 1 - remainingMs / durationMs

  return (
    // Modal bloqueante: hasta acabar o cancelar (botón o Escape) no se puede usar nada más.
    // El foco va al lienzo (no al botón Cancelar), para que la barra espaciadora responda.
    <Modal labelledBy="pvt-title" onClose={onCancel}>
      <div
        data-autofocus
        tabIndex={-1}
        className={`flex min-h-full touch-manipulation flex-col outline-none select-none ${
          view.kind === 'stimulus'
            ? 'bg-env-primary text-env-primary-text'
            : 'bg-env-bg text-env-text'
        }`}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-pvt-cancel]')) return
          e.preventDefault()
          respond()
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <h2 id="pvt-title" className="sr-only">
          {t('Test de vigilancia')}
        </h2>
        <div className="flex items-center justify-between gap-3 p-4 text-sm">
          <span className="tabular-nums" aria-label={t('Quedan {n} segundos', { n: secs })}>
            <Icon name="timer" size={16} /> {secs} s
          </span>
          <button
            type="button"
            data-pvt-cancel
            onClick={onCancel}
            className=" border border-current/40 px-3 py-1.5"
          >
            {t('Cancelar')}
          </button>
        </div>
        <div className="mx-4 h-1 overflow-hidden rounded-full bg-env-border" aria-hidden>
          <div className="h-full bg-env-text/60" style={{ width: `${progress * 100}%` }} />
        </div>

        <div
          className="flex flex-1 flex-col items-center justify-center p-6 text-center"
          aria-live="assertive"
        >
          {view.kind === 'waiting' && (
            <>
              <span aria-hidden className="h-24 w-24 rounded-full border-4 border-env-border" />
              <p className="mt-6 text-lg text-env-muted">
                {t('Espera… pulsa en cuanto cambie la pantalla')}
              </p>
            </>
          )}
          {view.kind === 'stimulus' && <p className="text-5xl font-bold">{t('¡Pulsa!')}</p>}
          {view.kind === 'feedback' && (
            <>
              <p className="text-5xl font-bold tabular-nums">{view.rt} ms</p>
              <p className="mt-2 text-env-muted">
                {classifyResponse(view.rt) === 'lapse'
                  ? t('Lapso (más de 500 ms)')
                  : classifyResponse(view.rt) === 'false_start'
                    ? t('Demasiado rápido: falso inicio')
                    : t('Bien')}
              </p>
            </>
          )}
          {view.kind === 'early' && (
            <>
              <p className="text-3xl font-bold">{t('Demasiado pronto')}</p>
              <p className="mt-2 text-env-muted">
                {t('Falso inicio: espera a que cambie la pantalla')}
              </p>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
