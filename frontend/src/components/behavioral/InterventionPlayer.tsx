import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Intervention } from '../../api/useInterventions'
import { Modal } from '../ui/Modal'
import { breathPhase, expandSteps } from './intervention'

interface InterventionPlayerProps {
  intervention: Intervention
  onClose: () => void
}

/** Escala del círculo según la fase: inhala crece, exhala encoge, mantén se queda (null). */
const SCALE = { in: 1, hold: null, out: 0.55 } as const

function targetScale(text: string | undefined): number | null {
  const p = text ? breathPhase(text) : null
  return p ? SCALE[p] : null
}

/**
 * Modo guiado de una intervención (FE-20), a pantalla completa: paso actual en grande,
 * cuenta atrás en los pasos con tiempo (avanza solo), "Siguiente" en los manuales y, en
 * los de respiración, un círculo que crece al inhalar y encoge al exhalar (sin animación si
 * el sistema pide movimiento reducido). Todo en local: funciona sin conexión.
 */
export function InterventionPlayer({ intervention, onClose }: InterventionPlayerProps) {
  const steps = useMemo(() => expandSteps(intervention.steps), [intervention.steps])
  const [index, setIndex] = useState(0)
  const [left, setLeft] = useState<number | null>(steps[0]?.seconds ?? null)
  const [paused, setPaused] = useState(false)
  const [scale, setScale] = useState(() => targetScale(steps[0]?.text) ?? 0.55)
  const reduce = useReducedMotion()

  const done = index >= steps.length
  const step = done ? null : steps[index]
  const phase = step ? breathPhase(step.text) : null

  /** Pasa al paso `n`: reinicia la cuenta atrás y el objetivo del círculo. */
  const goTo = useCallback(
    (n: number) => {
      setIndex(n)
      setLeft(steps[n]?.seconds ?? null)
      const target = targetScale(steps[n]?.text)
      if (target !== null) setScale(target)
    },
    [steps],
  )

  // Cuenta atrás: un tic por segundo; al acabar el paso, el siguiente.
  useEffect(() => {
    if (done || paused || left === null) return
    const t = window.setTimeout(() => (left <= 1 ? goTo(index + 1) : setLeft(left - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [left, paused, done, index, goTo])

  const next = () => goTo(index + 1)

  return (
    // Modal bloqueante: hasta terminar (botón o Escape) no se puede usar nada más.
    <Modal labelledBy="intervention-title" onClose={onClose}>
      <div className="flex min-h-full flex-col bg-env-bg text-env-text">
        <div className="flex items-center justify-between gap-3 p-4">
          <h2 id="intervention-title" className="font-semibold">
            {intervention.title}
          </h2>
          <button
            data-autofocus
            type="button"
            onClick={onClose}
            className="rounded-lg border border-env-border px-3 py-1.5 text-sm hover:border-env-text"
          >
            {done ? 'Cerrar' : 'Terminar'}
          </button>
        </div>
        <div className="mx-4 h-1 overflow-hidden rounded-full bg-env-border" aria-hidden>
          <div
            className="h-full bg-env-primary transition-[width]"
            style={{
              width: `${(Math.min(index, steps.length) / Math.max(steps.length, 1)) * 100}%`,
            }}
          />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
          {done ? (
            <>
              <p className="text-4xl font-bold">Hecho</p>
              <p className="text-env-muted">Bien hecho. Puedes repetirla cuando lo necesites.</p>
            </>
          ) : (
            <>
              {phase && (
                <motion.div
                  aria-hidden
                  className="h-48 w-48 rounded-full bg-env-primary/25 ring-4 ring-env-primary"
                  initial={{ scale: 0.55 }}
                  animate={{ scale: reduce ? 0.8 : scale }}
                  transition={{
                    duration: reduce ? 0 : (step?.seconds ?? 1),
                    ease: 'easeInOut',
                  }}
                />
              )}
              <div aria-live="polite">
                <p className="text-3xl font-semibold">{step?.text}</p>
                {step?.cycle && (
                  <p className="mt-2 text-sm text-env-muted">
                    Ciclo {step.cycle.n} de {step.cycle.of}
                  </p>
                )}
              </div>
              {left !== null && (
                <p
                  className="text-5xl font-bold tabular-nums"
                  aria-label={`Quedan ${left} segundos`}
                >
                  {left}
                </p>
              )}
              <div className="flex gap-3">
                {left !== null && (
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="rounded-lg border border-env-border px-5 py-2.5 hover:border-env-text"
                  >
                    {paused ? 'Seguir' : 'Pausa'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  className="rounded-lg bg-env-primary px-5 py-2.5 font-medium text-env-primary-text"
                >
                  {index === steps.length - 1 ? 'Terminar' : 'Siguiente'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
