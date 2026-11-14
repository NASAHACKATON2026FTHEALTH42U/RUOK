import type { Theme } from './types'

/**
 * Estilo HUD de los entornos espaciales (docs/design/hud-style.md §3).
 * Con `hud: true`, initTheme() marca <html data-hud> y se activan el fondo con rejilla
 * y las clases `hud-*` de styles/index.css.
 */
export const hud: Theme = {
  scheme: 'dark',
  hud: true,
  bg: '#091317',
  surface: '#09151A',
  border: '#1C3540',
  text: '#E6F1F3',
  muted: '#7C9AA3',
  primary: '#5FD4E8',
  primaryText: '#04161B',
}
