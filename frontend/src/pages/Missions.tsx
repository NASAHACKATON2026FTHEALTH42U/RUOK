import { useCallback, useEffect, useState } from 'react'
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
import { pushToast } from '../store/toasts'
import { CrewMissions } from '../components/game/CrewMissions'
import { dayProgress, sortTasks, withLocalCompletions } from '../components/game/game'
import { TaskItem } from '../components/game/TaskItem'
import { useVocab } from '../environments/useVocab'
import { completeTask, joinMission, locallyCompletedTasks, sendKudos } from '../offline/outbox'
import { useEnvironmentStore } from '../store/environment'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'
import { Icon } from '../components/ui/Icon'

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

  // Los avisos comunes de la app (abajo a la derecha), no unos propios.
  const toast = useCallback((text: string) => {
    pushToast({ tone: 'success', icon: 'check', label: 'Misiones', title: text })
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

  // Un solo elemento, colocado en una columna u otra según el ancho (en la que no toca, oculto).
  const kudosPanel = kudos.state === 'ready' && board.state === 'ready' && (
    <CrewKudos
      kudos={kudos.data}
      members={board.data.members}
      memberId={memberId}
      canSend={canAct}
      onSend={onKudos}
    />
  )

  return (
    // Estética de los paneles HUD: franja de indicadores y paneles con título. En escritorio
    // ocupa todo el hueco (Layout `fill`) y cada columna tiene su scroll: tareas, kudos e
    // insignias | tripulación y misiones de grupo; desde 1536 px, kudos aparte. En móvil,
    // los paneles uno debajo de otro y la página hace scroll.
    <section className="flex min-h-0 w-full flex-1 flex-col gap-3 md:gap-4">
      {title}

      {/* Tu día en tres cifras, como las celdas del panel. */}
      <section aria-label="Tu progreso" className="hud-panel shrink-0">
        <ul className="-mr-px -mb-px grid grid-cols-3">
          <li className="border-r border-b border-env-border/60 px-3 py-2.5 sm:px-5 sm:py-4">
            <p className="text-sm text-env-muted">Tus puntos</p>
            {current ? (
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl">
                <AnimatedNumber value={current.points + pendingPoints} />
                {pendingPoints > 0 && (
                  <span className="ml-2 align-middle font-sans text-xs font-normal text-env-muted">
                    ⇡ {pendingPoints} sin sincronizar
                  </span>
                )}
              </p>
            ) : (
              <div className="mt-2 h-8 animate-pulse rounded bg-env-bg" aria-busy="true" />
            )}
          </li>
          <li className="border-r border-b border-env-border/60 px-3 py-2.5 sm:px-5 sm:py-4">
            <p className="text-sm text-env-muted">Racha</p>
            <p className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
              {current ? (
                <>
                  <Icon name="flame" size={22} className="mr-1.5 text-env-primary" />
                  {current.streak_days}{' '}
                  <span className="font-sans text-base font-normal text-env-muted">
                    {current.streak_days === 1 ? 'día' : 'días'}
                  </span>
                </>
              ) : (
                '—'
              )}
            </p>
          </li>
          <li className="border-r border-b border-env-border/60 px-3 py-2.5 sm:px-5 sm:py-4">
            <p className="text-sm text-env-muted">Hoy</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums sm:text-3xl">
              {progress.done} / {progress.total}
            </p>
            <p className="text-xs text-env-muted">
              {progress.points} de {progress.totalPoints} puntos del día
            </p>
          </li>
        </ul>
      </section>

      <div className="flex flex-col gap-3 md:gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-5 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 md:gap-4 lg:min-h-0 lg:flex-1">
          <section
            aria-labelledby="tasks-title"
            className="hud-panel flex flex-col lg:max-h-[50%] lg:min-h-0 lg:shrink-0"
          >
            <h2 id="tasks-title" className="hud-panel-head">
              Tareas de hoy
            </h2>
            {tasks.state === 'loading' ? (
              <div className="m-4 h-32 animate-pulse  bg-env-bg" aria-busy="true" />
            ) : tasks.state === 'error' ? (
              <p className="p-4 text-sm" role="alert">
                <span aria-hidden>⚠ </span>No se pudieron cargar las tareas.{' '}
                <button type="button" onClick={tasks.retry} className="underline">
                  Reintentar
                </button>
              </p>
            ) : list.length === 0 ? (
              <p className="p-4 text-env-muted">No hay tareas para hoy.</p>
            ) : (
              <ul
                className="divide-y divide-env-border/60 [scrollbar-color:var(--env-border)_transparent] lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
                tabIndex={0}
                aria-label="Tareas de hoy"
              >
                {list.map((t) => (
                  <li key={t.id}>
                    <TaskItem
                      task={t}
                      pending={
                        queued.has(t.id) && !serverTasks.find((s) => s.id === t.id)?.completed
                      }
                      busy={busy !== null}
                      onComplete={(task) => void onComplete(task)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Hasta 1536 px, los kudos van aquí, bajo las tareas, y se estiran hasta abajo. */}
          <div className="flex min-h-0 flex-col lg:flex-1 2xl:hidden">{kudosPanel}</div>

          {current && current.badges.length > 0 && (
            <section aria-labelledby="badges-title" className="hud-panel shrink-0">
              <h2 id="badges-title" className="hud-panel-head">
                Insignias
              </h2>
              <ul className="flex flex-wrap gap-2 px-4 py-3">
                {current.badges.map((b) => (
                  <li
                    key={b.id}
                    className="border border-env-primary/50 bg-env-primary/10 px-3 py-1 text-sm"
                    title={`Conseguida el ${new Date(b.earned_at).toLocaleDateString('es-ES')}`}
                  >
                    <Icon name="medal" size={16} className="mr-1.5 text-env-primary" />
                    {b.name}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-3 [scrollbar-color:var(--env-border)_transparent] md:gap-4 lg:min-h-0 lg:overflow-y-auto">
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
        </div>

        <div className="hidden min-h-0 flex-col 2xl:flex">{kudosPanel}</div>
      </div>
    </section>
  )
}
