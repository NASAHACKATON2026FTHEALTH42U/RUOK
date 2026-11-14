import { useEffect, useMemo, useState } from 'react'
import type { Assessment } from '../api/useAssessment'
import type { Environment } from '../api/useEnvironments'
import type { Indicator } from '../api/useIndicators'
import { getDb } from './db'
import { useOutboxStore } from './outbox'
import { applyProvisional, type LocalMeasurement, type ProvisionalResult } from './provisional'

/** Mediciones del member guardadas en el dispositivo que aún no han llegado al servidor. */
async function loadUnsynced(memberId: number): Promise<LocalMeasurement[]> {
  const all = await (await getDb()).getAll('measurements')
  return all.filter((m) => m.member_id === memberId && !m.synced)
}

/**
 * Evaluación con el semáforo provisional aplicado (FE-12): si hay mediciones sin sincronizar
 * más recientes que la evaluación del servidor, sus indicadores se recalculan en el dispositivo
 * con los rangos cacheados y se marcan como provisionales. Se vuelve a calcular cada vez que
 * cambia el outbox; al sincronizar, las mediciones quedan `synced` y manda el servidor.
 */
export function useProvisionalAssessment(
  memberId: number | null,
  assessment: Assessment | null,
  indicators: readonly Indicator[],
  env: Pick<Environment, 'threshold_overrides'> | undefined,
): ProvisionalResult | null {
  const pending = useOutboxStore((s) => s.pending)
  const [local, setLocal] = useState<LocalMeasurement[]>([])

  useEffect(() => {
    if (memberId === null) return
    let cancelled = false
    loadUnsynced(memberId)
      .then((ms) => !cancelled && setLocal(ms))
      .catch(() => !cancelled && setLocal([])) // sin IndexedDB: solo la evaluación del servidor
    return () => {
      cancelled = true
    }
  }, [memberId, pending, assessment])

  return useMemo(
    () => (assessment ? applyProvisional(assessment, local, indicators, env) : null),
    [assessment, local, indicators, env],
  )
}
