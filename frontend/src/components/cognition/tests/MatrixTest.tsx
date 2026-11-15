import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { dateLocale } from '../../../i18n/lang'
import { useT } from '../../../i18n/t'
import type { CognitiveTestProps } from '../types'
import { makePuzzles, scoreOf, type Cell, type Shape } from './matrix'

/** Pausa tras elegir, para que se vea la pieza marcada antes del siguiente patrón. */
const PICK_MS = 260

/** Posición y tamaño (semieje) de cada figura según cuántas haya, en un lienzo de 100×100. */
const LAYOUT: Record<number, { s: number; at: [number, number][] }> = {
  1: { s: 24, at: [[50, 50]] },
  2: {
    s: 17,
    at: [
      [28, 50],
      [72, 50],
    ],
  },
  3: {
    s: 14,
    at: [
      [50, 27],
      [27, 70],
      [73, 70],
    ],
  },
}

function Figure({
  shape,
  x,
  y,
  s,
  fill,
}: {
  shape: Shape
  x: number
  y: number
  s: number
  fill: string
}) {
  const common = { fill, stroke: 'currentColor', strokeWidth: 4, strokeLinejoin: 'round' as const }
  switch (shape) {
    case 'circle':
      return <circle cx={x} cy={y} r={s} {...common} />
    case 'square':
      return <rect x={x - s * 0.85} y={y - s * 0.85} width={s * 1.7} height={s * 1.7} {...common} />
    case 'triangle':
      return (
        <polygon
          points={`${x},${y - s} ${x + s * 0.98},${y + s * 0.78} ${x - s * 0.98},${y + s * 0.78}`}
          {...common}
        />
      )
    case 'diamond':
      return (
        <polygon points={`${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}`} {...common} />
      )
  }
}

/** Una pieza del patrón, en SVG. */
function CellSvg({ cell }: { cell: Cell }) {
  const pid = `mx${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const { s, at } = LAYOUT[cell.count]
  const fill =
    cell.fill === 'solid' ? 'currentColor' : cell.fill === 'hatch' ? `url(#${pid})` : 'none'
  return (
    <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden>
      {cell.fill === 'hatch' && (
        <defs>
          <pattern
            id={pid}
            patternUnits="userSpaceOnUse"
            width="7"
            height="7"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="7" stroke="currentColor" strokeWidth="3" />
          </pattern>
        </defs>
      )}
      {at.map(([x, y], i) => (
        <Figure key={i} shape={cell.shape} x={x} y={y} s={s} fill={fill} />
      ))}
    </svg>
  )
}

interface Answer {
  correct: boolean
  rt: number
}

/**
 * Razonamiento matricial (FE-39): 8 patrones de 3×3 de dificultad creciente; cada uno sigue
 * reglas por filas y columnas (forma, número de figuras, relleno) y falta la última pieza.
 * Puntuación: 80 % aciertos + 20 % rapidez (frente a 20 s por patrón).
 */
export default function MatrixTest({ onFinish }: CognitiveTestProps) {
  const t = useT()
  const reduce = useReducedMotion()
  const puzzles = useMemo(() => makePuzzles(Math.floor(Math.random() * 2 ** 31)), [])
  const [phase, setPhase] = useState<'intro' | 'run'>('intro')
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)

  const answersRef = useRef<Answer[]>([])
  const shownAtRef = useRef(0)
  const doneRef = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  const puzzle = puzzles[index]

  // El tiempo de cada patrón empieza al mostrarlo.
  useEffect(() => {
    if (phase === 'run') shownAtRef.current = performance.now()
  }, [phase, index])

  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    const list = answersRef.current
    const ok = list.filter((a) => a.correct).length
    const mean = list.length ? list.reduce((sum, a) => sum + a.rt, 0) / list.length : 0
    const secs = (mean / 1000).toLocaleString(dateLocale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    finishRef.current({
      score: scoreOf(ok, list.length, mean),
      summary: t('{ok} de {n} aciertos · {s} s de media', { ok, n: list.length, s: secs }),
      metrics: { correct: ok, total: list.length, mean_rt_ms: Math.round(mean) },
    })
  }, [t])

  const choose = useCallback(
    (i: number) => {
      if (phase !== 'run' || picked !== null || !puzzle) return
      answersRef.current.push({
        correct: i === puzzle.answer,
        rt: Math.round(performance.now() - shownAtRef.current),
      })
      setPicked(i)
    },
    [phase, picked, puzzle],
  )

  // Tras elegir: siguiente patrón o fin.
  useEffect(() => {
    if (picked === null) return
    const id = window.setTimeout(() => {
      if (index + 1 >= puzzles.length) {
        finish()
      } else {
        setPicked(null)
        setIndex((n) => n + 1)
      }
    }, PICK_MS)
    return () => window.clearTimeout(id)
  }, [picked, index, puzzles.length, finish])

  // Teclas 1–6 en ordenador.
  useEffect(() => {
    if (phase !== 'run') return
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= puzzle.options.length) choose(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, puzzle, choose])

  if (phase === 'intro') {
    return (
      <div className="hud-panel flex w-full max-w-xl flex-col gap-4 p-[clamp(1rem,3vw,2rem)] text-[clamp(1rem,0.92rem+0.35vw,1.15rem)]">
        <p className="hud-label">{t('Cómo funciona')}</p>
        <p>
          {t(
            'Cada patrón sigue unas reglas por filas y columnas: cuántas figuras hay, qué forma tienen y cómo están rellenas.',
          )}
        </p>
        <p>{t('Elige la pieza que completa la esquina inferior derecha.')}</p>
        <p className="text-env-muted">
          {t('{n} patrones, de más fácil a más difícil. Cuentan los aciertos y la rapidez.', {
            n: puzzles.length,
          })}
        </p>
        <button
          type="button"
          onClick={() => setPhase('run')}
          className="hud-btn hud-btn-primary !h-12 self-start px-6"
        >
          {t('Empezar')}
        </button>
      </div>
    )
  }

  const cols = puzzle.options.length === 4 ? 'grid-cols-4 lg:grid-cols-2' : 'grid-cols-3'

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-[clamp(0.75rem,2.5vw,2rem)]">
      <div className="flex w-full max-w-3xl flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="hud-label">
            {t('Patrón {i} de {n}', { i: index + 1, n: puzzles.length })}
          </span>
        </div>
        <div className="h-1 overflow-hidden bg-env-border" aria-hidden>
          <div
            className="h-full bg-env-primary"
            style={{ width: `${(index / puzzles.length) * 100}%` }}
          />
        </div>
      </div>

      <motion.div
        key={index}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex w-full flex-col items-center gap-[clamp(0.75rem,2.5vw,2rem)] lg:flex-row lg:items-center lg:justify-center"
      >
        <div
          role="img"
          aria-label={t('Patrón de 3 por 3 al que le falta la última pieza')}
          className="grid w-[min(100%,clamp(15rem,40vh,28rem))] grid-cols-3 gap-1.5 text-env-text"
        >
          {puzzle.grid.map((cell, i) =>
            i === 8 ? (
              <div
                key={i}
                className="flex aspect-square items-center justify-center border-2 border-dashed border-env-primary font-display text-[clamp(1.75rem,1rem+3vw,3rem)] font-bold text-env-primary"
              >
                ?
              </div>
            ) : (
              <div key={i} className="aspect-square border border-env-border bg-env-surface p-[8%]">
                <CellSvg cell={cell} />
              </div>
            ),
          )}
        </div>

        <div className="flex w-full max-w-md flex-col gap-2 lg:w-auto lg:min-w-[16rem]">
          <p className="hud-label">{t('Elige la pieza que falta')}</p>
          <div className={`grid gap-2 ${cols}`}>
            {puzzle.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => choose(i)}
                disabled={picked !== null}
                aria-label={t('Opción {n}', { n: i + 1 })}
                className={`aspect-square min-h-11 min-w-11 touch-manipulation border-2 bg-env-surface p-[10%] text-env-text transition-colors lg:w-[7.5rem] ${
                  picked === i
                    ? 'border-env-primary bg-env-primary/15'
                    : 'border-env-border hover:border-env-primary'
                }`}
              >
                <CellSvg cell={opt} />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
