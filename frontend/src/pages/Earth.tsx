import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { startAmbient, stopAmbient } from '../components/behavioral/ambient'
import { EARTH_PHOTOS, PHOTO_CREDIT, step } from '../components/behavioral/earthPhotos'

const SLIDE_MS = 12_000

/**
 * Earth view (FE-25, docs/behavioral-health.md "Conexión con la Tierra"): galería de fotos de la
 * Tierra empaquetadas (NASA, dominio público) con sonido ambiente opcional. Funciona sin
 * internet: las fotos van en el build y el sonido se genera en el navegador.
 */
export default function Earth() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [sound, setSound] = useState(false)
  const photo = EARTH_PHOTOS[index]
  const go = useCallback(
    (delta: number) => setIndex((i) => step(i, delta, EARTH_PHOTOS.length)),
    [],
  )

  // Precarga: todas las fotos quedan en la caché del navegador desde la primera visita.
  useEffect(() => {
    for (const p of EARTH_PHOTOS) new Image().src = p.src
  }, [])

  // Pase automático
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => go(1), SLIDE_MS)
    return () => clearInterval(id)
  }, [playing, go])

  // Flechas del teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go])

  // El sonido se para al salir de la página
  useEffect(() => () => stopAmbient(), [])

  const toggleSound = () => {
    if (sound) {
      stopAmbient()
      setSound(false)
    } else {
      setSound(startAmbient())
    }
  }

  const btn =
    'rounded-lg border border-env-border px-3 py-1.5 text-sm hover:border-env-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary'

  return (
    <MotionConfig reducedMotion="user">
      <section className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">La Tierra</h1>
          <p className="text-env-muted">Un momento para mirar casa.</p>
        </header>

        <figure className="overflow-hidden rounded-2xl border border-env-border bg-black">
          <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
            <AnimatePresence initial={false} mode="wait">
              <motion.img
                key={photo.id}
                src={photo.src}
                alt={`${photo.title}. ${photo.caption}`}
                className="absolute inset-0 h-full w-full object-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
              />
            </AnimatePresence>
          </div>
          <figcaption className="bg-env-surface px-4 py-3" aria-live="polite">
            <p className="font-semibold">{photo.title}</p>
            <p className="text-sm">{photo.caption}</p>
            <p className="mt-1 text-xs text-env-muted">
              {photo.date} · {PHOTO_CREDIT}
            </p>
          </figcaption>
        </figure>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => go(-1)} aria-label="Foto anterior">
            ← Anterior
          </button>
          <button type="button" className={btn} onClick={() => go(1)} aria-label="Foto siguiente">
            Siguiente →
          </button>
          <button
            type="button"
            className={btn}
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
          >
            {playing ? '⏸ Pausar pase' : '▶ Pase automático'}
          </button>
          <button type="button" className={btn} onClick={toggleSound} aria-pressed={sound}>
            {sound ? '🔊 Sonido ambiente' : '🔇 Sonido ambiente'}
          </button>
          <span className="ml-auto text-sm text-env-muted tabular-nums">
            {index + 1} / {EARTH_PHOTOS.length}
          </span>
        </div>

        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Fotos">
          {EARTH_PHOTOS.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index}
                aria-label={p.title}
                className={`block aspect-square w-full overflow-hidden rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
                  i === index
                    ? 'border-env-text'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={p.src} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </MotionConfig>
  )
}
