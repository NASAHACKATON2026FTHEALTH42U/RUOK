import { useState, type FormEvent } from 'react'
import { ApiError, NetworkError, type Schema } from '../../api/client'
import { newId } from '../../api/newId'
import { capitalize } from '../../environments/useVocab'
import { sendAlert, sendNotification } from '../../offline/outbox'
import { categoryLabel, severityStyle } from '../alerts/alertFormat'
import { defaultTarget, roleLabel } from '../alerts/sos'
import { Modal } from '../ui/Modal'
import { AutoTextarea } from '../ui/AutoTextarea'

type Category = Schema<'AlertCategory'>
type Severity = Schema<'AlertSeverity'>
type Level = Schema<'NotificationLevel'>

/** Todas las categorías de alerta: el operador puede probar también las que crea el sistema. */
const CATEGORIES: Category[] = [
  'emergency',
  'symptom',
  'physical',
  'psychological',
  'indicator',
  'no_contact',
]
const SEVERITIES: Severity[] = ['warning', 'critical', 'emergency']
const LEVELS: { id: Level; label: string }[] = [
  { id: 'info', label: 'Información' },
  { id: 'warning', label: 'Aviso' },
  { id: 'critical', label: 'Importante' },
]

const FIELD = 'flex min-w-0 flex-col gap-1.5'
const INPUT = 'hud-input w-full !font-sans !text-[0.9375rem]'

export interface Recipient {
  id: number
  name: string
}

/** Grupo de botones excluyentes (pestañas pequeñas) con el estilo HUD. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`min-h-9 border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-env-primary ${
            value === o.id
              ? 'border-env-primary bg-env-primary/15 text-env-text'
              : 'border-env-border text-env-muted hover:border-env-text hover:text-env-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function errorText(err: unknown): string {
  if (err instanceof NetworkError) return 'sin conexión con el servidor'
  if (err instanceof ApiError) return err.message
  return String(err)
}

/**
 * Alerta o notificación personalizada del operador para el member elegido en el ámbito o, si no
 * hay ninguno, para todos los del entorno. La alerta sigue su ciclo normal (destino, escalado,
 * resolución); la notificación es solo un mensaje. Las dos llegan al momento al móvil del member
 * y a quien le atiende.
 */
export function OperatorMessageForm({
  recipients,
  memberId,
  ladder,
  vocabulary,
  onSent,
}: {
  recipients: Recipient[]
  /** Member elegido en el ámbito (barra lateral); null = todo el entorno. */
  memberId: number | null
  ladder: string[]
  vocabulary: Record<string, string>
  onSent?: () => void
}) {
  const [mode, setMode] = useState<'alert' | 'notification'>('alert')
  const [category, setCategory] = useState<Category>('emergency')
  const [severity, setSeverity] = useState<Severity>('emergency')
  const [target, setTarget] = useState(defaultTarget(ladder) ?? ladder[0] ?? 'self')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [level, setLevel] = useState<Level>('info')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<string | null>(null)

  const targets = memberId !== null ? recipients.filter((r) => r.id === memberId) : recipients

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (targets.length === 0) return
    setBusy(true)
    let queued = 0
    try {
      for (const r of targets) {
        if (mode === 'alert') {
          const res = await sendAlert(r.id, {
            id: newId(),
            category,
            severity,
            message: text.trim() || null,
            target_role: target,
            system_id: null,
          })
          if (res.status === 'queued') queued++
        } else {
          await sendNotification(r.id, {
            id: newId(),
            title: title.trim() || null,
            text: text.trim(),
            level,
          })
        }
      }
      const who = targets.length === 1 ? targets[0].name : `${targets.length} ${vocabulary.crew}`
      setLog(
        queued
          ? `⇡ Sin conexión: la alerta para ${who} se enviará sola al volver`
          : `✓ ${mode === 'alert' ? 'Alerta enviada' : 'Notificación enviada'} a ${who}`,
      )
      setText('')
      setTitle('')
      onSent?.()
    } catch (err) {
      setLog(`⚠ No se ha podido enviar: ${errorText(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Alerta o notificación">
      <Segmented
        label="Tipo"
        value={mode}
        onChange={setMode}
        options={[
          { id: 'alert', label: 'Alerta' },
          { id: 'notification', label: 'Notificación' },
        ]}
      />

      <p className="text-sm">
        <span className="hud-label mr-2">Para</span>
        {memberId !== null
          ? (targets[0]?.name ?? '…')
          : `todo ${vocabulary.crew} (${recipients.length})`}
        <span className="block text-xs text-env-muted">
          Se cambia en el selector de {vocabulary.member} de la barra lateral.
        </span>
      </p>

      {mode === 'alert' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={FIELD}>
            <span className="hud-label">Categoría</span>
            <select
              value={category}
              onChange={(e) => {
                const c = e.target.value as Category
                setCategory(c)
                if (c === 'emergency') setSeverity('emergency')
              }}
              className={INPUT}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD}>
            <span className="hud-label">Gravedad</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className={INPUT}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {capitalize(severityStyle(s).label.toLowerCase())}
                </option>
              ))}
            </select>
          </label>
          <label className={`${FIELD} sm:col-span-2`}>
            <span className="hud-label">Destino</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={INPUT}>
              {ladder.map((r, i) => (
                <option key={r} value={r}>
                  Nivel {i}: {roleLabel(r, vocabulary)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="grid gap-4">
          <label className={FIELD}>
            <span className="hud-label">Título (opcional)</span>
            <input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT}
              placeholder="Aviso de control"
            />
          </label>
          <div className={FIELD}>
            <span className="hud-label">Nivel</span>
            <Segmented label="Nivel" value={level} onChange={setLevel} options={LEVELS} />
          </div>
        </div>
      )}

      <label className={FIELD}>
        <span className="hud-label">{mode === 'alert' ? 'Mensaje (opcional)' : 'Mensaje'}</span>
        <AutoTextarea
          required={mode === 'notification'}
          rows={3}
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className={`${INPUT}`}
          placeholder={
            mode === 'alert'
              ? 'Qué pasa (lo verá en el detalle de la alerta)'
              : 'Lo verá al momento en su móvil'
          }
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || targets.length === 0}
          className="hud-btn hud-btn-primary disabled:opacity-50"
        >
          {busy ? 'Enviando…' : mode === 'alert' ? 'Enviar alerta' : 'Enviar notificación'}
        </button>
        <p role="status" className="text-sm text-env-muted">
          {log}
        </p>
      </div>
    </form>
  )
}

/** Botón «Nueva alerta o notificación» con el formulario en un modal (cabeceras del operador). */
export function OperatorMessageButton(props: Parameters<typeof OperatorMessageForm>[0]) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hud-btn hud-btn-primary !h-auto min-h-10 px-4"
      >
        ＋ Alerta o notificación
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} labelledBy="operator-message-title">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="hud-panel w-full max-w-xl">
              <h2 id="operator-message-title" className="hud-panel-head">
                Nueva alerta o notificación
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="mr-2.5 ml-auto px-2 text-lg leading-none text-env-muted hover:text-env-text"
                >
                  ×
                </button>
              </h2>
              <div className="p-4">
                <OperatorMessageForm {...props} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
