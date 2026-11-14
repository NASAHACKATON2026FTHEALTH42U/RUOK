/**
 * "hace 12 min", "hace 2 h 5 min", "hace 3 d". Usa siempre `now = serverNow()`:
 * con el fast-forward de la demo, el reloj del dispositivo no vale.
 */
export function formatAgo(iso: string, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60_000))
  if (min < 1) return 'hace menos de 1 min'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  return `hace ${Math.floor(h / 24)} d`
}
