import { api, unwrap, type Schema } from './client'
import { useLoad } from './useLoad'

const getUsers = () => unwrap(api.GET('/api/v1/users'))

export type UserAccount = Schema<'User'>

/** Todas las cuentas (`GET /users`, solo admin), activas o no. */
export function useUsers() {
  return useLoad(getUsers, [])
}

// Acciones de administración: van directas (no se encolan). Sin servidor lanzan NetworkError.

export function createUser(body: Schema<'UserCreate'>) {
  return unwrap(api.POST('/api/v1/users', { body }))
}

export function setUserActive(id: number, active: boolean) {
  return unwrap(
    api.PATCH('/api/v1/users/{user_id}', { params: { path: { user_id: id } }, body: { active } }),
  )
}

export function resetUserPin(id: number, pin: string) {
  return unwrap(
    api.PUT('/api/v1/users/{user_id}/pin', { params: { path: { user_id: id } }, body: { pin } }),
  )
}
