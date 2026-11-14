import { newId } from '../api/newId'

/**
 * Identidad del dispositivo (FE-30, docs/control-center-and-devices.md §4).
 *
 * - Dispositivo real: `device_id` en `localStorage` (uno por navegador).
 * - Modo pestaña (ensayos con un solo portátil): `?device=<nombre>` fija un dispositivo con
 *   nombre y `?device=tab` crea uno nuevo; se guarda en `sessionStorage`, que es de cada pestaña,
 *   así que la pestaña lo conserva al navegar o recargar.
 *
 * El `device_id` siempre es un UUID (el back lo valida). Para un nombre se deriva un UUID
 * determinista: el mismo nombre da el mismo dispositivo. Se calcula de forma síncrona porque
 * decide qué base IndexedDB abrir (`ruok-<device_id>`) y la clave de la sesión.
 */

export interface DeviceIdentity {
  id: string
  /** Nombre legible si se fijó con `?device=<nombre>`; null en un dispositivo real. */
  name: string | null
  mode: 'device' | 'tab'
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const LOCAL_KEY = 'ruok-device-id'
const TAB_KEY = 'ruok-tab-device'

/** Nombre de dispositivo seguro: minúsculas, números, guiones; máx. 40 caracteres. */
export function sanitizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** UUID determinista (formato v8) a partir de un nombre: FNV-1a de 32 bits con 4 semillas. */
export function uuidFromName(name: string): string {
  const words = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => {
    let h = seed >>> 0
    for (const ch of `ruok:${name}`) {
      h ^= ch.codePointAt(0)!
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  })
  const hex = words.join('').split('')
  hex[12] = '8' // versión 8 (UUID personalizado)
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) // variante RFC 4122
  const s = hex.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

/** Resuelve la identidad a partir de la URL y los almacenamientos (pura: fácil de testear). */
export function resolveDevice(
  search: string,
  local: KeyValueStorage,
  session: KeyValueStorage,
  makeId: () => string = newId,
): DeviceIdentity {
  const param = new URLSearchParams(search).get('device')
  if (param !== null) {
    const name = sanitizeName(param)
    const identity: DeviceIdentity =
      name === '' || name === 'tab'
        ? { id: makeId(), name: null, mode: 'tab' }
        : { id: uuidFromName(name), name, mode: 'tab' }
    session.setItem(TAB_KEY, JSON.stringify(identity))
    return identity
  }

  const tab = session.getItem(TAB_KEY)
  if (tab) {
    try {
      const parsed = JSON.parse(tab) as DeviceIdentity
      if (parsed?.id) return parsed
    } catch {
      // valor corrupto: se ignora y se usa el dispositivo real
    }
  }

  let id = local.getItem(LOCAL_KEY)
  if (!id) {
    id = makeId()
    local.setItem(LOCAL_KEY, id)
  }
  return { id, name: null, mode: 'device' }
}

/** Almacenamiento en memoria por si el navegador bloquea localStorage/sessionStorage. */
function memoryStorage(): KeyValueStorage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

function safe(get: () => Storage): KeyValueStorage {
  try {
    const s = get()
    s.getItem('ruok-probe')
    return s
  } catch {
    return memoryStorage()
  }
}

let current: DeviceIdentity | null = null

/** Identidad de este dispositivo/pestaña (se calcula una vez por carga de página). */
export function getDevice(): DeviceIdentity {
  current ??= resolveDevice(
    globalThis.location?.search ?? '',
    safe(() => localStorage),
    safe(() => sessionStorage),
  )
  return current
}
