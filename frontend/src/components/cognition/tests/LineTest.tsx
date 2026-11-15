import type { CognitiveTestProps } from '../types'

/** Pendiente de implementar (FE-39). */
export default function LineTest({ onCancel }: CognitiveTestProps) {
  return (
    <button type="button" onClick={onCancel} className="hud-btn">
      Volver
    </button>
  )
}
