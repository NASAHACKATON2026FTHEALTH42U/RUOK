import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { Task } from '../../api/useGame'
import { formatDue, taskLink } from './game'

interface TaskItemProps {
  task: Task
  /** Completada en este dispositivo, aún sin sincronizar. */
  pending: boolean
  onComplete: (task: Task) => void
  busy: boolean
}

/**
 * Una tarea del día (FE-18): casilla animada, puntos, momento del día y, si la tarea tiene
 * pantalla propia (medir, check-in, PVT), un enlace para hacerla. Completar es definitivo:
 * los datos solo se añaden (docs/offline-and-liveness.md).
 */
export function TaskItem({ task, pending, onComplete, busy }: TaskItemProps) {
  const reduce = useReducedMotion()
  const link = taskLink(task)
  const done = task.completed

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-env-border p-3 ${
        done ? 'bg-env-bg' : 'bg-env-surface'
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `${task.title}: hecha` : `Marcar como hecha: ${task.title}`}
        disabled={done || busy}
        onClick={() => onComplete(task)}
        className={`relative before:absolute before:-inset-1.5 before:content-[''] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-env-primary ${
          done ? 'border-env-primary bg-env-primary text-env-primary-text' : 'border-env-border'
        }`}
      >
        {done && (
          <motion.svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            aria-hidden
            initial={reduce ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </motion.svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`font-medium ${done ? 'text-env-muted line-through' : ''}`}>{task.title}</p>
        <p className="text-xs text-env-muted">
          {formatDue(task.due)} · {task.points} puntos
          {pending && (
            <span title="Se enviará al volver la conexión">
              {' '}
              · <span aria-hidden>⇡</span> pendiente de sincronizar
            </span>
          )}
        </p>
      </div>

      {link && !done && (
        <Link
          to={link}
          className="shrink-0 rounded-md border border-env-border px-3 py-1.5 text-sm hover:border-env-text"
        >
          Hacer
        </Link>
      )}
    </div>
  )
}
