/**
 * UUID v4 para los POST idempotentes (mediciones, alertas, completados…).
 *
 * ⚠️ No uses `crypto.randomUUID()`: solo existe en contexto seguro (HTTPS o localhost),
 * y los móviles entran por http://<IP-del-servidor> en la red local
 * (docs/control-center-and-devices.md §5). `crypto.getRandomValues()` sí está disponible.
 * ESLint prohíbe `crypto.randomUUID` en todo el front.
 */
export function newId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
