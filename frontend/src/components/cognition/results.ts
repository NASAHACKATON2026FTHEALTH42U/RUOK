import type { CognitiveResult, CognitiveTestId } from './types'

/** Un resultado guardado. */
export interface StoredResult extends CognitiveResult {
  test: CognitiveTestId
  at: string
}

const KEY = (memberId: number) => `ruok.cognition.${memberId}`
const MAX = 60

/**
 * Resultados de los tests cognitivos, en este dispositivo (FE-39). Son orientativos y no salen
 * del dispositivo: sirven para que cada persona vea su evolución.
 */
export function loadResults(memberId: number): StoredResult[] {
  try {
    const raw = localStorage.getItem(KEY(memberId))
    const list = raw ? (JSON.parse(raw) as StoredResult[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveResult(memberId: number, test: CognitiveTestId, result: CognitiveResult) {
  const list = [{ ...result, test, at: new Date().toISOString() }, ...loadResults(memberId)]
  try {
    localStorage.setItem(KEY(memberId), JSON.stringify(list.slice(0, MAX)))
  } catch {
    // sin almacenamiento: el resultado se ve, pero no se guarda
  }
}

/** Resultados de un test, del más reciente al más antiguo. */
export function resultsOf(list: StoredResult[], test: CognitiveTestId): StoredResult[] {
  return list.filter((r) => r.test === test)
}
