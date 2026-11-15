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

  const total = steps.length
  const nextStep = done ? null : steps[index + 1]
  // Progreso del paso con cuenta atrás (anillo alrededor del número).
  const stepProgress =
    left !== null && step?.seconds ? Math.min(1, (step.seconds - left + 1) / step.seconds) : 0
  const RING = 2 * Math.PI * 46

  return (
    // Modal bloqueante: hasta terminar (botón o Escape) no se puede usar nada más.
    <Modal labelledBy="intervention-title" onClose={onClose}>
      <div className="guided relative isolate flex min-h-full flex-col overflow-hidden bg-env-bg text-env-text">
        {/* Fondo vivo (decorativo): auroras del color del entorno que se mueven despacio y la
            rejilla del HUD. Sin movimiento si el sistema lo pide. */}
        <div aria-hidden className="guided-bg pointer-events-none absolute inset-0 -z-10">
          <span className="guided-aurora guided-aurora-a" />
          <span className="guided-aurora guided-aurora-b" />
          <span className="hud-grid absolute inset-0 opacity-60" />
        </div>

        <header className="flex flex-col gap-3 px-[clamp(1rem,3vw,2rem)] pt-[clamp(0.75rem,2vw,1.5rem)] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="hud-label text-[0.6875rem]">
              {done ? t('Hecho') : t('Paso {n} de {of}', { n: index + 1, of: total })}
            </p>
            <h2
              id="intervention-title"
              className="truncate font-display text-[clamp(1.05rem,0.9rem+0.8vw,1.5rem)] font-semibold"
            >
              {intervention.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {voiceReady && <VoiceToggle compact />}
            {toolbar}
            <button
              data-autofocus
              type="button"
              onClick={onClose}
              className="hud-btn !h-10 px-4 !text-xs max-sm:ml-auto"
            >
              {done ? t('Cerrar') : t('Terminar')}
            </button>
          </div>
        </header>

        {/* Un segmento por paso: hechos, el actual (que se llena) y los que faltan. */}
        <ol
          aria-hidden
          className="mt-3 flex gap-1 px-[clamp(1rem,3vw,2rem)]"
          style={{ ['--n' as string]: total }}
        >
          {steps.map((_, i) => (
            <li key={i} className="h-1 flex-1 overflow-hidden bg-env-border/70">
              <span
                className="block h-full bg-env-primary transition-[width] duration-500"
                style={{
                  width:
                    i < index || done
                      ? '100%'
                      : i === index
                        ? `${Math.max(stepProgress, 0.12) * 100}%`
                        : '0%',
                }}
              />
            </li>
          ))}
        </ol>

        <div className="flex flex-1 flex-col items-center justify-center gap-[clamp(1.25rem,4vh,2.5rem)] px-[clamp(1rem,4vw,3rem)] py-6 text-center">
          {done ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="flex flex-col items-center gap-4"
            >
              <span className="guided-done grid size-[clamp(5rem,14vw,7.5rem)] place-items-center rounded-full border-2 border-env-primary text-env-primary">
                <svg
                  viewBox="0 0 24 24"
                  className="size-1/2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <p className="font-display text-[clamp(2.25rem,1.6rem+3vw,4rem)] font-bold">
                {t('Hecho')}
              </p>
              <p className="max-w-xl text-[clamp(1rem,0.9rem+0.5vw,1.25rem)] text-env-muted">
                {t('Bien hecho. Puedes repetirla cuando lo necesites.')}
              </p>
            </motion.div>
          ) : (
            <>
              {/* Orbe: en los pasos de respiración crece al inhalar y encoge al exhalar; en el
                  resto, late despacio para acompañar. Con anillos que se expanden. */}
              <div
                aria-hidden
                className="relative grid size-[clamp(9rem,26vmin,15rem)] place-items-center"
              >
                <span className="guided-ripple" />
                <span className="guided-ripple guided-ripple-2" />
                <motion.span
                  className={`guided-orb absolute inset-[12%] rounded-full ${phase ? '' : 'guided-orb-idle'}`}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: reduce ? 0.85 : phase ? scale : 0.8 }}
                  transition={{
                    duration: reduce ? 0 : phase ? (step?.seconds ?? 1) : 0.6,
                    ease: 'easeInOut',
                  }}
                />
                {left !== null ? (
                  <svg viewBox="0 0 100 100" className="relative size-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="var(--env-border)"
                      strokeWidth="2"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="var(--env-primary)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={RING}
                      strokeDashoffset={RING * (1 - stepProgress)}
                      className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                    />
                  </svg>
                ) : null}
                {left !== null && (
                  <span
                    className="absolute font-display text-[clamp(2rem,1.4rem+3vw,3.5rem)] font-bold tabular-nums"
                    aria-label={t('Quedan {n} segundos', { n: left })}
                  >
                    {left}
                  </span>
                )}
                {left === null && phase === null && (
                  <span className="absolute font-display text-[clamp(1.5rem,1.1rem+2vw,2.5rem)] font-semibold tabular-nums text-env-primary">
                    {index + 1}
                  </span>
                )}
              </div>

              <div aria-live="polite" className="w-full max-w-[min(48rem,92vw)]">
                {phase && (
                  <p className="hud-label mb-2 text-[clamp(0.7rem,0.65rem+0.25vw,0.85rem)] text-env-primary">
                    {phase === 'in' ? t('Inhala') : phase === 'out' ? t('Exhala') : t('Mantén')}
                  </p>
                )}
                {/* Cada paso entra con un fundido corto (sin movimiento si se pide menos). Letra
                    fluida: crece con la pantalla sin saltos entre móvil y escritorio. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={index}
                    initial={reduce ? false : { opacity: 0, y: 16, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={reduce ? undefined : { opacity: 0, y: -12, filter: 'blur(4px)' }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="text-[clamp(1.5rem,1.05rem+2.4vw,3rem)] leading-[1.2] font-medium tracking-[-0.01em] text-balance"
                  >
                    {step?.text}
                  </motion.p>
                </AnimatePresence>
                {step?.cycle && (
                  <p className="mt-3 text-[clamp(0.9rem,0.85rem+0.3vw,1.1rem)] text-env-muted">
                    {t('Ciclo {n} de {of}', { n: step.cycle.n, of: step.cycle.of })}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {left !== null && (
                  <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    className="hud-btn !h-12 min-w-32 px-6"
                  >
                    {paused ? t('Seguir') : t('Pausa')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  className="hud-btn hud-btn-primary relative !h-12 min-w-40 overflow-hidden px-6"
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
                    {index === total - 1 ? t('Terminar') : t('Siguiente')}
                  </span>
                </button>
              </div>
              {autoAdvance && (
                <p className="-mt-2 text-sm text-env-muted">{t('Pasa solo en 3 s si no pulsas')}</p>
              )}

              {/* Lo que viene: anticipa el siguiente paso (atenuado). */}
              {nextStep && (
                <p className="max-w-[min(40rem,90vw)] truncate text-[clamp(0.85rem,0.8rem+0.25vw,1rem)] text-env-muted">
                  <span className="hud-label mr-2 text-[0.6875rem]">{t('Después')}</span>
                  {nextStep.text}
                </p>
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
