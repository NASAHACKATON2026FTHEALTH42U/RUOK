import { useEffect, useRef, useState } from 'react'
import { unlockAudio } from './soundscapes'
import { setVoicePref, useVoiceAvailable, useVoicePref } from './useVoice'
import { VOICE_NOTE } from './voice'
import { speakSequence, stopSpeaking, voiceGeneration } from './voiceGuide'

function SpeakerIcon({ muted = false, size = 18 }: { muted?: boolean; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
      {muted && <path d="M3 3l18 18" />}
    </svg>
  )
}

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary'

/**
 * Interruptor «Voz guía» (FE-37): con él encendido, las partes guiadas leen cada paso al
 * mostrarlo. La preferencia es del dispositivo y vale para todas. Quien lo pinta decide si hay
 * audio para sus textos (`useVoiceAvailable`).
 */
export function VoiceToggle({
  compact = false,
  onToggle,
}: {
  compact?: boolean
  /** Tras cambiarla (dentro del clic): p. ej. leer ya la pregunta actual al encenderla. */
  onToggle?: (on: boolean) => void
}) {
  const on = useVoicePref()
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        unlockAudio() // dentro del clic: si se enciende, la primera frase podrá sonar
        if (on) stopSpeaking()
        setVoicePref(!on)
        onToggle?.(!on)
      }}
      title={`Voz guía. ${VOICE_NOTE}`}
      className={`inline-flex shrink-0 items-center gap-2 rounded-lg border ${FOCUS} ${
        compact ? 'size-11 justify-center' : 'min-h-11 px-3 text-sm'
      } ${
        on
          ? 'border-env-primary bg-env-primary/15 text-env-text'
          : 'border-env-border text-env-muted hover:text-env-text'
      }`}
    >
      <SpeakerIcon muted={!on} />
      {compact ? <span className="sr-only">Voz guía</span> : 'Voz guía'}
    </button>
  )
}

interface ListenButtonProps {
  /** Frases que se leen en orden (las que no tienen audio se saltan). */
  texts: readonly string[]
  label?: string
  /** Solo el icono (con el texto para lectores de pantalla). */
  iconOnly?: boolean
  className?: string
}

/**
 * «Escuchar» (FE-37): lee en voz alta unos pasos o instrucciones a demanda, aunque la «Voz guía»
 * esté apagada (es un gesto explícito). Otro clic, o salir, la para. No aparece si esos textos
 * no tienen audio.
 */
export function ListenButton({
  texts,
  label = 'Escuchar',
  iconOnly = false,
  className = '',
}: ListenButtonProps) {
  const available = useVoiceAvailable(texts)
  const [playing, setPlaying] = useState(false)
  // La lectura que lanzó este botón: al desmontarlo se para solo si sigue siendo la que suena.
  const mine = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (mine.current !== null && mine.current === voiceGeneration()) stopSpeaking()
      mine.current = null
    },
    [],
  )

  if (!available) return null

  const toggle = () => {
    if (playing) {
      stopSpeaking()
      mine.current = null
      setPlaying(false)
      return
    }
    unlockAudio()
    setPlaying(true)
    const done = speakSequence(texts)
    const gen = voiceGeneration()
    mine.current = gen
    void done.then(() => {
      if (mine.current === gen) {
        mine.current = null
        setPlaying(false)
      }
    })
  }

  const text = playing ? 'Parar' : label
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      title={`${playing ? 'Parar la voz' : label}. ${VOICE_NOTE}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border text-sm ${FOCUS} ${
        iconOnly ? 'size-11 justify-center' : 'min-h-11 px-3'
      } ${
        playing
          ? 'border-env-primary bg-env-primary/15 text-env-text'
          : 'border-env-border text-env-muted hover:border-env-text hover:text-env-text'
      } ${className}`}
    >
      <SpeakerIcon size={16} />
      {iconOnly ? <span className="sr-only">{text}</span> : text}
    </button>
  )
}

/** Línea de transparencia, solo si hay audio para esos textos. */
export function VoiceNote({
  texts,
  className = '',
}: {
  texts: readonly string[]
  className?: string
}) {
  const available = useVoiceAvailable(texts)
  if (!available) return null
  return <p className={`text-xs text-env-muted ${className}`}>{VOICE_NOTE}</p>
}
