import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { CognitiveTestId, CognitiveTestProps } from './types'

export interface CognitiveTestDef {
  id: CognitiveTestId
  /** Textos en español (se traducen al mostrarlos con t()). */
  title: string
  what: string
  why: string
  minutes: number
  Component: LazyExoticComponent<ComponentType<CognitiveTestProps>>
}

/**
 * Los 5 tests (FE-39), elegidos de la batería «Cognition» de la NASA por su relevancia en
 * misión. El PVT (vigilancia) ya tiene su propia sección.
 */
export const COGNITIVE_TESTS: CognitiveTestDef[] = [
  {
    id: 'emotion',
    title: 'Reconocimiento de emociones',
    what: 'Identifica la emoción de cada cara.',
    why: 'El aislamiento y la fatiga social cambian cómo leemos a los demás.',
    minutes: 2,
    Component: lazy(() => import('./tests/EmotionTest')),
  },
  {
    id: 'line',
    title: 'Orientación de líneas',
    what: 'Encuentra la línea con la misma inclinación.',
    why: 'Percepción espacial: clave al pilotar, acoplar o manejar el brazo robótico.',
    minutes: 2,
    Component: lazy(() => import('./tests/LineTest')),
  },
  {
    id: 'matrix',
    title: 'Razonamiento matricial',
    what: 'Completa la pieza que falta en cada patrón.',
    why: 'Resolución de problemas nuevos cuando no hay ayuda desde la Tierra.',
    minutes: 3,
    Component: lazy(() => import('./tests/MatrixTest')),
  },
  {
    id: 'bart',
    title: 'Toma de riesgos (globo)',
    what: 'Infla el globo para ganar puntos, pero cóbralos antes de que explote.',
    why: 'Impulsividad y tolerancia al riesgo, que cambian con el estrés y el sueño.',
    minutes: 3,
    Component: lazy(() => import('./tests/BartTest')),
  },
  {
    id: 'digits',
    title: 'Dígitos al revés',
    what: 'Memoriza una serie de números y escríbela en orden inverso.',
    why: 'Memoria de trabajo, la que sostiene un procedimiento de emergencia o una EVA.',
    minutes: 2,
    Component: lazy(() => import('./tests/DigitsTest')),
  },
]
