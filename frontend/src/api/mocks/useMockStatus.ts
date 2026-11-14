import { useSyncExternalStore } from 'react'
import { isFallbackActive, isMockMode, subscribeMockStatus } from './mode'

export type MockStatus = 'real' | 'mock' | 'fallback'

function snapshot(): MockStatus {
  if (isMockMode()) return 'mock'
  return isFallbackActive() ? 'fallback' : 'real'
}

/** 'mock' (modo demo), 'fallback' (servidor caído, lecturas de ejemplo) o 'real'. */
export function useMockStatus(): MockStatus {
  return useSyncExternalStore(subscribeMockStatus, snapshot, snapshot)
}
