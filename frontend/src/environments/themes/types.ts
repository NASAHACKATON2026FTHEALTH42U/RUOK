/** Tokens de color de un entorno. Los colores del semáforo NO van aquí (FE-04: paleta fija). */
export interface Theme {
  scheme: 'dark' | 'light'
  /** Estilo HUD (fondo con rejilla, paneles con esquina cortada): ISS, Luna y Marte. */
  hud?: boolean
  /** Fondo de la app. */
  bg: string
  /** Tarjetas, cabecera, paneles. */
  surface: string
  border: string
  text: string
  /** Texto secundario. */
  muted: string
  /** Relleno de botones, enlace activo y foco. Solo como relleno, no como color de texto. */
  primary: string
  /** Texto encima de `primary`. */
  primaryText: string
}
