import { useEnvironmentStore } from '../store/environment'
import { themeFor, type Theme } from './themes'

/** Token del tema → variable CSS que leen las clases `*-env-*` de Tailwind (styles/index.css). */
const CSS_VARS: Record<keyof Omit<Theme, 'scheme'>, string> = {
  bg: '--env-bg',
  surface: '--env-surface',
  border: '--env-border',
  text: '--env-text',
  muted: '--env-muted',
  primary: '--env-primary',
  primaryText: '--env-primary-text',
}

function applyTheme(envId: string | null, theme: Theme) {
  const root = document.documentElement
  for (const [token, cssVar] of Object.entries(CSS_VARS)) {
    root.style.setProperty(cssVar, theme[token as keyof typeof CSS_VARS])
  }
  root.style.colorScheme = theme.scheme
  root.dataset.env = envId ?? 'default'
}

/**
 * Aplica el tema del entorno activo en `<html>` y lo actualiza cada vez que cambia `envId`.
 * Se llama una vez en main.tsx, antes del primer render, para que no haya parpadeo de colores.
 */
export function initTheme() {
  const { envId } = useEnvironmentStore.getState()
  applyTheme(envId, themeFor(envId))
  // Activa las transiciones después del primer pintado, no durante la carga.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => document.documentElement.setAttribute('data-theme-ready', '')),
  )
  return useEnvironmentStore.subscribe((state, prev) => {
    if (state.envId !== prev.envId) applyTheme(state.envId, themeFor(state.envId))
  })
}
