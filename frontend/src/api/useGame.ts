import { useLiveRefresh } from '../realtime/events'
import { api, unwrap } from './client'
import { useLoad } from './useLoad'

const getTasks = (memberId: number) =>
  unwrap(
    api.GET('/api/v1/members/{member_id}/tasks', { params: { path: { member_id: memberId } } }),
  )
const getGame = (memberId: number) =>
  unwrap(api.GET('/api/v1/members/{member_id}/game', { params: { path: { member_id: memberId } } }))
const getLeaderboard = (envId: string) =>
  unwrap(
    api.GET('/api/v1/environments/{env_id}/leaderboard', { params: { path: { env_id: envId } } }),
  )

const getKudos = (envId: string) =>
  unwrap(
    api.GET('/api/v1/environments/{env_id}/kudos', {
      params: { path: { env_id: envId }, query: { limit: 10 } },
    }),
  )
const getCrewMissions = (envId: string) =>
  unwrap(api.GET('/api/v1/environments/{env_id}/missions', { params: { path: { env_id: envId } } }))

export type Task = Awaited<ReturnType<typeof getTasks>>[number]
export type Game = Awaited<ReturnType<typeof getGame>>
export type Leaderboard = Awaited<ReturnType<typeof getLeaderboard>>
export type Kudos = Awaited<ReturnType<typeof getKudos>>[number]
export type CrewMission = Awaited<ReturnType<typeof getCrewMissions>>[number]

/** Tareas del día del member (`GET /members/{id}/tasks`), con refresco al completar (FE-29). */
export function useTasks(memberId: number | null) {
  const r = useLoad(() => getTasks(memberId!), [memberId], { enabled: memberId !== null })
  useLiveRefresh({ types: ['task.completed', 'measurement.created'], memberId }, r.refresh)
  return r
}

/** Puntos, racha e insignias del member (`GET /members/{id}/game`). */
export function useGame(memberId: number | null) {
  const r = useLoad(() => getGame(memberId!), [memberId], { enabled: memberId !== null })
  useLiveRefresh({ types: ['task.completed'], memberId }, r.refresh)
  return r
}

/** Tablero cooperativo de la tripulación (`GET /environments/{env}/leaderboard`). */
export function useLeaderboard(envId: string | null) {
  const r = useLoad(() => getLeaderboard(envId!), [envId], { enabled: envId !== null })
  useLiveRefresh({ types: ['task.completed'], envId }, r.refresh)
  return r
}

/** Cada cuánto se vuelven a pedir kudos y misiones (los de los compañeros no emiten evento). */
const CREW_REFRESH_MS = 10_000

/** Kudos recientes del entorno, el más nuevo primero (`GET /environments/{env}/kudos`, BE-23). */
export function useKudos(envId: string | null) {
  return useLoad(() => getKudos(envId!), [envId], {
    enabled: envId !== null,
    refreshMs: CREW_REFRESH_MS,
  })
}

/** Misiones de tripulación de hoy (`GET /environments/{env}/missions`, BE-23). */
export function useCrewMissions(envId: string | null) {
  return useLoad(() => getCrewMissions(envId!), [envId], {
    enabled: envId !== null,
    refreshMs: CREW_REFRESH_MS,
  })
}
