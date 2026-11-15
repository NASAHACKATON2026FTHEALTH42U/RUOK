import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useT } from '../../../i18n/t'
import { NumericKeypad } from '../../measure/NumericKeypad'
import type { CognitiveTestProps } from '../types'
import {
  advance,
  digitMs,
  gapMs,
  generateSequence,
  initialState,
  isReverse,
  scoreFromSpan,
  TRIALS_PER_LENGTH,
  type SpanState,
} from './digits'

/** Pausa antes del primer dígito de cada serie. */
const READY_MS = 800
/** Cuánto se ve «Correcto / Incorrecto» antes de la siguiente serie. */
const FEEDBACK_MS = 1200

type Phase =
  | { kind: 'intro' }
  | { kind: 'show'; i: number; on: boolean }
  | { kind: 'answer' }
  | { kind: 'feedback'; ok: boolean }

/**
 * Dígitos al revés (backward digit span, FE-39): se ven los dígitos de uno en uno y hay que
 * escribirlos en orden inverso. Empieza con 3; dos intentos por longitud; se sube si se acierta
 * al menos uno y se acaba con dos fallos en la misma longitud (o al llegar a 10).
 */
export default function DigitsTest({ onFinish }: CognitiveTestProps) {
  const t = useT()
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [game, setGame] = useState<SpanState>(initialState)
  const [sequence, setSequence] = useState<number[]>([])
  const [answer, setAnswer] = useState<number[]>([])
  const doneRef = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  const startTrial = useCallback((length: number) => {
    setSequence(generateSequence(length))
    setAnswer([])
    setPhase({ kind: 'show', i: -1, on: false })
  }, [])

  // Temporizadores de la presentación y del aviso de acierto.
  useEffect(() => {
    let id: number | undefined
    if (phase.kind === 'show') {
      const len = sequence.length
      if (phase.on) {
        id = window.setTimeout(() => setPhase({ ...phase, on: false }), digitMs(len))
      } else {
        const wait = phase.i < 0 ? READY_MS : gapMs(len)
        id = window.setTimeout(() => {
          setPhase(
            phase.i + 1 >= len ? { kind: 'answer' } : { kind: 'show', i: phase.i + 1, on: true },
          )
        }, wait)
      }
    } else if (phase.kind === 'feedback') {
      id = window.setTimeout(() => {
        const next = advance(game, phase.ok)
        if (next.done) {
          if (doneRef.current) return
          doneRef.current = true
          finishRef.current({
            score: scoreFromSpan(next.span),
            summary: `${t('Tu marca: {span} dígitos al revés', { span: next.span })} · ${t(
              'La media adulta ronda 4–5 dígitos al revés.',
            )}`,
            metrics: { span: next.span, trials: next.trials, correct: next.correct },
          })
          return
        }
        setGame(next)
        startTrial(next.length)
      }, FEEDBACK_MS)
    }
    return () => window.clearTimeout(id)
  }, [phase, sequence.length, game, startTrial, t])

  const check = useCallback(() => {
    if (phase.kind !== 'answer' || answer.length === 0) return
    setPhase({ kind: 'feedback', ok: isReverse(sequence, answer) })
  }, [phase.kind, answer, sequence])

  const onKey = useCallback(
    (key: string) => {
      if (phase.kind !== 'answer') return
      if (key === 'back') setAnswer((a) => a.slice(0, -1))
      else if (key === 'clear') setAnswer([])
      else if (/^\d$/.test(key))
        setAnswer((a) => (a.length < sequence.length ? [...a, Number(key)] : a))
    },
    [phase.kind, sequence.length],
  )

  // Teclado físico: dígitos, borrar e Intro.
  useEffect(() => {
    if (phase.kind !== 'answer') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) onKey(e.key)
      else if (e.key === 'Backspace') onKey('back')
      else if (e.key === 'Enter') check()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase.kind, onKey, check])

  if (phase.kind === 'intro') {
    return (
      <div className="hud-panel flex w-full max-w-lg flex-col gap-4 p-[clamp(1.25rem,3vw,2rem)]">
        <p className="hud-label">{t('Cómo funciona')}</p>
        <p className="text-[clamp(1rem,0.9rem+0.5vw,1.2rem)]">
          {t('Verás unos dígitos de uno en uno. Cuando acaben, escríbelos en orden inverso.')}
        </p>
        <p className="text-env-muted">
          {t('Ejemplo: si ves 3 · 8 · 1, escribe 1 8 3. Empieza con 3 dígitos y va subiendo.')}
        </p>
        <button
          type="button"
          onClick={() => startTrial(game.length)}
          className="hud-btn hud-btn-primary !h-12 self-start px-6"
        >
          {t('Empezar')}
        </button>
      </div>
    )
  }

  const status = (
    <p className="hud-label tabular-nums">
      {t('{n} dígitos · intento {k} de {total}', {
        n: game.length,
        k: game.trial + 1,
        total: TRIALS_PER_LENGTH,
      })}
    </p>
  )

  if (phase.kind === 'show') {
    const digit = phase.on ? sequence[phase.i] : null
    return (
      <div className="flex w-full flex-col items-center gap-6 select-none">
        {status}
        <p className="text-env-muted">{t('Memoriza')}</p>
        <div
          className="flex h-[clamp(8rem,6rem+12vw,14rem)] items-center justify-center"
          aria-live="assertive"
          aria-atomic
        >
          <AnimatePresence mode="wait">
            {digit !== null && (
              <motion.span
                key={`${phase.i}-${digit}`}
                initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.12 }}
                className="font-display text-[clamp(6rem,4rem+12vw,12rem)] leading-none font-bold tabular-nums"
              >
                {digit}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {sequence.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-5 ${i <= phase.i ? 'bg-env-primary' : 'bg-env-border'}`}
            />
          ))}
        </div>
      </div>
    )
  }

  const reversed = [...sequence].reverse()
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      {status}
      <p className="text-center text-[clamp(1rem,0.9rem+0.5vw,1.2rem)]">
        {phase.kind === 'answer' ? t('Escríbelos al revés') : ' '}
      </p>
      <div
        className="flex flex-wrap justify-center gap-1.5"
        aria-label={t('Tu respuesta')}
        role="status"
      >
        {sequence.map((_, i) => (
          <span
            key={i}
            className={`flex h-12 w-[clamp(1.9rem,8vw,2.75rem)] items-center justify-center border text-2xl font-bold tabular-nums ${
              phase.kind === 'feedback'
                ? phase.ok
                  ? 'border-env-primary text-env-primary'
                  : 'border-env-border text-env-muted'
                : i === answer.length
                  ? 'border-env-primary'
                  : 'border-env-border'
            }`}
          >
            {answer[i] ?? ''}
          </span>
        ))}
      </div>

      {phase.kind === 'feedback' ? (
        <div
          className="flex min-h-[14rem] flex-col items-center justify-center gap-2 text-center"
          aria-live="assertive"
        >
          <p className="font-display text-3xl font-bold">
            {phase.ok ? t('Correcto') : t('Incorrecto')}
          </p>
          {!phase.ok && (
            <p className="text-env-muted tabular-nums">
              {t('Era: {seq}', { seq: reversed.join(' ') })}
            </p>
          )}
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <NumericKeypad onKey={onKey} decimal={false} label={t('Teclado de dígitos')} />
          <button
            type="button"
            onClick={check}
            disabled={answer.length === 0}
            className="hud-btn hud-btn-primary !h-12 w-full disabled:opacity-40"
          >
            {t('Comprobar')}
          </button>
        </div>
      )}
    </div>
  )
}
