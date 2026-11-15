import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useT } from '../../../i18n/t'
import { dateLocale } from '../../../i18n/lang'
import type { CognitiveTestProps } from '../types'
import { LINE_TRIALS, makeTrial, scoreLine, type LineResponse, type LineTrial } from './line'

/** Cuánto se ve el resultado de cada respuesta antes del siguiente ensayo. */
const FEEDBACK_MS = 750
/** Radio de las líneas del abanico, de las etiquetas y de la zona táctil (unidades SVG). */
const RAY_R = 85
const LABEL_R = 100
const HIT_R = 112

const rad = (deg: number) => (deg * Math.PI) / 180
/** Punto a `r` del origen con ángulo `deg` (0° = derecha, antihorario; el eje y del SVG baja). */
const pt = (deg: number, r: number) => ({ x: r * Math.cos(rad(deg)), y: -r * Math.sin(rad(deg)) })

/** Cuña invisible alrededor de cada línea: zona táctil ancha (≥44 px en el extremo). */
function wedge(deg: number, half: number): string {
  const a = pt(deg - half, HIT_R)
  const b = pt(deg + half, HIT_R)
  return `M0 0L${a.x.toFixed(2)} ${a.y.toFixed(2)}A${HIT_R} ${HIT_R} 0 0 0 ${b.x.toFixed(2)} ${b.y.toFixed(2)}Z`
}

type Feedback = { choice: number; correct: boolean } | null

/**
 * Orientación de líneas (FE-39), inspirado en el «Line Orientation Test» de NASA Cognition y en
 * el abanico de Benton: se muestra una línea inclinada y hay que tocar, en el abanico, la que
 * tiene la misma inclinación. 10 ensayos de dificultad creciente; puntuación = 85 % aciertos +
 * 15 % rapidez.
 */
export default function LineTest({ onFinish }: CognitiveTestProps) {
  const t = useT()
  const reduce = useReducedMotion()
  const [started, setStarted] = useState(false)
  const [index, setIndex] = useState(0)
  const [trial, setTrial] = useState<LineTrial>(() => makeTrial(0, null))
  const [feedback, setFeedback] = useState<Feedback>(null)

  const responsesRef = useRef<LineResponse[]>([])
  const onsetRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  // Inicio del cronómetro: en el siguiente frame, cuando el ensayo ya está pintado.
  useEffect(() => {
    if (!started) return
    onsetRef.current = null
    const raf = requestAnimationFrame(() => {
      onsetRef.current = performance.now()
    })
    return () => cancelAnimationFrame(raf)
  }, [started, trial])

  // Tras el feedback: siguiente ensayo o fin.
  useEffect(() => {
    if (!feedback) return
    const id = window.setTimeout(() => {
      const next = index + 1
      if (next >= LINE_TRIALS) {
        if (doneRef.current) return
        doneRef.current = true
        const s = scoreLine(responsesRef.current)
        const secs = (s.meanRtMs / 1000).toLocaleString(dateLocale(), {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
        finishRef.current({
          score: s.score,
          summary: t('{ok} de {n} aciertos · {s} s de media', {
            ok: s.correct,
            n: s.total,
            s: secs,
          }),
          metrics: { correct: s.correct, total: s.total, mean_rt_ms: s.meanRtMs },
        })
        return
      }
      setIndex(next)
      setTrial((prev) => makeTrial(next, prev.answer))
      setFeedback(null)
    }, FEEDBACK_MS)
    return () => window.clearTimeout(id)
  }, [feedback, index, t])

  const choose = useCallback(
    (choice: number) => {
      if (feedback || onsetRef.current === null) return
      const correct = choice === trial.answer
      responsesRef.current.push({
        correct,
        rtMs: Math.round(performance.now() - onsetRef.current),
      })
      setFeedback({ choice, correct })
    },
    [feedback, trial],
  )

  if (!started) {
    return (
      <div className="hud-panel flex w-full max-w-lg flex-col gap-4 p-[clamp(1rem,3vw,1.75rem)]">
        <p className="hud-label">{t('Cómo funciona')}</p>
        <p className="text-[clamp(1rem,0.92rem+0.4vw,1.2rem)]">
          {t(
            'Arriba verás una línea inclinada. Toca en el abanico la línea que tenga la misma inclinación.',
          )}
        </p>
        <p className="text-sm text-env-muted">
          {t(
            'Son {n} líneas, cada vez más difíciles. Cuenta sobre todo acertar y, un poco, la rapidez.',
            { n: LINE_TRIALS },
          )}
        </p>
        <button
          type="button"
          data-autofocus
          onClick={() => setStarted(true)}
          className="hud-btn hud-btn-primary !h-12 self-start px-6"
        >
          {t('Empezar')}
        </button>
      </div>
    )
  }

  const { level, angles, answer } = trial
  const half = level.step / 2
  const targetAngle = angles[answer]
  const tLen = level.length * 45
  const a = pt(targetAngle, tLen)
  const b = pt(targetAngle + 180, tLen)

  const rayClass = (i: number) => {
    if (feedback) {
      if (i === answer) return 'stroke-st-ok'
      if (i === feedback.choice) return 'stroke-st-warn'
      return 'stroke-env-muted opacity-50'
    }
    return 'stroke-env-text group-hover:stroke-env-primary group-focus-within:stroke-env-primary'
  }

  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      choose(i)
    }
  }

  return (
    <div className="flex w-full max-w-2xl touch-manipulation flex-col items-center gap-[clamp(0.5rem,2dvh,1.25rem)] select-none">
      <div className="flex w-full items-center gap-3 text-sm">
        <span className="tabular-nums">
          {t('Línea {i} de {n}', { i: index + 1, n: LINE_TRIALS })}
        </span>
        <div className="h-1 flex-1 overflow-hidden bg-env-border" aria-hidden>
          <div
            className="h-full bg-env-primary transition-[width] motion-reduce:transition-none"
            style={{ width: `${((index + (feedback ? 1 : 0)) / LINE_TRIALS) * 100}%` }}
          />
        </div>
      </div>

      <motion.div
        key={index}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="hud-panel flex flex-col items-center px-4 pt-2 pb-3"
      >
        <p className="hud-label">{t('Línea objetivo')}</p>
        <svg
          viewBox="-50 -50 100 100"
          role="img"
          aria-label={t('Línea objetivo')}
          className="h-[clamp(6.5rem,18dvh,11rem)] w-[clamp(6.5rem,18dvh,11rem)]"
        >
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className="stroke-env-primary"
            strokeWidth={4}
            strokeLinecap="square"
          />
        </svg>
      </motion.div>

      <p className="text-center text-[clamp(0.875rem,0.82rem+0.3vw,1.05rem)] text-env-muted">
        {t('Toca la línea con la misma inclinación')}
      </p>

      <svg
        viewBox="-114 -114 228 128"
        role="group"
        aria-label={t('Abanico de líneas de referencia')}
        style={{ width: 'min(100%, 36rem, max(16rem, calc((100dvh - 22rem) * 1.75)))' }}
        className="h-auto overflow-visible"
      >
        {angles.map((deg, i) => {
          const end = pt(deg, RAY_R)
          const lab = pt(deg, LABEL_R)
          return (
            <g key={`${index}-${deg}`} className="group">
              <line
                x1={0}
                y1={0}
                x2={end.x}
                y2={end.y}
                className={`transition-colors motion-reduce:transition-none ${rayClass(i)}`}
                strokeWidth={feedback && (i === answer || i === feedback.choice) ? 4 : 2.5}
                strokeLinecap="square"
              />
              <text
                x={lab.x}
                y={lab.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                className={`tabular-nums ${
                  feedback && i === answer ? 'fill-st-ok font-bold' : 'fill-env-muted'
                }`}
              >
                {i + 1}
              </text>
              <path
                d={wedge(deg, half)}
                fill="transparent"
                role="button"
                tabIndex={0}
                aria-label={t('Línea {n}', { n: i + 1 })}
                className="cursor-pointer outline-none"
                onClick={() => choose(i)}
                onKeyDown={(e) => onKey(e, i)}
              />
            </g>
          )
        })}
        <rect x={-4} y={-4} width={8} height={8} className="fill-env-text" />
      </svg>

      <p
        aria-live="polite"
        className={`min-h-[1.6em] text-center text-[clamp(1rem,0.9rem+0.5vw,1.25rem)] font-semibold ${
          feedback?.correct ? 'text-st-ok' : 'text-st-warn'
        }`}
      >
        {feedback && (feedback.correct ? t('Correcto') : t('No: era la {n}', { n: answer + 1 }))}
      </p>
    </div>
  )
}
