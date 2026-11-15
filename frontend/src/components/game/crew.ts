/**
 * Lógica pura de los kudos y las misiones de tripulación (FE-24, BE-23). Los puntos, el límite
 * diario y el mínimo de participantes son del servidor (`crew_game.json`): aquí solo se
 * presentan.
 */

import { translate } from '../../i18n/t'

export interface KudosLike {
  id: string
  from_member_id: number
  to_member_id: number
  message: string
  created_at: string
}

export interface CrewMissionLike {
  id: string
  title: string
  points: number
  min_participants: number
  participants: number[]
  completed: boolean
}

/** Longitud máxima de un kudos (la misma que valida el servidor). */
export const KUDOS_MAX = 200

/** Mensaje listo para enviar, o null si está vacío. */
export function cleanKudos(raw: string): string | null {
  const text = raw.trim()
  return text.length > 0 ? text.slice(0, KUDOS_MAX) : null
}

/** Nombre para mostrar: «tú» si es el member activo; si no se conoce, «alguien». */
export function memberName(
  id: number,
  names: ReadonlyMap<number, string>,
  meId: number | null,
): string {
  if (id === meId) return translate('tú')
  return names.get(id) ?? translate('alguien')
}

/** Estado de una misión para el member activo: si está apuntado, cuántos faltan y el texto. */
export function missionStatus(mission: CrewMissionLike, meId: number | null) {
  const joined = meId !== null && mission.participants.includes(meId)
  const missing = Math.max(0, mission.min_participants - mission.participants.length)
  const vars = {
    joined: mission.participants.length,
    min: mission.min_participants,
    missing,
    points: mission.points,
  }
  const label = mission.completed
    ? translate('Completada · +{points} puntos para todos', vars)
    : missing === 1
      ? translate('{joined}/{min} apuntados · falta 1', vars)
      : translate('{joined}/{min} apuntados · faltan {missing}', vars)
  return { joined, missing, label }
}
