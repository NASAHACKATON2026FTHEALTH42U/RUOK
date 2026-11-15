import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Intervention } from '../../api/useInterventions'
import { useT } from '../../i18n/t'
import { Modal } from '../ui/Modal'
import { breathPhase, expandSteps } from './intervention'
import { useVoiceAvailable, useVoicePref } from './useVoice'
import { VOICE_NOTE } from './voice'
import { VoiceToggle } from './VoiceControls'
import { speakToEnd, stopSpeaking } from './voiceGuide'

interface InterventionPlayerProps {
  intervention: Intervention
  onClose: () => void
  /** Al pasar de paso o terminar (no al abrir): p. ej. la campana de la meditación. */
  onStepChange?: (index: number, done: boolean) => void
  /** Controles extra en la cabecera (p. ej. cambiar de paisaje sonoro sin salir). */
  toolbar?: ReactNode
  /** Espera antes de la primera frase de la voz guía (p. ej. tras la campana). */
  voiceDelayMs?: number
  /** Con la voz guía activa, una frase sin audio (p. ej. la meditación toca la campana). */
  onVoiceMissing?: () => void
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
 *
 * Voz guía (FE-37): si hay audio para sus pasos, la cabecera tiene el interruptor «Voz guía» y,
 * con él encendido, cada paso se lee al mostrarse; la voz se para al cambiar de paso o al salir.
 */
/** Paso sin cuenta atrás: avanza solo si no se pulsa «Siguiente» en este tiempo. */
const AUTO_NEXT_MS = 3000
/** Al terminar, tiempo con «Hecho» antes de cerrarse solo. */
const AUTO_CLOSE_MS = 2500

export function InterventionPlayer({
  intervention,
  onClose,
  onStepChange,
  toolbar,
  voiceDelayMs = 400,
  onVoiceMissing,
}: InterventionPlayerProps) {
  const steps = useMemo(() => expandSteps(intervention.steps), [intervention.steps])
  const [index, setIndex] = useState(0)
  const [left, setLeft] = useState<number | null>(steps[0]?.seconds ?? null)
  const [paused, setPaused] = useState(false)
  // Paso cuya voz ya terminó de sonar (o que no tiene audio): hasta entonces no avanza solo.
  const [spokenIndex, setSpokenIndex] = useState(-1)
  const voiceBusyRef = useRef(false)
  const voiceBusyTick = spokenIndex
  const [scale, setScale] = useState(() => targetScale(steps[0]?.text) ?? 0.55)
  const reduce = useReducedMotion()
  const t = useT()

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

  // Cuenta atrás: un tic por segundo; al acabar el paso, el siguiente. Si la voz aún está leyendo
  // el paso, espera en el último segundo a que termine.
  useEffect(() => {
    if (done || paused || left === null) return
    if (left <= 1 && voiceBusyRef.current) return
    const timer = window.setTimeout(() => (left <= 1 ? goTo(index + 1) : setLeft(left - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [left, paused, done, index, goTo, voiceBusyTick])

  // Aviso al cambiar de paso o terminar. No al abrir (ni en el doble montaje del modo estricto):
  // se compara con el paso anterior.
  const onStepRef = useRef(onStepChange)
  onStepRef.current = onStepChange
  const shown = useRef(index)
  useEffect(() => {
    if (shown.current === index) return
    shown.current = index
    onStepRef.current?.(index, done)
  }, [index, done])

  // Voz guía: cada paso se lee al mostrarse (el primero, tras `voiceDelayMs`).
  const texts = useMemo(() => steps.map((s) => s.text), [steps])
  const voiceReady = useVoiceAvailable(texts)
  const voiceOn = useVoicePref()
  const voice = voiceReady && voiceOn
  const missingRef = useRef(onVoiceMissing)
  missingRef.current = onVoiceMissing
  // Solo se marca al sonar de verdad (en el doble montaje del modo estricto no llega a sonar).
  const spoken = useRef(false)
  useEffect(() => {
    const text = steps[index]?.text
    if (!voice || done || !text) return
    const timer = window.setTimeout(
      () => {
        spoken.current = true
        // Se espera a que la frase termine de sonar: hasta entonces el paso no avanza solo.
        void speakToEnd(text).then((ok) => {
          if (!ok) missingRef.current?.()
          setSpokenIndex(index)
        })
      },
      spoken.current ? 150 : voiceDelayMs,
    )
    return () => {
      window.clearTimeout(timer)
      stopSpeaking()
    }
  }, [voice, done, index, steps, voiceDelayMs])

  const next = () => goTo(index + 1)

  // Pasos sin cuenta atrás: si no se pulsa «Siguiente», avanza solo a los 3 s (con la voz activa,
  // 3 s después de que termine de leerlo). En pausa, no.
  const waitingVoice = voice && spokenIndex !== index
  voiceBusyRef.current = waitingVoice
  const autoAdvance = !done && !paused && left === null && !waitingVoice
  useEffect(() => {
    if (!autoAdvance) return
    const timer = window.setTimeout(() => goTo(index + 1), AUTO_NEXT_MS)
    return () => window.clearTimeout(timer)
  }, [autoAdvance, index, goTo])

  // Al terminar, «Hecho» unos segundos y se cierra solo.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => closeRef.current(), AUTO_CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [done])

  return (
    // Modal bloqueante: hasta terminar (botón o Escape) no se puede usar nada más.
    <Modal labelledBy="intervention-title" onClose={onClose}>
      <div className="flex min-h-full flex-col bg-env-bg text-env-text">
        <div className="flex items-center justify-between gap-3 p-4">
          <h2 id="intervention-title" className="font-semibold">
            {intervention.title}
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {voiceReady && <VoiceToggle compact />}
            {toolbar}
            <button
              data-autofocus
              type="button"
              onClick={onClose}
              className=" border border-env-border px-3 py-1.5 text-sm hover:border-env-text"
            >
              {done ? t('Cerrar') : t('Terminar')}
            </button>
          </div>
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
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <p className="font-display text-5xl font-bold">{t('Hecho')}</p>
              <p className="mt-3 text-lg text-env-muted">
                {t('Bien hecho. Puedes repetirla cuando lo necesites.')}
              </p>
            </motion.div>
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
              <div aria-live="polite" className="w-full max-w-3xl">
                {/* Cada paso entra con un fundido corto (sin movimiento si se pide menos). */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={index}
                    initial={reduce ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="text-[clamp(1.75rem,4.2vw,3rem)] leading-tight font-semibold text-balance"
                  >
                    {step?.text}
                  </motion.p>
                </AnimatePresence>
                {step?.cycle && (
                  <p className="mt-3 text-base text-env-muted">
                    {t('Ciclo {n} de {of}', { n: step.cycle.n, of: step.cycle.of })}
                  </p>
                )}
              </div>
              {left !== null && (
                <p
                  className="text-5xl font-bold tabular-nums"
                  aria-label={t('Quedan {n} segundos', { n: left })}
                >
                  {left}
                </p>
              )}
              <div className="flex gap-3">
                {left !== null && (
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="border border-env-border px-6 py-3 text-lg hover:border-env-text"
                  >
                    {paused ? t('Seguir') : t('Pausa')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  className="relative overflow-hidden bg-env-primary px-6 py-3 text-lg font-medium text-env-primary-text"
                >
                  {/* Barra que se llena en los 3 s antes de avanzar solo. */}
                  {autoAdvance && !reduce && (
                    <motion.span
                      key={index}
                      aria-hidden
                      className="absolute inset-y-0 left-0 bg-white/25"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: AUTO_NEXT_MS / 1000, ease: 'linear' }}
                    />
                  )}
                  <span className="relative">
                    {index === steps.length - 1 ? t('Terminar') : t('Siguiente')}
                  </span>
                </button>
              </div>
              {autoAdvance && (
                <p className="-mt-4 text-sm text-env-muted">{t('Pasa solo en 3 s si no pulsas')}</p>
              )}
            </>
          )}
        </div>
        {voiceReady && (
          <p className="px-4 pb-4 text-center text-xs text-env-muted">{t(VOICE_NOTE)}</p>
        )}
      </div>
    </Modal>
  )
}
