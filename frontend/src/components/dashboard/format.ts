import type { Schema } from '../../api/client'
import { dateLocale } from '../../i18n/lang'
import { translate } from '../../i18n/t'

type Trend = Schema<'Trend'>

/** Tendencia con flecha + texto (nunca solo color). */
export function formatTrend(trend: Trend): { arrow: string; label: string } {
  switch (trend) {
    case 'rising':
      return { arrow: '↑', label: translate('Subiendo') }
    case 'falling':
      return { arrow: '↓', label: translate('Bajando') }
    case 'stable':
      return { arrow: '→', label: translate('Estable') }
    default:
      return { arrow: '·', label: translate('Sin tendencia') }
  }
}

/** Los cinco peligros de los vuelos espaciales (NASA HRP, "RIDGE"). Un slug desconocido se muestra tal cual. */
const HAZARDS: Record<string, string> = {
  radiation: 'Radiación espacial',
  isolation: 'Aislamiento y confinamiento',
  distance: 'Distancia de la Tierra',
  gravity: 'Gravedad alterada',
  hostile_environment: 'Entorno cerrado y hostil',
}

export function formatHazard(slug: string): string {
  const label = HAZARDS[slug]
  return label ? translate(label) : slug
}

/** Valor con unidad. Las escalas `1-5` se muestran como "3 / 5". */
export function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '—'
  const n = value.toLocaleString(dateLocale(), { maximumFractionDigits: 1 })
  if (unit === '1-5') return `${n} / 5`
  return unit ? `${n} ${unit}` : n
}

/** Origen de una medición (`Measurement.source`). */
const SOURCES: Record<string, string> = {
  manual: 'Manual',
  device: 'Dispositivo',
  camera: 'Cámara',
  checkin: 'Check-in',
  pvt: 'Test PVT',
}

export function formatSource(source: string): string {
  const label = SOURCES[source]
  return label ? translate(label) : source
}
