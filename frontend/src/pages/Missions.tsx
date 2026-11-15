import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { serverNow } from '../api/client'
import {
  useCrewMissions,
  useGame,
  useKudos,
  useLeaderboard,
  useTasks,
  type CrewMission,
  type Game,
  type Task,
} from '../api/useGame'
import { useActiveMemberId, useAuth } from '../auth/useAuth'
import { AnimatedNumber } from '../components/game/AnimatedNumber'
import { CrewBoard } from '../components/game/CrewBoard'
import { CrewKudos } from '../components/game/CrewKudos'
import { CrewMissions } from '../components/game/CrewMissions'
import { dayProgress, sortTasks, withLocalCompletions } from '../components/game/game'
import { TaskItem } from '../components/game/TaskItem'
import { useVocab } from '../environments/useVocab'
import { completeTask, joinMission, locallyCompletedTasks, sendKudos } from '../offline/outbox'
import { useEnvironmentStore } from '../store/environment'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'

interface Toast {
  id: number
  text: string
}

/** Fecha del día según el servidor (la demo acelera el reloj). */
const today = () => serverNow().toISOString().slice(0, 10)

/**
 * Misiones diarias (FE-18): tareas del día con casilla animada, puntos que cuentan hacia arriba
 * con un toast "+N puntos", racha, insignias y el tablero cooperativo de la tripulación.
 * Completar una tarea pasa por el outbox (UUID de cliente, idempotente): sin conexión queda
 * marcada en el dispositivo y los puntos se suman de forma provisional hasta sincronizar.
 */
export default function Missions() {
  const vocab = useVocab()
  const memberId = useActiveMemberId()
  const envId = useEnvironmentStore((s) => s.envId)
  const tasks = useTasks(memberId)
  const game = useGame(memberId)
  const board = useLeaderboard(envId)
  // Kudos y misiones de tripulación (FE-24): los da el member (o el admin en su nombre).
  const { role } = useAuth()
  const canAct = role === 'member' || role === 'admin'
  const kudos = useKudos(envId)
  const crewMissions = useCrewMissions(envId)
  const [joining, setJoining] = useState<string | null>(null)

  // Completadas en este dispositivo (también las aún sin enviar) y las que quedaron en cola.
  const [local, setLocal] = useState<Set<string>>(new Set())
  const [queued, setQueued] = useState<Set<string>>(new Set())
  // GameState devuelto al completar, hasta que llegue el siguiente GET /game.
  const [fresh, setFresh] = useState<{ base: Game | undefined; game: Game } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  useEffect(() => {
    if (memberId === null) return
    let cancelled = false
    locallyCompletedTasks(memberId, today())
      .then((ids) => !cancelled && setLocal(ids))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [memberId])

  const toast = useCallback((text: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, text }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500)
  }, [])

  const title = <h1 className="text-2xl font-semibold">Misiones diarias</h1>

  if (memberId === null) {
    return (
      <section>
        {title}
        <NoMemberSelected />
      </section>
    )
  }

  const serverTasks = tasks.state === 'ready' ? tasks.data : []
  const list = sortTasks(withLocalCompletions(serverTasks, local))
  const progress = dayProgress(list)
  const gameData = game.state === 'ready' ? game.data : undefined
  const current = fresh && fresh.base === gameData ? fresh.game : gameData
  // Puntos de lo completado sin conexión que el servidor aún no conoce.
  const pendingPoints = serverTasks
    .filter((t) => queued.has(t.id) && !t.completed)
    .reduce((a, t) => a + t.points, 0)

  const onComplete = async (task: Task) => {
    if (task.completed || local.has(task.id)) return
    setBusy(task.id)
    setLocal((s) => new Set(s).add(task.id)) // optimista: la casilla se marca ya
    try {
      const r = await completeTask(memberId, task, today())
      if (r.status === 'sent') {
        setFresh({ base: gameData, game: r.result })
        toast(`+${task.points} puntos`)
        tasks.refresh()
        board.refresh()
      } else {
        setQueued((s) => new Set(s).add(task.id))
        toast(`+${task.points} puntos · pendiente de sincronizar`)
      }
    } catch (err) {
      setLocal((s) => {
        const n = new Set(s)
        n.delete(task.id)
        return n
      })
      toast(`No se ha podido guardar: ${String(err)}`)
    } finally {
      setBusy(null)
    }
  }

  const onKudos = async (toMemberId: number, message: string) => {
    try {
      const r = await sendKudos(memberId, toMemberId, message)
      toast(r.status === 'sent' ? 'Kudos enviado' : 'Kudos guardado · pendiente de sincronizar')
      kudos.refresh()
      board.refresh()
      return true
    } catch (err) {
      toast(`No se ha podido enviar: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }

  const onJoin = async (mission: CrewMission) => {
    setJoining(mission.id)
    try {
      const r = await joinMission(memberId, mission.id)
      if (r.status === 'sent') {
        toast(
          r.result.completed
            ? `¡Misión completada! +${mission.points} puntos para todos`
            : `Te has apuntado a «${mission.title}»`,
        )
      } else toast('Apuntado · pendiente de sincronizar')
      crewMissions.refresh()
      board.refresh()
    } catch (err) {
      toast(`No se ha podido apuntar: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setJoining(null)
    }
  }

  return (
    // Ocupa el alto disponible (Layout `fill`): las tareas y la columna de la tripulación
    // tienen cada una su scroll.
    <section className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 md:gap-4 lg:max-w-5xl">
      {title}

      <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-env-border bg-env-surface p-2.5 sm:p-4">
          <p className="text-sm text-env-muted">Tus puntos</p>
          {current ? (
            <p className="mt-1 text-2xl font-bold sm:text-3xl">
              <AnimatedNumber value={current.points + pendingPoints} />
              {pendingPoints > 0 && (
                <span className="ml-2 align-middle text-xs font-normal text-env-muted">
                  ⇡ {pendingPoints} sin sincronizar
                </span>
              )}
            </p>
          ) : (
            <div className="mt-2 h-8 animate-pulse rounded bg-env-bg" aria-busy="true" />
          )}
        </div>
        <div className="rounded-xl border border-env-border bg-env-surface p-2.5 sm:p-4">
          <p className="text-sm text-env-muted">Racha</p>
          <p className="mt-1 text-2xl font-bold sm:text-3xl">
            {current ? (
              <>
                <span aria-hidden>🔥 </span>
                {current.streak_days}{' '}
                <span className="text-base font-normal text-env-muted">
                  {current.streak_days === 1 ? 'día' : 'días'}
                </span>
              </>
            ) : (
              '—'
            )}
          </p>
        </div>
        <div className="rounded-xl border border-env-border bg-env-surface p-2.5 sm:p-4">
          <p className="text-sm text-env-muted">Hoy</p>
          <p className="mt-1 text-2xl font-bold sm:text-3xl tabular-nums">
            {progress.done} / {progress.total}
          </p>
          <p className="text-xs text-env-muted">
            {progress.points} de {progress.totalPoints} puntos del día
          </p>
        </div>
      </div>

      {/* Escritorio (≥ lg): tareas a la izquierda y, a la derecha, insignias y tripulación. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-4 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <section className="flex min-h-28 flex-1 flex-col lg:min-h-0">
          <h2 className="mb-2 shrink-0 font-semibold">Tareas de hoy</h2>
          {tasks.state === 'loading' ? (
            <div className="h-32 animate-pulse rounded-xl bg-env-surface" aria-busy="true" />
          ) : tasks.state === 'error' ? (
            <p
              className="rounded-lg border border-env-border bg-env-surface p-3 text-sm"
              role="alert"
            >
              <span aria-hidden>⚠ </span>No se pudieron cargar las tareas.{' '}
              <button type="button" onClick={tasks.retry} className="underline">
                Reintentar
              </button>
            </p>
          ) : list.length === 0 ? (
            <p className="text-env-muted">No hay tareas para hoy.</p>
          ) : (
            <ul
              className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-color:var(--env-border)_transparent]"
              tabIndex={0}
              aria-label="Tareas de hoy"
            >
              {list.map((t) => (
                <li key={t.id}>
                  <TaskItem
                    task={t}
                    pending={queued.has(t.id) && !serverTasks.find((s) => s.id === t.id)?.completed}
                    busy={busy !== null}
                    onComplete={(task) => void onComplete(task)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-color:var(--env-border)_transparent] md:gap-4">
          {current && current.badges.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Insignias</h2>
              <ul className="flex flex-wrap gap-2">
                {current.badges.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-full border border-env-border bg-env-surface px-3 py-1 text-sm"
                    title={`Conseguida el ${new Date(b.earned_at).toLocaleDateString('es-ES')}`}
                  >
                    <span aria-hidden>🏅 </span>
                    {b.name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {board.state === 'ready' && (
            <CrewBoard board={board.data} crewWord={vocab.crew} memberId={memberId} />
          )}

          {crewMissions.state === 'ready' && crewMissions.data.length > 0 && (
            <CrewMissions
              missions={crewMissions.data}
              memberId={memberId}
              canJoin={canAct}
              busyId={joining}
              onJoin={(m) => void onJoin(m)}
            />
          )}

          {kudos.state === 'ready' && board.state === 'ready' && (
            <CrewKudos
              kudos={kudos.data}
              members={board.data.members}
              memberId={memberId}
              canSend={canAct}
              onSend={onKudos}
            />
          )}
        </div>
      </div>

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.p
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              className="rounded-full bg-env-primary px-4 py-2 font-semibold text-env-primary-text shadow-lg"
            >
              {t.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}
