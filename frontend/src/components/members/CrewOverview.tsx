import { useMemo } from 'react'
import type { MemberSummary } from '../../api/useMembers'
import { useIndicators } from '../../api/useIndicators'
import { useSystems } from '../../api/useSystems'
import type { Vocabulary } from '../../store/environment'
import { STATUS_COLORS } from '../ui/status'
import { StatusBadge, StatusIcon } from '../ui/StatusBadge'
import { countLabel, crewCounts, densityFor, sortByUrgency } from './crewOverview'
import { MemberRow, MemberSummaryCard, type CatalogNames } from './MemberSummaryCard'

const SCROLL = 'overflow-y-auto overscroll-contain [scrollbar-color:var(--env-border)_transparent]'

/**
 * Rejilla de las tarjetas ricas según cuántas hay. Con dos filas (3 en tableta, 4), las filas se
 * reparten el alto; con una sola fila (1–2, o 3 en pantallas anchas), cada tarjeta mide lo que su
 * contenido, para no dejar tarjetas altas y vacías.
 */
function richGrid(count: number): string {
  // Clases literales: Tailwind solo genera las que encuentra escritas enteras en el código.
  if (count === 1) return 'md:auto-rows-[minmax(14rem,auto)]'
  if (count === 2) return 'md:grid-cols-2 md:auto-rows-[minmax(14rem,auto)]'
  if (count === 3)
    return 'md:grid-cols-2 md:auto-rows-[minmax(14rem,1fr)] md:content-stretch xl:grid-cols-3 xl:auto-rows-[minmax(14rem,auto)] xl:content-start'
  return 'md:grid-cols-2 md:auto-rows-[minmax(14rem,1fr)] md:content-stretch'
}

/**
 * Vista de conjunto (FE-35): franja de resumen y una tarjeta por member, lo más urgente primero.
 * La densidad se adapta al número de members: pocas tarjetas ricas que llenan el hueco, más
 * compactas o filas. Si no caben, hace scroll la lista, no la página.
 */
export function CrewOverview({
  members,
  vocabulary,
  onOpen,
}: {
  members: readonly MemberSummary[]
  vocabulary: Vocabulary
  onOpen: (memberId: number) => void
}) {
  const systems = useSystems()
  const indicators = useIndicators()
  const names = useMemo<CatalogNames>(
    () => ({
      systems: new Map((systems.state === 'ready' ? systems.data : []).map((s) => [s.id, s.name])),
      indicators: new Map(
        (indicators.state === 'ready' ? indicators.data : []).map((i) => [i.id, i.name]),
      ),
    }),
    [systems, indicators],
  )
  const sorted = sortByUrgency(members)
  const density = densityFor(members.length)
  const counts = crewCounts(members)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Resumen del conjunto: el estado de cada member cuenta una vez; sin contacto, aparte. */}
      <div
        role="group"
        aria-label="Resumen del conjunto"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <span className="hud-label mr-1">{members.length} en total</span>
        {(['critical', 'warning', 'unknown', 'normal'] as const)
          .filter((s) => counts.byState[s] > 0)
          .map((s) => (
            <StatusBadge key={s} status={s} size="sm" label={countLabel(s, counts.byState[s])} />
          ))}
        {counts.lost > 0 && (
          <StatusBadge status="lost" size="sm" label={countLabel('lost', counts.lost)} />
        )}
        {counts.openAlerts > 0 && (
          <span className="inline-flex items-center gap-1.5 text-env-muted">
            <StatusIcon glyph="alert" color={STATUS_COLORS.warning} size={14} />
            {counts.openAlerts === 1 ? '1 alerta abierta' : `${counts.openAlerts} alertas abiertas`}
          </span>
        )}
      </div>

      {density === 'rows' ? (
        <ul
          aria-label={`Resumen de ${vocabulary.crew}`}
          className={`hud-panel min-h-0 flex-1 divide-y divide-env-border/60 ${SCROLL}`}
        >
          {sorted.map((m) => (
            <li key={m.id}>
              <MemberRow member={m} vocabulary={vocabulary} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ) : (
        <ul
          aria-label={`Resumen de ${vocabulary.crew}`}
          className={`grid min-h-0 flex-1 content-start gap-2.5 md:gap-3 ${SCROLL} ${
            density === 'rich'
              ? richGrid(members.length)
              : 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'
          }`}
        >
          {sorted.map((m) => (
            <li key={m.id} className="min-w-0">
              <MemberSummaryCard
                member={m}
                density={density}
                vocabulary={vocabulary}
                names={names}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
