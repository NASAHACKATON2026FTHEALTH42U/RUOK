/**
 * Lógica pura de la rutina y la gamificación (FE-18). Los puntos de cada tarea y las reglas
 * de racha e insignias son del servidor (perfil del entorno, BE-18/BE-19): aquí solo se
 * presentan y se suma de forma optimista lo completado sin conexión.
 */

export interface TaskLike {
  id: string
  task_type: string
  points: number
  due: string
  completed: boolean
  indicator_id?: string | null
}

/** Marca como completadas las que se completaron en el dispositivo (aunque no se hayan enviado). */
export function withLocalCompletions<T extends TaskLike>(
  tasks: readonly T[],
  local: ReadonlySet<string>,
): T[] {
  return tasks.map((t) => (local.has(t.id) && !t.completed ? { ...t, completed: true } : t))
}

/** Progreso del día: tareas y puntos hechos sobre el total. */
export function dayProgress(tasks: readonly TaskLike[]) {
  const done = tasks.filter((t) => t.completed)
  return {
    done: done.length,
    total: tasks.length,
    points: done.reduce((a, t) => a + t.points, 0),
    totalPoints: tasks.reduce((a, t) => a + t.points, 0),
  }
}

const DUE_ORDER: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, any: 3 }
const DUE_LABEL: Record<string, string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche',
  any: 'Cuando quieras',
}

/** Etiqueta del momento del día. Un valor desconocido se muestra tal cual. */
export function formatDue(due: string): string {
  return DUE_LABEL[due] ?? due
}

/** Pendientes primero; dentro de cada grupo, por momento del día. */
export function sortTasks<T extends TaskLike>(tasks: readonly T[]): T[] {
  return [...tasks].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      (DUE_ORDER[a.due] ?? 9) - (DUE_ORDER[b.due] ?? 9),
  )
}

/** Dónde se hace la tarea en la app (si tiene pantalla propia). */
export function taskLink(t: TaskLike): string | null {
  if (t.task_type === 'checkin') return '/checkin'
  if (t.task_type === 'pvt') return '/pvt'
  if (t.indicator_id) return `/measure?indicator=${encodeURIComponent(t.indicator_id)}`
  return null
}
