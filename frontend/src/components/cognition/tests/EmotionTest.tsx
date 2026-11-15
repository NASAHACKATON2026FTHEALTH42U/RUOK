import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { CognitiveTestProps } from '../types'
import { translate, useT } from '../../../i18n/t'
import { dateLocale } from '../../../i18n/lang'
import {
  buildTrials,
  EMOTIONS,
  faceShape,
  scoreEmotion,
  TRIALS,
  type Answer,
  type Emotion,
  type Trial,
} from './emotion'

/** Cuánto se ve el acierto/fallo antes de la siguiente cara. */
const FEEDBACK_MS = 400

/** Cara dibujada con SVG: cejas, ojos y boca según la emoción y su intensidad. */
function Face({ trial, label }: { trial: Trial; label: string }) {
  const f = faceShape(trial)
  const browY = 64
  const eyeY = 88
  const mouthY = 138
  const brow = (side: -1 | 1) => {
    const inner = { x: 100 + side * 12, y: browY + f.browInner }
    const outer = { x: 100 + side * 44, y: browY + f.browOuter }
    const cx = (inner.x + outer.x) / 2
    const cy = (inner.y + outer.y) / 2 + f.browArch
    return `M${inner.x} ${inner.y} Q${cx} ${cy} ${outer.x} ${outer.y}`
  }
  const half = f.mouthWidth / 2
  const cornerY = mouthY - f.mouthCurve
  const lowerY = mouthY + f.mouthCurve + f.mouthOpen
  const upperY = mouthY + f.mouthCurve * 0.35 - f.mouthOpen
  const open = f.mouthOpen > 1.5
  const mouth = open
    ? `M${100 - half} ${cornerY} Q100 ${upperY} ${100 + half} ${cornerY} Q100 ${lowerY} ${100 - half} ${cornerY}Z`
    : `M${100 - half} ${cornerY} Q100 ${mouthY + f.mouthCurve} ${100 + half} ${cornerY}`

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={label}
      className="h-full w-full text-env-text"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse
        cx="100"
        cy="104"
        rx="78"
        ry="88"
        strokeWidth="3"
        className="fill-env-surface stroke-env-border"
      />
      <path d={brow(-1)} strokeWidth="5" />
      <path d={brow(1)} strokeWidth="5" />
      {([-1, 1] as const).map((side) => (
        <g key={side}>
          <ellipse cx={100 + side * 30} cy={eyeY} rx="11" ry={f.eyeOpen} strokeWidth="2.5" />
          <circle
            cx={100 + side * 30}
            cy={eyeY}
            r={Math.min(4.5, f.eyeOpen - 0.5)}
            fill="currentColor"
            stroke="none"
          />
        </g>
      ))}
      <path d="M100 98 L94 120 L104 121" strokeWidth="2.5" className="stroke-env-muted" />
      <path
        d={mouth}
        strokeWidth="3.5"
        fill={open ? 'currentColor' : 'none'}
        fillOpacity={open ? 0.8 : 0}
      />
    </svg>
  )
}

type Phase =
  | { kind: 'intro' }
  | { kind: 'trial'; index: number }
  | { kind: 'feedback'; index: number; chosen: Emotion }

/**
 * Reconocimiento de emociones (FE-39): 10 caras con alegría, tristeza, ira, miedo, sorpresa o
 * ninguna emoción, con intensidad variable. Se mide el acierto y el tiempo de respuesta.
 */
export default function EmotionTest({ onFinish }: CognitiveTestProps) {
  const t = useT()
  const reduced = useReducedMotion()
  const [trials] = useState(() => buildTrials())
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const answersRef = useRef<Answer[]>([])
  const onsetRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  const trialIndex = phase.kind === 'intro' ? -1 : phase.index
  const current = trialIndex >= 0 ? trials[trialIndex] : undefined

  // Hora de aparición de la cara: en el siguiente frame, cuando ya está pintada.
  useEffect(() => {
    if (phase.kind !== 'trial') return
    onsetRef.current = null
    const raf = requestAnimationFrame(() => {
      onsetRef.current = performance.now()
    })
    return () => cancelAnimationFrame(raf)
  }, [phase])

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    const s = scoreEmotion(answersRef.current)
    const secs = (s.meanRtMs / 1000).toLocaleString(dateLocale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    finishRef.current({
      score: s.score,
      summary: translate('{ok} de {n} aciertos · {s} s de media', {
        ok: s.correct,
        n: s.total,
        s: secs,
      }),
      metrics: { correct: s.correct, total: s.total, mean_rt_ms: s.meanRtMs },
    })
  }, [])

  // Tras el destello de acierto/fallo, la siguiente cara (o el final).
  useEffect(() => {
    if (phase.kind !== 'feedback') return
    const id = window.setTimeout(() => {
      if (phase.index + 1 >= trials.length) finish()
      else setPhase({ kind: 'trial', index: phase.index + 1 })
    }, FEEDBACK_MS)
    return () => window.clearTimeout(id)
  }, [phase, trials.length, finish])

  const answer = useCallback(
    (chosen: Emotion) => {
      if (phase.kind !== 'trial' || !current) return
      const onset = onsetRef.current ?? performance.now()
      answersRef.current.push({
        correct: chosen === current.emotion,
        rtMs: Math.round(performance.now() - onset),
      })
      setPhase({ kind: 'feedback', index: phase.index, chosen })
    },
    [phase, current],
  )

  // Teclas 1–6 en ordenador.
  useEffect(() => {
    if (phase.kind !== 'trial') return
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= EMOTIONS.length && !e.repeat) {
        e.preventDefault()
        answer(EMOTIONS[n - 1]!.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, answer])

  if (phase.kind === 'intro' || !current) {
    return (
      <div className="hud-panel flex w-full max-w-xl flex-col gap-4 p-[clamp(1rem,3vw,2rem)] text-center">
        <p className="hud-label !text-sm">{t('Cómo funciona')}</p>
        <p className="text-[clamp(1.05rem,0.95rem+0.6vw,1.35rem)]">
          {t('Mira cada cara y elige la emoción que expresa.')}
        </p>
        <p className="text-[clamp(0.875rem,0.85rem+0.3vw,1rem)] text-env-muted">
          {t(
            'Son {n} caras. Algunas expresiones son sutiles: responde lo más rápido que puedas sin perder precisión.',
            { n: TRIALS },
          )}
        </p>
        <button
          type="button"
          data-autofocus
          onClick={() => setPhase({ kind: 'trial', index: 0 })}
          className="hud-btn hud-btn-primary mx-auto !h-12 w-full max-w-xs !text-sm"
        >
          {t('Empezar')}
        </button>
      </div>
    )
  }

  const feedback = phase.kind === 'feedback' ? phase : null
  const wasCorrect = feedback ? feedback.chosen === current.emotion : null
  const correctLabel = EMOTIONS.find((e) => e.id === current.emotion)!.label

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-[clamp(0.75rem,2vh,1.25rem)]">
      <div className="flex w-full items-center justify-between gap-3 text-sm">
        <span className="hud-label !text-sm tabular-nums">
          {t('Cara {i} de {n}', { i: trialIndex + 1, n: trials.length })}
        </span>
        <span className="h-1 flex-1 bg-env-border" aria-hidden>
          <span
            className="block h-full bg-env-primary"
            style={{ width: `${(trialIndex / trials.length) * 100}%` }}
          />
        </span>
      </div>

      <div
        className={`relative aspect-square w-[min(68vw,34vh,300px)] border-2 p-2 transition-colors ${
          wasCorrect === null
            ? 'border-transparent'
            : wasCorrect
              ? 'border-st-ok'
              : 'border-st-crit'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={trialIndex}
            className="h-full w-full"
            initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.12 }}
          >
            <Face trial={current} label={t('Cara para identificar')} />
          </motion.div>
        </AnimatePresence>
      </div>

      <p
        className={`min-h-[1.5em] text-center text-[clamp(1rem,0.9rem+0.5vw,1.25rem)] font-semibold ${
          wasCorrect === null ? 'text-env-text' : wasCorrect ? 'text-st-ok' : 'text-st-crit'
        }`}
        aria-live="polite"
      >
        {wasCorrect === null
          ? t('¿Qué emoción expresa esta cara?')
          : wasCorrect
            ? t('Correcto')
            : t('Era: {e}', { e: t(correctLabel) })}
      </p>

      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {EMOTIONS.map((e, i) => {
          const chosen = feedback?.chosen === e.id
          return (
            <button
              key={e.id}
              type="button"
              disabled={feedback !== null}
              onClick={() => answer(e.id)}
              className={`hud-btn !h-auto min-h-12 px-3 py-2 !text-[clamp(0.875rem,0.82rem+0.3vw,1rem)] !tracking-wider disabled:!opacity-100 ${
                chosen ? (wasCorrect ? '!border-st-ok' : '!border-st-crit') : ''
              } ${feedback && e.id === current.emotion ? 'hud-btn-primary' : ''}`}
            >
              <span className="hidden text-env-muted sm:inline" aria-hidden>
                {i + 1}
              </span>
              {t(e.label)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
