import { useState } from 'react'
import { ApiError, NetworkError, type Schema } from '../../api/client'
import type { ControlOverview } from '../../api/useControl'
import {
  demoFastForward,
  demoLink,
  demoReset,
  demoScenario,
  pauseLiveness,
} from '../../offline/outbox'
import { formatDuration } from './feed'

/** Escenarios del contrato (docs/api-contract.md, `POST /demo/scenarios/{name}`). */
const SCENARIOS: { id: string; label: string }[] = [
  { id: 'mars_sleep_bp', label: 'Marte: mal sueño y tensión alta' },
  { id: 'eva_no_contact', label: 'EVA sin contacto' },
  { id: 'geriatric_fall_risk', label: 'Geriatría: riesgo de caída' },
]

const FAST_FORWARD: number[] = [60, 300, 900, 3600]

const LINK_STATES: { id: Schema<'LinkState'>; label: string }[] = [
  { id: 'online', label: '● En línea' },
  { id: 'delayed', label: '◐ Con retardo' },
  { id: 'los', label: '○ LOS' },
]

const btn =
  'rounded-lg border border-env-border px-3 py-1.5 text-sm hover:border-env-text disabled:opacity-50'

/**
 * Controles de demo (FE-32): reset, escenarios, estado del enlace y pausa del liveness por
 * entorno, y fast-forward del reloj. Todo el guion de docs/demo-script.md se maneja desde aquí.
 */
export function DemoControls({
  overview,
  onChanged,
}: {
  overview: ControlOverview
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string | null>(null)

  const run = async (label: string, fn: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    try {
      await fn()
      setLog(`✓ ${label}`)
      onChanged()
    } catch (err) {
      setLog(
        `⚠ ${label}: ${
          err instanceof NetworkError
            ? 'sin conexión con el servidor'
            : err instanceof ApiError
              ? err.message
              : String(err)
        }`,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label="Controles de demo"
      className="rounded-xl border border-env-border bg-env-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">Controles de demo</h2>
        <p role="status" className="text-sm text-env-muted">
          {log ?? 'Cada acción se refleja al instante en el panorama y en los móviles.'}
        </p>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-env-muted">Preparación y escenarios</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className={btn}
              onClick={() =>
                run(
                  'Base de datos reiniciada con el seed',
                  demoReset,
                  '¿Reiniciar la base de datos con el seed de la demo?',
                )
              }
            >
              ↺ Reset
            </button>
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                className={btn}
                onClick={() => run(`Escenario "${s.label}" cargado`, () => demoScenario(s.id))}
              >
                ▶ {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-env-muted">Reloj de la demo (fast-forward)</h3>
          <div className="flex flex-wrap gap-2">
            {FAST_FORWARD.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                className={btn}
                onClick={() =>
                  run(`Reloj adelantado ${formatDuration(s)}`, () => demoFastForward(s))
                }
              >
                ⏩ +{formatDuration(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 lg:col-span-1">
          <h3 className="text-sm font-medium text-env-muted">Enlace y liveness por entorno</h3>
          <ul className="space-y-1.5">
            {overview.environments.map((e) => (
              <li key={e.environment.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-36 truncate" title={e.environment.name}>
                  {e.environment.name}
                </span>
                <span
                  role="group"
                  aria-label={`Enlace de ${e.environment.name}`}
                  className="flex gap-1"
                >
                  {LINK_STATES.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      disabled={busy}
                      aria-pressed={e.link.state === l.id}
                      onClick={() =>
                        run(`Enlace de ${e.environment.name} → ${l.label}`, () =>
                          demoLink(e.environment.id, l.id),
                        )
                      }
                      className={`rounded-md border px-2 py-0.5 text-xs disabled:opacity-50 ${
                        e.link.state === l.id
                          ? 'border-env-text bg-env-bg font-semibold'
                          : 'border-env-border hover:border-env-text'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </span>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={e.liveness_paused}
                    onChange={(ev) =>
                      run(
                        `Liveness de ${e.environment.name} ${ev.target.checked ? 'en pausa' : 'reanudado'}`,
                        () => pauseLiveness(e.environment.id, ev.target.checked),
                      )
                    }
                  />
                  pausar liveness
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
