import { defaultTheme } from './defaultTheme'
import { earth } from './earth'
import { geriatric } from './geriatric'
import { hospital } from './hospital'
import { iss } from './iss'
import { mars } from './mars'
import { moon } from './moon'
import type { Theme } from './types'

export type { Theme } from './types'
export { defaultTheme }

/** Temas por entorno. Si un entorno no tiene tema, se usa `defaultTheme` (docs/environments.md). */
export const THEMES: Record<string, Theme | undefined> = {
  iss,
  moon,
  mars,
  earth,
  hospital,
  geriatric,
}

export function themeFor(envId: string | null): Theme {
  return (envId && THEMES[envId]) || defaultTheme
}
