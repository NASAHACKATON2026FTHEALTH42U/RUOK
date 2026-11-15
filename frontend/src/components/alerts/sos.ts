/** Lógica pura del SOS y de los avisos a control (FE-13, docs/alerts-and-escalation.md). */
import type { Schema } from '../../api/client'

export type AlertCategory = Extract<
  Schema<'AlertCategory'>,
  'symptom' | 'physical' | 'psychological' | 'emergency'
>
export type AlertSeverity = Schema<'AlertSeverity'>

/** Categorías que puede elegir el member (no_contact e indicator las crea el sistema). */
export const CATEGORIES: { id: AlertCategory; label: string; hint: string }[] = [
  { id: 'symptom', label: 'Tengo un síntoma', hint: 'Dolor, mareo, fiebre…' },
  { id: 'physical', label: 'Malestar físico', hint: 'No me encuentro bien' },
  { id: 'psychological', label: 'Necesito hablar', hint: 'Canal confidencial' },
  { id: 'emergency', label: 'Emergencia', hint: 'Necesito ayuda ya' },
]

export const SEVERITIES: { id: AlertSeverity; label: string }[] = [
  { id: 'warning', label: 'Puede esperar' },
  { id: 'critical', label: 'Urgente' },
  { id: 'emergency', label: 'Emergencia' },
]

/** Severidad propuesta al elegir categoría: una emergencia es siempre "emergency". */
export function defaultSeverity(category: AlertCategory): AlertSeverity {
  return category === 'emergency' ? 'emergency' : 'warning'
}

/** Destinos elegibles: la escalera del entorno sin `self` (se pueden saltar niveles). */
export function targets(ladder: string[]): string[] {
  return ladder.filter((r) => r !== 'self')
}

/** Destino por defecto: el siguiente nivel tras `self`. */
export function defaultTarget(ladder: string[]): string | null {
  return targets(ladder)[0] ?? null
}

/** Rol de la escalera → clave del vocabulario del entorno que lo nombra. */
const ROLE_VOCAB: Record<string, string> = {
  crew: 'crew',
  ground: 'ground',
  nurse: 'medic',
  caregiver: 'medic',
  doctor: 'ground',
}
const ROLE_FALLBACK: Record<string, string> = {
  self: 'autocuidado',
  crew: 'equipo',
  ground: 'control externo',
  nurse: 'enfermería',
  caregiver: 'cuidador',
  doctor: 'médico',
  family: 'familia',
}

/** Nombre visible de un rol de la escalera, con el vocabulario del entorno. */
export function roleLabel(role: string, vocabulary: Record<string, string>): string {
  const key = ROLE_VOCAB[role]
  return (key && vocabulary[key]) || ROLE_FALLBACK[role] || role
}

/** Sistemas cuyas intervenciones offline se proponen al no poder enviar, según la categoría. */
export function interventionSystemsFor(category: AlertCategory): string[] {
  return category === 'psychological' ? ['neuro_behavioral'] : []
}

/**
 * ¿Mostrar el mensaje de escalado de este sistema en el protocolo offline? "Necesito hablar"
 * solo muestra lo neuro-conductual; el resto de categorías, cualquier sistema alterado.
 */
export function protocolAppliesTo(category: AlertCategory, systemId: string): boolean {
  return category === 'psychological' ? systemId === 'neuro_behavioral' : true
}
