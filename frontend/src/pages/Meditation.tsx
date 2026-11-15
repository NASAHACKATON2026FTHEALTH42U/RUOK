import { useEffect, useRef, useState } from 'react'
import { useInterventions, type Intervention } from '../api/useInterventions'
import { expandSteps } from '../components/behavioral/intervention'
import { InterventionPlayer } from '../components/behavioral/InterventionPlayer'
import { formatRemaining, meditationsOf, TIMER_OPTIONS } from '../components/behavioral/meditation'
import { SoundscapeIcon } from '../components/behavioral/SoundscapeIcon'
import {
  playBell,
  playSoundscape,
  setSoundscapeVolume,
  SOUNDSCAPES,
  stopSoundscape,
  type SoundscapeId,
} from '../components/behavioral/soundscapes'
import { hasVoiceFor, speak, stopSpeaking } from '../components/behavioral/voiceGuide'

const VOICE_KEY = 'ruok.meditation.voice'

/** Preferencia de voz guía del dispositivo (por defecto, sí). */
function readVoicePref(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * Meditación (FE-36, sustituye a la galería «La Tierra»): paisajes sonoros relajantes que se
 * pueden cambiar en cualquier momento (generados en el navegador, sin archivos ni internet) y
 * meditaciones guiadas del catálogo (`interventions.json`, categoría `meditation`, con fuentes en
 * docs/sources.md). Una meditación se reproduce en el modo guiado de las intervenciones, con el
 * paisaje elegido de fondo, una campana al empezar y al terminar y, si se han generado los
 * audios (FE-37, ElevenLabs, empaquetados), una voz guía que dice cada paso y baja el paisaje.
 */
export default function Meditation() {
  const interventions = useInterventions()
  const meditations = interventions.state === 'ready' ? meditationsOf(interventions.data) : []
  const [playing, setPlaying] = useState<SoundscapeId | null>(null)
  const [chosen, setChosen] = useState<SoundscapeId>('ocean')
  const [volume, setVolume] = useState(0.6)
  const [timerMin, setTimerMin] = useState<number>(0)
  // El temporizador usa el reloj del dispositivo, no el de la demo (que va acelerado).
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [session, setSession] = useState<Intervention | null>(null)
  const [noAudio, setNoAudio] = useState(false)
  const [voiceOn, setVoiceOn] = useState(readVoicePref)
  const [voiceReady, setVoiceReady] = useState(false)
  const firstLine = useRef(0)

  // ¿Hay audios de la voz guía para estas meditaciones?
  const allSteps = meditations.flatMap((m) => m.steps).join('\n')
  useEffect(() => {
    if (!allSteps) return
    void hasVoiceFor(allSteps.split('\n')).then(setVoiceReady)
  }, [allSteps])
  const voice = voiceOn && voiceReady
  const toggleVoice = () => {
    const next = !voiceOn
    setVoiceOn(next)
    if (!next) stopSpeaking()
    try {
      localStorage.setItem(VOICE_KEY, next ? 'on' : 'off')
    } catch {
      // sin almacenamiento, la preferencia dura lo que la página
    }
  }

  // Al salir de la sección, el sonido y la voz se apagan.
  useEffect(
    () => () => {
      window.clearTimeout(firstLine.current)
      stopSpeaking()
      stopSoundscape(400)
    },
    [],
  )

  // Temporizador: cuenta atrás y, al acabar, un fundido largo.
  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [endsAt])
  useEffect(() => {
    if (endsAt !== null && now >= endsAt) {
      stopSoundscape(8000)
      setPlaying(null)
      setEndsAt(null)
    }
  }, [now, endsAt])

  const play = (id: SoundscapeId, minutes = timerMin) => {
    setChosen(id)
    if (!playSoundscape(id)) {
      setNoAudio(true)
      return
    }
    setSoundscapeVolume(volume)
    setPlaying(id)
    setNow(Date.now())
    setEndsAt(minutes ? Date.now() + minutes * 60_000 : null)
  }
  const stop = () => {
    stopSoundscape()
    setPlaying(null)
    setEndsAt(null)
  }
  const toggle = (id: SoundscapeId) => (playing === id ? stop() : play(id))

  const startSession = (m: Intervention) => {
    if (!playing) play(chosen)
    playBell()
    setSession(m)
    // La primera frase, después de la campana.
    window.clearTimeout(firstLine.current)
    if (voice) firstLine.current = window.setTimeout(() => void speak(m.steps[0]), 1500)
  }
  const endSession = () => {
    window.clearTimeout(firstLine.current)
    stopSpeaking()
    setSession(null)
  }
  /** Cada paso nuevo: su frase (si hay voz y audio) o la campana; al terminar, la campana. */
  const onStep = (index: number, done: boolean) => {
    window.clearTimeout(firstLine.current)
    if (done || !session) {
      stopSpeaking()
      playBell()
      return
    }
    const text = expandSteps(session.steps)[index]?.text
    if (voice && text) void speak(text).then((ok) => !ok && playBell())
    else playBell()
  }

  /** Interruptor de la voz guía (solo si se han generado los audios). */
  const voiceToggle = (compact: boolean) =>
    voiceReady && (
      <button
        type="button"
        aria-pressed={voiceOn}
        onClick={toggleVoice}
        title="Voz guía"
        className={`inline-flex items-center gap-2 rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
          compact ? 'size-10 justify-center' : 'min-h-10 px-3 text-sm'
        } ${
          voiceOn
            ? 'border-env-primary bg-env-primary/15 text-env-text'
            : 'border-env-border text-env-muted hover:text-env-text'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
          {!voiceOn && <path d="M3 3l18 18" />}
        </svg>
        {compact ? <span className="sr-only">Voz guía</span> : 'Voz guía'}
      </button>
    )

  const current = SOUNDSCAPES.find((s) => s.id === playing)

  /** Botones de paisaje compactos, para cambiarlo sin salir de una meditación. */
  const switcher = (
    <div role="group" aria-label="Paisaje sonoro" className="flex gap-1">
      {SOUNDSCAPES.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={playing === s.id}
          aria-label={s.name}
          title={s.name}
          onClick={() => toggle(s.id)}
          className={`flex size-10 items-center justify-center rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
            playing === s.id
              ? 'border-env-primary bg-env-primary/15 text-env-primary'
              : 'border-env-border text-env-muted hover:text-env-text'
          }`}
        >
          <SoundscapeIcon id={s.id} size={20} />
        </button>
      ))}
    </div>
  )

  return (
    <section className="flex flex-1 flex-col gap-4 lg:gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Meditación</h1>
        <p className="text-env-muted lg:text-lg">
          Elige un paisaje sonoro y, si quieres, una meditación guiada. Puedes cambiar el sonido
          cuando quieras.
        </p>
      </header>

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <section aria-labelledby="scapes-title" className="hud-panel flex min-w-0 flex-col">
          <h2 id="scapes-title" className="hud-panel-head">
            Paisajes sonoros
          </h2>
          <ul className="grid flex-1 auto-rows-fr grid-cols-2 sm:grid-cols-3">
            {SOUNDSCAPES.map((s) => {
              const on = playing === s.id
              return (
                <li key={s.id} className="border-r border-b border-env-border/60">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s.id)}
                    className={`flex h-full min-h-28 w-full flex-col items-start justify-center gap-2 p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary lg:p-6 ${
                      on
                        ? 'bg-env-primary/12 shadow-[inset_3px_0_0_var(--env-primary)]'
                        : 'hover:bg-env-primary/8'
                    }`}
                  >
                    <span className={on ? 'text-env-primary' : 'text-env-muted'}>
                      <SoundscapeIcon id={s.id} size={34} />
                    </span>
                    <span className="font-display text-lg font-semibold tracking-wide lg:text-xl">
                      {s.name}
                    </span>
                    <span className="text-sm text-env-muted lg:text-base">{s.description}</span>
                    {on && (
                      <span className="hud-label flex items-center gap-1.5 text-env-primary">
                        <span aria-hidden className="meditation-bars">
                          <i />
                          <i />
                          <i />
                        </span>
                        Sonando
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Volumen, temporizador y estado. */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-env-border/60 px-4 py-3 lg:px-6">
            <label className="flex items-center gap-3 text-sm">
              Volumen
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVolume(v)
                  setSoundscapeVolume(v)
                }}
                className="w-32 accent-[var(--env-primary)] lg:w-44"
              />
            </label>
            <label className="flex items-center gap-3 text-sm">
              Temporizador
              <select
                value={timerMin}
                onChange={(e) => {
                  const m = Number(e.target.value)
                  setTimerMin(m)
                  if (playing) setEndsAt(m ? Date.now() + m * 60_000 : null)
                }}
                className="rounded-md border border-env-border bg-env-surface px-2 py-1.5 text-env-text"
              >
                {TIMER_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m ? `${m} min` : 'Sin límite'}
                  </option>
                ))}
              </select>
            </label>
            <p className="min-w-0 flex-1 text-sm text-env-muted" aria-live="polite">
              {noAudio
                ? 'Este navegador no puede reproducir sonido.'
                : current
                  ? `Sonando: ${current.name}${endsAt ? ` · quedan ${formatRemaining(endsAt - now)}` : ''}`
                  : 'Toca un paisaje para escucharlo.'}
            </p>
            {current && (
              <button
                type="button"
                onClick={stop}
                className="rounded-md border border-env-border px-3 py-1.5 text-sm hover:border-env-text focus-visible:outline-2 focus-visible:outline-env-primary"
              >
                Parar
              </button>
            )}
          </div>
        </section>

        <section aria-labelledby="guided-title" className="hud-panel flex min-w-0 flex-col">
          <div className="hud-panel-head">
            <h2 id="guided-title">Meditaciones guiadas</h2>
            <span className="mr-2.5 ml-auto">{voiceToggle(false)}</span>
          </div>
          {interventions.state === 'loading' && (
            <div className="m-4 h-40 animate-pulse rounded-lg bg-env-bg" aria-busy="true" />
          )}
          {interventions.state === 'error' && (
            <p className="p-4 text-sm text-env-muted">
              No se han podido cargar las meditaciones.{' '}
              <button type="button" onClick={interventions.retry} className="underline">
                Reintentar
              </button>
            </p>
          )}
          <ul className="flex-1 divide-y divide-env-border/60">
            {meditations.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-4 py-4 lg:px-6">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold tracking-wide lg:text-lg">{m.title}</p>
                  <p className="text-sm text-env-muted">
                    {m.duration_min} min · {m.steps[0]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startSession(m)}
                  className="shrink-0 rounded-lg bg-env-primary px-4 py-2.5 font-semibold text-env-primary-text hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary"
                >
                  Empezar
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-env-border/60 px-4 py-3 text-xs text-env-muted lg:px-6">
            Si vas a dormir, marca «Sueño» en Actividad: el sistema esperará más antes de
            preguntarte «R U OK?».
            {voiceReady && ' La voz guía está generada con IA (ElevenLabs).'}
          </p>
        </section>
      </div>

      {session && (
        <InterventionPlayer
          intervention={session}
          onClose={endSession}
          onStepChange={onStep}
          toolbar={
            <>
              {voiceToggle(true)}
              {switcher}
            </>
          }
        />
      )}
    </section>
  )
}
