import { translate } from '../i18n/t'

/**
 * "hace 12 min", "hace 2 h 5 min", "hace 3 d". Usa siempre `now = serverNow()`:
 * con el fast-forward de la demo, el reloj del dispositivo no vale.
 */
export function formatAgo(iso: string, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000))
  if (min < 1) return translate('hace menos de 1 min')
  if (min < 60) return translate('hace {min} min', { min })
  const h = Math.floor(min / 60)
  if (h < 24)
    return min % 60
      ? translate('hace {h} h {min} min', { h, min: min % 60 })
      : translate('hace {h} h', { h })
  return translate('hace {d} d', { d: Math.floor(h / 24) })
}
