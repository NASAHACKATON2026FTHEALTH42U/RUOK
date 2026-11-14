/** URL que abre el QR de conexión: la pantalla de login del servidor en la red local (FE-32). */
export function joinUrl(lanUrl: string): string {
  return `${lanUrl.replace(/\/+$/, '')}/login`
}
