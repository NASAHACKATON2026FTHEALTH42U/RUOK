/** Textos en inglés del área «dashboard» (FE-38): clave = texto en español tal cual aparece en el código. */
export const dashboard: Record<string, string> = {
  // Estados del semáforo (ui/status.ts), traducidos donde se pintan en esta área.
  Normal: 'Normal',
  Atención: 'Warning',
  Crítico: 'Critical',
  'Sin datos': 'No data',
  'Sin datos recientes': 'No recent data',
  'Sin contacto': 'No contact',
  Nominal: 'Nominal',

  // dashboard/format.ts
  Subiendo: 'Rising',
  Bajando: 'Falling',
  Estable: 'Stable',
  'Sin tendencia': 'No trend',
  'Radiación espacial': 'Space radiation',
  'Aislamiento y confinamiento': 'Isolation and confinement',
  'Distancia de la Tierra': 'Distance from Earth',
  'Gravedad alterada': 'Altered gravity',
  'Entorno cerrado y hostil': 'Hostile and closed environment',
  Manual: 'Manual',
  Dispositivo: 'Device',
  Cámara: 'Camera',
  'Check-in': 'Check-in',
  'Test PVT': 'PVT test',

  // dashboard/trend.ts (previsión)
  'Aún no hay datos suficientes para prever: hacen falta al menos 7 mediciones regulares.':
    'Not enough data for a forecast yet: at least 7 regular measurements are needed.',
  'Sin mediciones recientes: registra una nueva para ver la previsión.':
    'No recent measurements: log a new one to see the forecast.',
  'El último valor se sale de lo habitual: la previsión espera a que se repita para seguirlo.':
    'The last value is unusual: the forecast will wait until it repeats before following it.',
  'Sin cambios de estado previstos en el próximo día.':
    'No status change expected over the next day.',
  'Sin cambios de estado previstos en los próximos {n} días.':
    'No status change expected over the next {n} days.',
  'El valor esperado seguiría en «{status}» el próximo día.':
    'The expected value would stay at “{status}” over the next day.',
  'El valor esperado seguiría en «{status}» los próximos {n} días.':
    'The expected value would stay at “{status}” over the next {n} days.',
  'A este ritmo, el valor esperado pasaría a «{status}» en ~1 día.':
    'At this rate, the expected value would move to “{status}” in ~1 day.',
  'A este ritmo, el valor esperado pasaría a «{status}» en ~{n} días.':
    'At this rate, the expected value would move to “{status}” in ~{n} days.',
  'A este ritmo, el valor esperado volvería a «{status}» en ~1 día.':
    'At this rate, the expected value would return to “{status}” in ~1 day.',
  'A este ritmo, el valor esperado volvería a «{status}» en ~{n} días.':
    'At this rate, the expected value would return to “{status}” in ~{n} days.',
  'A este ritmo, el valor esperado bajaría a «{status}» en ~1 día.':
    'At this rate, the expected value would drop to “{status}” in ~1 day.',
  'A este ritmo, el valor esperado bajaría a «{status}» en ~{n} días.':
    'At this rate, the expected value would drop to “{status}” in ~{n} days.',
  'Estimación estadística, no es un diagnóstico': 'Statistical estimate, not a diagnosis',
  'basada en 1 día de mediciones': 'based on 1 day of measurements',
  'basada en {n} días de mediciones': 'based on {n} days of measurements',
  puntos: 'points',
  'error medio reciente ±{amount} {unit}': 'recent mean error ±{amount} {unit}',
  'error medio reciente ±{amount}': 'recent mean error ±{amount}',

  // ForecastBlock, TrendChart, SystemTrends
  Previsión: 'Forecast',
  previsión: 'forecast',
  '1 día': '1 day',
  '{n} días': '{n} days',
  'No se ha podido cargar la previsión.': 'Could not load the forecast.',
  Reintentar: 'Retry',
  Periodo: 'Period',
  'Rango probable: {low} – {high}': 'Likely range: {low} – {high}',
  ahora: 'now',
  Medido: 'Measured',
  'Rango probable (≈ 80 %)': 'Likely range (≈ 80%)',
  'Últimos {n} días': 'Last {n} days',
  'últimos {n} días': 'last {n} days',
  'escala 1-5': '1-5 scale',
  'sin unidad': 'no unit',
  'No se ha podido cargar la serie.': 'Could not load the series.',
  'No se han podido cargar las series.': 'Could not load the series.',
  'Sin mediciones en los últimos {n} días.': 'No measurements in the last {n} days.',
  'Ver datos ({n})': 'View data ({n})',
  '{name}, últimos {n} días': '{name}, last {n} days',
  '{names}: últimos {n} días': '{names}: last {n} days',
  Fecha: 'Date',
  Valor: 'Value',
  Tendencias: 'Trends',
  'Indicadores en la gráfica': 'Indicators in the chart',
  'Tiene que quedar al menos un indicador': 'At least one indicator must remain',
  'Como mucho {n} a la vez': 'At most {n} at a time',
  'Escala común: % del rango normal de cada indicador (0–100 % = normal)':
    'Common scale: % of each indicator’s normal range (0–100% = normal)',
  '{n} % del rango': '{n}% of range',

  // IndicatorCard, SystemPanel
  '{status} · provisional': '{status} · provisional',
  'Nunca medido': 'Never measured',
  Indicadores: 'Indicators',
  Recomendaciones: 'Recommendations',
  'Qué puedes hacer ahora': 'What you can do now',
  'Escuchar recomendaciones': 'Listen to recommendations',
  Cerrar: 'Close',
  'Todavía no hay mediciones de este sistema.': 'No measurements for this system yet.',
  'Medir ahora': 'Measure now',

  // SystemsRing (móvil)
  'Buenos días': 'Good morning',
  'Buenas tardes': 'Good afternoon',
  'Buenas noches': 'Good evening',
  'Todos los sistemas, nominales.': 'All systems nominal.',
  '{list}. El resto, nominal.': '{list}. All others nominal.',
  'Sin datos recientes: estado desconocido.': 'No recent data: status unknown.',
  'Estado global': 'Overall status',
  'Estado general': 'Overall status',
  'Lo más urgente': 'Most urgent',
  'Ver qué hacer': 'See what to do',
  '{n} de {total} sistemas nominales. Toca una zona del cuerpo para ver su sistema.':
    '{n} of {total} systems nominal. Tap a body area to see its system.',
  'Sistemas del cuerpo': 'Body systems',
  Sistemas: 'Systems',
  '{crit} crít · {warn} atn': '{crit} crit · {warn} warn',
  '{name}: {status}. Ver detalle': '{name}: {status}. View details',

  // body/*
  'Sin datos desde {ago}': 'Last data {ago}',
  'sin datos recientes': 'no recent data',
  'Estado por sistema del cuerpo': 'Status by body system',
  'Último conocido: {status}': 'Last known: {status}',

  // members/* (recuentos de crewOverview.ts y tarjetas)
  '{n} crítico': '{n} critical',
  '{n} críticos': '{n} critical',
  '{n} en atención': '{n} warning',
  '{n} sin datos': '{n} no data',
  '{n} normal': '{n} normal',
  '{n} normales': '{n} normal',
  '{n} sin contacto': '{n} out of contact',
  'Resumen del conjunto': 'Group summary',
  '{n} en total': '{n} in total',
  '1 alerta abierta': '1 open alert',
  '{n} alertas abiertas': '{n} open alerts',
  'Resumen de {crew}': 'Summary of the {crew}',
  'Elige {member}': 'Choose {member}',
  'Medido {ago}': 'Measured {ago}',
  'Sin mediciones': 'No measurements',
  'Estado:': 'Status:',
  'Sistemas · último dato': 'Systems · latest data',
  'No se ha podido cargar la evaluación.': 'Could not load the assessment.',
  'y {n} más': 'and {n} more',
  'En rango (último dato):': 'In range (latest data):',
  'En rango:': 'In range:',
  'Sin datos:': 'No data:',
  'Ver detalle': 'View details',
  '1 alerta': '1 alert',
  '{n} alertas': '{n} alerts',
  'Sin alertas': 'No alerts',

  // pages/Dashboard.tsx
  '{member}: tu panel de salud': '{member}: your health dashboard',
  'hay 1 indicador con mediciones sin sincronizar, evaluados en este dispositivo. Se sustituye por la evaluación del servidor al sincronizar.':
    '1 indicator has unsynced measurements, assessed on this device. It will be replaced by the server assessment when synced.',
  'hay {n} indicadores con mediciones sin sincronizar, evaluados en este dispositivo. Se sustituye por la evaluación del servidor al sincronizar.':
    '{n} indicators have unsynced measurements, assessed on this device. They will be replaced by the server assessment when synced.',
  'Estado provisional: {text}': 'Provisional status: {text}',
  'Estado provisional': 'Provisional status',
  'Estado provisional:': 'Provisional status:',
  'No se pudo actualizar: los datos pueden estar desfasados':
    'Could not update: the data may be out of date',
  Cuerpo: 'Body',
  'Todavía no hay mediciones.': 'No measurements yet.',

  // pages/Members.tsx
  Vista: 'View',
  Conjunto: 'Overview',
  Individual: 'Individual',
  'Estado de {crew}': 'Status of the {crew}',
  'Tu usuario no tiene entorno asignado.': 'Your user has no environment assigned.',
  'No se ha podido cargar la lista.': 'Could not load the list.',
  'No hay nadie dado de alta en este entorno.': 'Nobody is registered in this environment.',
  Todos: 'All',

  // pages/History.tsx
  Historial: 'History',
  'No se han podido cargar las mediciones.': 'Could not load the measurements.',
  Indicador: 'Indicator',
  'Cargando…': 'Loading…',
  'Tendencia de {name}': '{name} trend',
  'previsión {n} días': '{n}-day forecast',
  'Sin datos que mostrar.': 'No data to show.',
  'Mediciones de {name}, últimos {n} días': '{name} measurements, last {n} days',
  ', página {page} de {pages}': ', page {page} of {pages}',
  Origen: 'Source',
  Nota: 'Note',
  'No se pudo actualizar: puede haber mediciones nuevas que no se ven.':
    'Could not update: there may be new measurements not shown.',
  'Páginas del historial': 'History pages',
  'Página anterior': 'Previous page',
  'Página siguiente': 'Next page',
  'Página {page} / {pages} · 1 medición': 'Page {page} / {pages} · 1 measurement',
  'Página {page} / {pages} · {n} mediciones': 'Page {page} / {pages} · {n} measurements',

  // Rango habitual personal (IndicatorCard, TrendChart)
  'Tu rango habitual: {range}': 'Your usual range: {range}',
  'Tu rango habitual': 'Your usual range',
  'Por encima de tu rango habitual': 'Above your usual range',
  'Por debajo de tu rango habitual': 'Below your usual range',

  // SystemTrends: eje Y por indicador
  'Eje Y': 'Y axis',
  Automático: 'Automatic',
  '% del rango': '% of range',
  '{n} con otra unidad, ocultos': '{n} with another unit, hidden',
}
