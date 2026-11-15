/**
 * Estado de la voz guía para los componentes (FE-37): la preferencia «Voz guía» del dispositivo,
 * compartida por todas las partes guiadas (cambiarla en una la cambia en todas), y si hay audio
 * generado para unos textos.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { prefFromStorage, VOICE_KEY } from './voice'
import { hasVoiceFor } from './voiceGuide'

const listeners = new Set<() => void>()
let pref: boolean | null = null

/** Preferencia actual (por defecto, sí; lee la clave antigua de las meditaciones). */
export function voicePref(): boolean {
  if (pref === null) {
    try {
      pref = prefFromStorage((key) => localStorage.getItem(key))
    } catch {
      pref = true
    }
  }
  return pref
}

/** Cambia la preferencia en todo el dispositivo. */
export function setVoicePref(on: boolean): void {
  pref = on
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off')
  } catch {
    // sin almacenamiento, la preferencia dura lo que la página
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** La preferencia «Voz guía», reactiva. */
export function useVoicePref(): boolean {
  return useSyncExternalStore(subscribe, voicePref, voicePref)
}

/** ¿Hay audio para alguno de estos textos? false mientras se comprueba. */
export function useVoiceAvailable(texts: readonly string[]): boolean {
  const key = texts.join('\n')
  const [checked, setChecked] = useState<{ key: string; ok: boolean } | null>(null)
  useEffect(() => {
    if (!key) return
    let alive = true
    void hasVoiceFor(key.split('\n')).then((ok) => {
      if (alive) setChecked({ key, ok })
    })
    return () => {
      alive = false
    }
  }, [key])
  return checked?.key === key && checked.ok
}
