import type { Forecast } from '../../api/useForecast'
import type { LoadResult } from '../../api/useLoad'
import { useT } from '../../i18n/t'
import { forecastNote, forecastSummary } from './trend'

/** Marca de un cambio a peor: el color del estado al que pasaría, como los valores de la tabla. */
const ACCENT: Record<string, string> = { warning: 'text-st-warn', critical: 'text-st-crit' }

/**
 * Previsión de un indicador en texto (FS-09): qué se espera en los próximos días y, en letra
 * pequeña, que es una estimación y no un diagnóstico (api-contract.md, regla 4).
 * - Un cambio a peor lleva la marca cuadrada del estado al que pasaría; el texto, siempre en el
 *   color del tema (el estado va escrito, no depende del color).
 * - Sin previsión (`insufficient_data`, `stale`) solo se explica por qué: sin datos = desconocido.
 * - Si quien consulta no puede verla (indicador conductual privado), no se enseña nada.
 * El bloque reserva su alto: no hay saltos al cargar ni al cambiar de indicador.
 */
export function ForecastBlock({ forecast }: { forecast: LoadResult<Forecast | null> }) {
  const t = useT()
  if (forecast.state === 'ready' && forecast.data === null) return null
  const data = forecast.state === 'ready' ? forecast.data : null
  const summary = data && forecastSummary(data)
  const accent = summary?.tone === 'worse' ? ACCENT[data?.change?.status ?? ''] : undefined

  return (
    <section
      aria-label={t('Previsión')}
      className="flex min-h-[4.5rem] flex-col gap-0.5 border-l-2 border-env-border pl-3 lg:min-h-14"
    >
      <h2 className="hud-label leading-4">
        {t('Previsión')}
        {data?.status === 'ok' &&
          ` · ${data.horizon_days === 1 ? t('1 día') : t('{n} días', { n: data.horizon_days })}`}
      </h2>
      {forecast.state === 'loading' && (
        <div className="mt-1 h-3.5 w-3/5 animate-pulse bg-env-border/60" aria-busy="true" />
      )}
      {forecast.state === 'error' && (
        <p className="text-sm text-env-muted">
          {t('No se ha podido cargar la previsión.')}{' '}
          <button type="button" onClick={forecast.retry} className="underline">
            {t('Reintentar')}
          </button>
        </p>
      )}
      {data && summary && (
        <>
          <p className={`text-sm ${summary.tone === 'none' ? 'text-env-muted' : ''}`}>
            {accent && (
              <span
                className={`mr-1.5 inline-block size-[5px] bg-current align-middle ${accent}`}
                aria-hidden="true"
              />
            )}
            {summary.text}
          </p>
          {data.status === 'ok' && (
            <p className="text-[0.8125rem] text-env-muted">{forecastNote(data)}</p>
          )}
        </>
      )}
    </section>
  )
}
