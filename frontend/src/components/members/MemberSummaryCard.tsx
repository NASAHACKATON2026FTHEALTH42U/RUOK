import { serverNow } from '../../api/client'
import { useAssessment } from '../../api/useAssessment'
import type { MemberSummary } from '../../api/useMembers'
import { capitalize } from '../../environments/useVocab'
import { formatAgo } from '../../lib/time'
import type { Vocabulary } from '../../store/environment'
import { initials } from '../auth/demoUsers'
import { formatValue } from '../dashboard/format'
import { livenessState, STATUS_COLORS, statusStyle } from '../ui/status'
import { StatusBadge, StatusIcon } from '../ui/StatusBadge'
import {
  memberDisplayState,
  systemsDigest,
  type CrewDensity,
  type FlaggedSystem,
} from './crewOverview'

/** Nombres de los catálogos (sistemas e indicadores) para el texto de las tarjetas. */
export interface CatalogNames {
  systems: Map<string, string>
  indicators: Map<string, string>
}

interface CardProps {
  member: MemberSummary
  /** `rich`: tarjeta grande en tableta y escritorio (compacta en móvil). `compact`: siempre compacta. */
  density: Exclude<CrewDensity, 'rows'>
  vocabulary: Vocabulary
  names: CatalogNames
  onOpen: (memberId: number) => void
}

/** Cómo se enfoca una tarjeta dentro del panel (el clip-path del HUD recorta lo que sale fuera). */
const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-env-primary'

/** Cuántos sistemas fuera de rango se detallan en la tarjeta rica; el resto, «y N más». */
const MAX_FLAGGED = 3

/**
 * Resumen de un member en la vista de conjunto (FE-35): estado, liveness, última medición,
 * alertas abiertas y los sistemas que hay que mirar. Clic → su detalle (vista individual).
 */
export function MemberSummaryCard({ member: m, density, vocabulary, names, onOpen }: CardProps) {
  const assessment = useAssessment(m.id)
  const now = serverNow()
  const state = memberDisplayState(m)
  const live = livenessState(m.liveness)
  const position = vocabulary[m.position]
  const digest = assessment.state === 'ready' ? systemsDigest(assessment.data.systems) : null
  const measured = m.last_measurement_at
    ? `Medido ${formatAgo(m.last_measurement_at, now)}`
    : 'Sin mediciones'
  const seen = m.last_seen_at ? formatAgo(m.last_seen_at, now) : null
  const sys = (id: string) => names.systems.get(id) ?? id
  const list = (ids: string[]) => ids.map(sys).join(', ')

  const avatar = (size: string) => (
    <span
      aria-hidden
      className={`flex ${size} shrink-0 items-center justify-center rounded-full border border-env-primary/60 bg-env-primary/10 font-mono font-medium tracking-wider text-env-primary`}
    >
      {initials(m.name)}
    </span>
  )

  const alerts = m.open_alerts > 0 && (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-env-text">
      <StatusIcon glyph="alert" color={STATUS_COLORS.warning} size={14} />
      {m.open_alerts === 1 ? '1 alerta abierta' : `${m.open_alerts} alertas abiertas`}
    </span>
  )

  const flagIcon = (f: FlaggedSystem) => (
    <StatusIcon glyph={statusStyle(f.status).glyph} color={statusStyle(f.status).color} size={14} />
  )

  // Compacta: nombre y estado; debajo, liveness, lo peor de los sistemas, alertas y medición.
  const compact = (
    <span className="flex min-w-0 flex-col gap-1.5 px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2.5">
        {avatar('size-8 text-xs')}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-medium">{m.name}</span>
          {position && (
            <span className="block truncate text-xs text-env-muted">{capitalize(position)}</span>
          )}
        </span>
        <StatusBadge status={state} size="sm" className="shrink-0" />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-env-muted">
        {live && <StatusBadge status={live} size="xs" />}
        {digest && digest.flagged.length > 0 && (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-env-text">
            {flagIcon(digest.flagged[0])}
            <span className="truncate">{sys(digest.flagged[0].systemId)}</span>
            <span className="sr-only">: {statusStyle(digest.flagged[0].status).label}</span>
            {digest.flagged.length > 1 && (
              <span className="text-env-muted">+{digest.flagged.length - 1}</span>
            )}
          </span>
        )}
        {alerts}
        <span className="whitespace-nowrap">{measured}</span>
      </span>
    </span>
  )

  // Rica (pocos members, tableta y escritorio): los sistemas fuera de rango con el indicador que
  // lo explica, y en una línea los que están en rango y los que no tienen datos.
  const rich = (
    <span className="flex min-h-0 flex-1 flex-col">
      <span className="flex items-center gap-3 border-b border-env-border/60 px-4 py-3">
        {avatar('size-11 text-sm')}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-lg font-medium">{m.name}</span>
          {position && (
            <span className="block truncate text-sm text-env-muted">{capitalize(position)}</span>
          )}
        </span>
        <span className="status-word shrink-0 text-right uppercase md:text-lg" data-state={state}>
          <span className="sr-only">Estado: </span>
          {statusStyle(state).label}
        </span>
      </span>
      <span className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {live && (
            <StatusBadge
              status={live}
              size="sm"
              label={`${statusStyle(live).label}${seen ? ` · ${seen}` : ''}`}
            />
          )}
          <span className="text-env-muted">{measured}</span>
          {alerts}
        </span>

        <span className="flex min-h-0 flex-col gap-2">
          {/* Sin datos frescos, lo que se ve es el último dato: se dice. */}
          <span className="hud-label">{live ? 'Sistemas · último dato' : 'Sistemas'}</span>
          {assessment.state === 'loading' && (
            <span className="h-8 w-2/3 animate-pulse bg-env-border/40" aria-hidden />
          )}
          {assessment.state === 'error' && (
            <span className="text-sm text-env-muted">No se ha podido cargar la evaluación.</span>
          )}
          {digest && digest.flagged.length > 0 && (
            <span className="flex flex-col divide-y divide-env-border/50 border-y border-env-border/50">
              {digest.flagged.slice(0, MAX_FLAGGED).map((f) => (
                <span key={f.systemId} className="flex min-w-0 items-center gap-2 py-1.5 text-sm">
                  {flagIcon(f)}
                  <span className="shrink-0 font-medium">{sys(f.systemId)}</span>
                  <span className="sr-only">: {statusStyle(f.status).label}</span>
                  {f.indicator && (
                    <span className="min-w-0 truncate text-env-muted">
                      {names.indicators.get(f.indicator.id) ?? f.indicator.id}{' '}
                      <span className="text-env-text tabular-nums">
                        {formatValue(f.indicator.value, f.indicator.unit)}
                      </span>
                      {f.more > 0 && ` · +${f.more}`}
                    </span>
                  )}
                </span>
              ))}
              {digest.flagged.length > MAX_FLAGGED && (
                <span className="py-1.5 text-sm text-env-muted">
                  y {digest.flagged.length - MAX_FLAGGED} más
                </span>
              )}
            </span>
          )}
          {digest && digest.inRange.length > 0 && (
            // En rango según el último dato: sin datos frescos no lleva la marca de "normal".
            <span className="flex min-w-0 items-start gap-2 text-sm text-env-muted">
              <StatusIcon
                glyph={live ? 'question' : 'check'}
                color={live ? STATUS_COLORS.unknown : STATUS_COLORS.normal}
                size={14}
              />
              <span className="line-clamp-2 min-w-0">
                <span className="text-env-text">
                  {live ? 'En rango (último dato)' : 'En rango'}:
                </span>{' '}
                {list(digest.inRange)}
              </span>
            </span>
          )}
          {digest && digest.noData.length > 0 && (
            <span className="flex min-w-0 items-start gap-2 text-sm text-env-muted">
              <StatusIcon glyph="question" color={STATUS_COLORS.unknown} size={14} />
              <span className="line-clamp-2 min-w-0">
                <span className="text-env-text">Sin datos:</span> {list(digest.noData)}
              </span>
            </span>
          )}
        </span>
      </span>
      <span
        aria-hidden
        className="mt-auto border-t border-env-border/60 px-4 py-2 text-right font-mono text-[0.75rem] tracking-[0.14em] text-env-muted uppercase group-hover:text-env-primary"
      >
        Ver detalle →
      </span>
    </span>
  )

  return (
    <button
      type="button"
      onClick={() => onOpen(m.id)}
      className={`hud-panel group flex h-full w-full min-w-0 flex-col text-left hover:border-env-primary ${FOCUS}`}
    >
      {density === 'rich' ? (
        <>
          <span className="contents md:hidden">{compact}</span>
          <span className="hidden min-h-0 flex-1 flex-col md:flex">{rich}</span>
        </>
      ) : (
        compact
      )}
    </button>
  )
}

/** Fila de un member cuando hay muchos (sin pedir su evaluación): estado, alertas y medición. */
export function MemberRow({
  member: m,
  vocabulary,
  onOpen,
}: {
  member: MemberSummary
  vocabulary: Vocabulary
  onOpen: (memberId: number) => void
}) {
  const now = serverNow()
  const state = memberDisplayState(m)
  const live = livenessState(m.liveness)
  const position = vocabulary[m.position]
  return (
    <button
      type="button"
      onClick={() => onOpen(m.id)}
      className={`flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2 text-left hover:bg-env-primary/5 ${FOCUS}`}
    >
      <span className="min-w-0 flex-1 basis-40">
        <span className="block truncate font-medium">{m.name}</span>
        {position && (
          <span className="block truncate text-xs text-env-muted">{capitalize(position)}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <StatusBadge status={state} size="sm" />
        {live && <StatusBadge status={live} size="sm" />}
      </span>
      <span className="w-28 shrink-0 text-xs text-env-muted">
        {m.open_alerts > 0
          ? `${m.open_alerts} ${m.open_alerts === 1 ? 'alerta' : 'alertas'}`
          : 'Sin alertas'}
      </span>
      <span className="w-36 shrink-0 text-xs text-env-muted">
        {m.last_measurement_at
          ? `Medido ${formatAgo(m.last_measurement_at, now)}`
          : 'Sin mediciones'}
      </span>
    </button>
  )
}
