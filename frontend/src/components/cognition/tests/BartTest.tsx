import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useT } from '../../../i18n/t'
import { useLangStore } from '../../../i18n/lang'
import type { CognitiveTestProps } from '../types'
import {
  BALLOONS,
  MAX_PUMPS,
  POINTS_PER_PUMP,
  explosionPoints,
  pops as popsAt,
  scoreBart,
  type BalloonOutcome,
} from './bart'

/** Cuánto se ve el estallido o el «cobrado» antes del siguiente globo. */
const FEEDBACK_MS = 900

type Phase = 'intro' | 'play' | 'popped' | 'cashed'

/**
 * BART (FE-39): 12 globos. Cada inflado suma un punto al banco del globo; «Cobrar» lo pasa al
 * total; si el globo llega a su punto de explosión oculto (1–64), revienta y el banco se pierde.
 * Mide la calibración del riesgo, no quién arriesga más.
 */
export default function BartTest({ onFinish }: CognitiveTestProps) {
  const t = useT()
  const lang = useLangStore((s) => s.lang)
  const reduce = useReducedMotion()
  const points = useMemo(() => explosionPoints(Date.now()), [])
  const [phase, setPhase] = useState<Phase>('intro')
  const [index, setIndex] = useState(0)
  const [pumps, setPumps] = useState(0)
  const [outcomes, setOutcomes] = useState<BalloonOutcome[]>([])
  const doneRef = useRef(false)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  const total = outcomes.reduce((s, o) => s + (o.popped ? 0 : o.pumps * POINTS_PER_PUMP), 0)
  const bank = pumps * POINTS_PER_PUMP

  const pump = useCallback(() => {
    if (phase !== 'play') return
    const next = pumps + 1
    setPumps(next)
    if (popsAt(next, points[index])) {
      setOutcomes((o) => [...o, { pumps: next, popped: true }])
      setPhase('popped')
    }
  }, [phase, pumps, points, index])

  const cash = useCallback(() => {
    if (phase !== 'play') return
    setOutcomes((o) => [...o, { pumps, popped: false }])
    setPhase('cashed')
  }, [phase, pumps])

  // Tras el estallido o el cobro: siguiente globo, o fin de la prueba.
  useEffect(() => {
    if (phase !== 'popped' && phase !== 'cashed') return
    const id = window.setTimeout(() => {
      if (outcomes.length >= BALLOONS) {
        if (doneRef.current) return
        doneRef.current = true
        const r = scoreBart(outcomes)
        finishRef.current({
          score: r.score,
          summary: translate3(r.total_points, r.adjusted_pumps, r.pops),
          metrics: {
            total_points: r.total_points,
            adjusted_pumps: r.adjusted_pumps,
            pops: r.pops,
          },
        })
        return
      }
      setIndex((i) => i + 1)
      setPumps(0)
      setPhase('play')
    }, FEEDBACK_MS)
    return () => window.clearTimeout(id)
    function translate3(p: number, avg: number, popped: number) {
      return t('{p} puntos · {pumps} infladas de media · {pops} explotados', {
        p,
        pumps: avg.toLocaleString(lang === 'en' ? 'en-US' : 'es-ES', {
          maximumFractionDigits: 1,
        }),
        pops: popped,
      })
    }
  }, [phase, outcomes, t, lang])

  // Teclado en ordenador: espacio infla, Intro cobra.
  useEffect(() => {
    if (phase !== 'play') return
    // En captura y con preventDefault: el botón con foco no se activa además (doble acción).
    const onKey = (e: KeyboardEvent) => {
      const isKey = e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter'
      if (!isKey) return
      e.preventDefault()
      if (e.type === 'keyup' || e.repeat) return
      if (e.code === 'Space') {
        pump()
      } else {
        cash()
      }
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKey, true)
    }
  }, [phase, pump, cash])

  if (phase === 'intro') {
    return (
      <div className="hud-panel flex w-full max-w-xl flex-col gap-4 p-[clamp(1rem,3vw,2rem)] text-[clamp(0.95rem,0.9rem+0.3vw,1.1rem)]">
        <p className="hud-label">{t('Cómo funciona')}</p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>{t('Verás {n} globos, uno detrás de otro.', { n: BALLOONS })}</li>
          <li>{t('Cada vez que lo inflas, sumas 1 punto al banco del globo.')}</li>
          <li>
            {t(
              'Cada globo explota en un punto distinto y oculto: si revienta, pierdes lo de ese globo.',
            )}
          </li>
          <li>{t('Pulsa «Cobrar» para guardar el banco en tu total y pasar al siguiente.')}</li>
        </ul>
        <p className="text-env-muted">
          {t(
            'No se trata de ganar a toda costa, sino de calibrar el riesgo: ni demasiado prudente ni demasiado arriesgado.',
          )}
        </p>
        <button
          type="button"
          onClick={() => setPhase('play')}
          className="hud-btn hud-btn-primary !h-14 w-full text-base"
        >
          {t('Empezar')}
        </button>
      </div>
    )
  }

  const busy = phase !== 'play'
  // Tamaño del globo: de 35 % a 100 % según los inflados (hasta el máximo posible).
  const scale = 0.35 + (0.65 * Math.min(pumps, MAX_PUMPS)) / MAX_PUMPS
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 18 }

  return (
    <div className="flex w-full max-w-xl flex-col items-stretch gap-4 select-none">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label={t('Globo')} value={t('{n} de {total}', { n: index + 1, total: BALLOONS })} />
        <Stat label={t('Banco')} value={String(bank)} highlight />
        <Stat label={t('Total')} value={String(total)} />
      </div>

      <div
        className="relative mx-auto aspect-square w-full max-w-[min(22rem,48dvh)]"
        aria-live="polite"
      >
        <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label={t('Globo')}>
          {/* cuerda */}
          <path
            d="M100 172 C 94 182, 106 188, 100 198"
            fill="none"
            stroke="var(--env-muted)"
            strokeWidth="1.5"
            opacity={phase === 'popped' ? 0.3 : 1}
          />
          <AnimatePresence mode="wait">
            {phase === 'popped' ? (
              <Burst key={`pop-${index}`} reduce={!!reduce} />
            ) : (
              <motion.g
                key={`b-${index}`}
                style={{ originX: 0.5, originY: 1 }}
                initial={{ scale: 0.35, opacity: reduce ? 1 : 0 }}
                animate={{ scale, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={spring}
              >
                <path
                  d="M100 172 C 40 150, 18 100, 30 64 C 42 26, 72 8, 100 8 C 128 8, 158 26, 170 64 C 182 100, 160 150, 100 172 Z"
                  fill="color-mix(in srgb, var(--env-primary) 55%, transparent)"
                  stroke="var(--env-primary)"
                  strokeWidth="2"
                />
                <path d="M94 172 L106 172 L102 179 L98 179 Z" fill="var(--env-primary)" />
                <ellipse
                  cx="68"
                  cy="58"
                  rx="12"
                  ry="22"
                  transform="rotate(-25 68 58)"
                  fill="white"
                  opacity="0.25"
                />
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
        {phase !== 'play' && (
          <p className="absolute inset-x-0 bottom-0 text-center font-display text-[clamp(1.1rem,1rem+0.8vw,1.5rem)] font-bold">
            {phase === 'popped'
              ? t('¡Ha explotado! Pierdes {n} puntos', { n: bank })
              : t('+{n} puntos cobrados', { n: bank })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={pump}
          disabled={busy}
          className="hud-btn !h-16 text-[clamp(1rem,0.95rem+0.4vw,1.2rem)]"
        >
          {t('Inflar')}
        </button>
        <button
          type="button"
          onClick={cash}
          disabled={busy || pumps === 0}
          className="hud-btn hud-btn-primary !h-16 text-[clamp(1rem,0.95rem+0.4vw,1.2rem)]"
        >
          {t('Cobrar')}
        </button>
      </div>
      <p className="hidden text-center text-sm text-env-muted sm:block">
        {t('Teclado: espacio para inflar, Intro para cobrar.')}
      </p>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="hud-panel flex flex-col items-center gap-1 px-2 py-2">
      <span className="hud-label">{label}</span>
      <span
        className={`font-display text-[clamp(1.25rem,1rem+1.2vw,2rem)] font-bold tabular-nums ${
          highlight ? 'text-env-primary' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}

/** Estallido: fragmentos que salen del centro del globo. */
function Burst({ reduce }: { reduce: boolean }) {
  const shards = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2)
  return (
    <motion.g initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {shards.map((a, i) => {
        const x1 = 100 + Math.cos(a) * 12
        const y1 = 90 + Math.sin(a) * 12
        const x2 = 100 + Math.cos(a) * 46
        const y2 = 90 + Math.sin(a) * 46
        return (
          <motion.line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--env-primary)"
            strokeWidth="4"
            strokeLinecap="square"
            initial={reduce ? false : { pathLength: 0, opacity: 1 }}
            animate={reduce ? { opacity: 1 } : { pathLength: 1, opacity: [1, 1, 0.15] }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
          />
        )
      })}
    </motion.g>
  )
}
