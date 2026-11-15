import { useCallback, useEffect, useRef, useState } from 'react'
import { serverNow } from '../api/client'
import { getStatusSummary, useHomeMessages } from '../api/useHomeMessages'
import { useLink } from '../api/useLink'
import { useActiveMemberId } from '../auth/useAuth'
import {
  buildThread,
  cleanText,
  describeState,
  MAX_LENGTH,
  transitProgress,
  type LocalMessage,
  type ThreadItem,
  type Tone,
} from '../components/behavioral/homeMessages'
import { describeLink, formatDelay, hhmm } from '../components/ui/link'
import { pendingHomeMessages, sendHomeMessage, useOutboxStore } from '../offline/outbox'
import { useEnvironmentStore } from '../store/environment'
import { NoMemberSelected } from '../components/ui/NoMemberSelected'
import { AutoTextarea } from '../components/ui/AutoTextarea'
import { useT } from '../i18n/t'

/** Clase del color de cada tono. El estado nunca va solo con color: lleva icono y texto. */
const TONE_CLASS: Record<Tone, string> = {
  none: 'text-st-none',
  transit: 'text-env-text',
  ok: 'text-st-ok',
  crit: 'text-st-crit',
}

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-env-primary'

/**
 * "Mensaje a casa" (FE-23, docs/behavioral-health.md "Conexión con la Tierra"): bandeja tipo
 * chat asíncrono. Cada mensaje viaja por el enlace simulado y enseña su estado: en cola (sin
 * enlace, LOS), en tránsito con la cuenta atrás hasta la ETA, o entregado. Las respuestas de
 * casa aparecen cuando llegan a bordo.
 *
 * Enviar pasa por el outbox (UUID de cliente): sin conexión con el servidor de a bordo el
 * mensaje se queda en el dispositivo, se ve como tal y sale solo después. Los tiempos usan el
 * reloj del servidor (`serverNow()`), así que siguen al fast-forward de la demo.
 */
export default function HomeMessages() {
  const memberId = useActiveMemberId()
  const envId = useEnvironmentStore((s) => s.envId)
  const messages = useHomeMessages(memberId, envId)
  const link = useLink(envId, 5_000)
  const t = useT()

  const [local, setLocal] = useState<LocalMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summaryBusy, setSummaryBusy] = useState(false)
  /** Añade al mensaje un resumen con los datos reales (se puede editar antes de enviarlo). */
  const addSummary = async (period: 'day' | 'week') => {
    if (memberId === null) return
    setSummaryBusy(true)
    try {
      const sum = await getStatusSummary(memberId, period)
      setDraft((d) => (d.trim() ? `${d.trim()}\n\n${sum.text}` : sum.text).slice(0, MAX_LENGTH))
    } catch {
      setError(t('no se ha podido preparar el resumen (sin conexión con el servidor)'))
    } finally {
      setSummaryBusy(false)
    }
  }
  const [now, setNow] = useState(() => serverNow())
  const endRef = useRef<HTMLLIElement>(null)

  // Cuenta atrás de las ETA: un tic por segundo con el reloj del servidor.
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000)
    return () => clearInterval(id)
  }, [])

  // Lo que sigue en el outbox de este dispositivo. Se relee cuando el outbox cambia (se vacía
  // al sincronizar) y entonces se refresca también el hilo del servidor.
  const outboxPending = useOutboxStore((s) => s.pending)
  const outboxFailed = useOutboxStore((s) => s.failed)
  const refreshThread = messages.refresh
  const reloadLocal = useCallback(async () => {
    if (memberId === null) return
    try {
      setLocal(await pendingHomeMessages(memberId))
    } catch {
      setLocal([]) // sin IndexedDB (modo privado) no hay nada guardado
    }
  }, [memberId])
  useEffect(() => {
    void reloadLocal().then(refreshThread)
  }, [reloadLocal, refreshThread, outboxPending, outboxFailed])

  const thread = buildThread(messages.state === 'ready' ? messages.data : [], local)

  // La conversación se queda abajo, en lo último, cuando llega algo nuevo.
  const lastId = thread[thread.length - 1]?.id
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [lastId, thread.length])

  const title = (
    <header className="shrink-0">
      <h1 className="text-2xl font-semibold">{t('Mensaje a casa')}</h1>
    </header>
  )

  if (memberId === null) {
    return (
      <section className="mx-auto flex max-w-xl flex-col gap-3">
        {title}
        <NoMemberSelected className="" />
      </section>
    )
  }

  // Estado del enlace: si no se puede consultar es DESCONOCIDO, nunca el último visto.
  const linkData = link.state === 'ready' && !link.refreshFailed ? link.data : null
  const linkText = describeLink(linkData)
  const linkTone = !linkData ? 'text-st-none' : linkData.state === 'los' ? 'text-st-warn' : ''
  const hint = !linkData
    ? t('No se sabe cómo está el enlace. Puedes escribir: el mensaje saldrá cuando se pueda.')
    : linkData.state === 'los'
      ? t('Ahora no hay enlace con casa. Lo que escribas se queda en cola y sale en cuanto vuelva.')
      : linkData.delay_s > 0
        ? t('Cada mensaje tarda {delay} en llegar, y la respuesta otro tanto en volver.', {
            delay: formatDelay(linkData.delay_s),
          })
        : t('El enlace va en directo: los mensajes llegan al momento.')

  const text = cleanText(draft)
  const send = async () => {
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      await sendHomeMessage(memberId, text)
      setDraft('')
      await reloadLocal()
      refreshThread()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    // Ocupa el alto disponible (Layout `fill`): solo la conversación tiene scroll.
    <section className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-2.5 md:gap-3 lg:max-w-5xl">
      {title}

      <section
        aria-label={t('Conversación con casa')}
        className="hud-panel flex min-h-0 flex-1 flex-col"
      >
        <div className="hud-panel-head shrink-0">
          {t('Conversación')}
          {/* El chip ya lleva su cuadrito: el estado lo dice el texto, no solo el color. */}
          <span
            role="status"
            title={t('Enlace con casa: {state}', { state: linkText.long })}
            className={`hud-chip mr-[22px] ${linkTone}`}
          >
            {linkText.short}
          </span>
        </div>
        <p className="shrink-0 border-b border-hud-line px-3.5 py-2 text-sm text-env-muted">
          {hint}
        </p>

        {messages.state === 'loading' && (
          <p className="px-3.5 py-3 text-sm text-env-muted">{t('Cargando la conversación…')}</p>
        )}
        {messages.state === 'error' && thread.length === 0 && (
          <p role="alert" className="px-3.5 py-3 text-sm">
            {t('No se ha podido cargar la conversación.')}{' '}
            <button type="button" onClick={messages.retry} className="underline">
              {t('Reintentar')}
            </button>
          </p>
        )}
        {messages.state === 'ready' && messages.refreshFailed && (
          <p role="status" className="shrink-0 px-3.5 pt-2 text-sm text-st-none">
            {t('Sin conexión con el servidor de a bordo: la conversación puede estar desfasada.')}
          </p>
        )}
        {messages.state === 'ready' && thread.length === 0 && (
          <p className="px-3.5 py-6 text-center text-sm text-env-muted">
            {t('Aún no has escrito a casa. Cuéntales cómo va el día.')}
          </p>
        )}

        {/* Sin aria-live: la cuenta atrás cambia cada segundo y un lector la repetiría entera. */}
        <ol
          aria-label={t('Mensajes')}
          className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 py-3"
        >
          {thread.map((m) => (
            <Bubble key={m.id} item={m} now={now} />
          ))}
          <li ref={endRef} aria-hidden className="h-px shrink-0" />
        </ol>
      </section>

      <form
        className="flex shrink-0 flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="home-message" className="hud-label">
            {t('Tu mensaje')}
          </label>
          <div role="group" aria-label={t('Añadir un resumen')} className="flex gap-1.5">
            {(
              [
                ['day', 'Resumen de hoy'],
                ['week', 'Resumen de la semana'],
              ] as const
            ).map(([period, label]) => (
              <button
                key={period}
                type="button"
                disabled={memberId === null || summaryBusy}
                onClick={() => void addSummary(period)}
                className="min-h-9 border border-env-border px-3 text-sm text-env-muted hover:border-env-text hover:text-env-text disabled:opacity-50"
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        <AutoTextarea
          id="home-message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Intro envía; Intro a secas es un salto de línea (también en móvil).
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void send()
            }
          }}
          maxLength={MAX_LENGTH}
          rows={2}
          placeholder={t('Escribe a casa…')}
          className={`hud-input !py-2.5 !font-sans !text-[0.9375rem] leading-snug ${focusRing}`}
        />
        {error && (
          <p role="alert" className="text-sm text-st-crit">
            {t('No se ha podido guardar: {error}', { error })}
          </p>
        )}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.75rem] text-env-muted" aria-live="off">
            {draft.length}/{MAX_LENGTH}
          </span>
          <button
            type="submit"
            disabled={!text || busy}
            className="hud-btn hud-btn-primary ml-auto !h-11 min-w-[9.5rem]"
          >
            {busy ? t('Enviando…') : t('Enviar')}
          </button>
        </div>
      </form>
    </section>
  )
}

/** Un mensaje del hilo: los míos a la derecha, las respuestas de casa a la izquierda. */
function Bubble({ item, now }: { item: ThreadItem; now: Date }) {
  const mine = item.direction === 'up'
  const t = useT()
  const state = describeState(item, now)
  const inTransit = item.state === 'in_transit' && item.eta !== null
  return (
    <li
      className={`flex max-w-[88%] flex-col border px-3 py-2 ${
        mine
          ? 'self-end border-env-primary/45 bg-env-primary/[0.07]'
          : 'self-start border-env-border bg-env-bg/60'
      }`}
    >
      <p className="hud-label mb-1">
        {mine ? t('Tú') : (item.sender ?? t('Casa'))} · {hhmm(item.sentAt)}
      </p>
      <p className="text-[0.9375rem] leading-snug break-words whitespace-pre-wrap text-env-text">
        {item.text}
      </p>
      <p
        className={`mt-1.5 flex items-start gap-1.5 font-mono text-xs tracking-[0.08em] uppercase ${TONE_CLASS[state.tone]}`}
      >
        <span aria-hidden>{state.icon}</span>
        <span>{state.label}</span>
      </p>
      {inTransit && (
        <span
          role="progressbar"
          aria-label={t('Viaje del mensaje')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(transitProgress(item.sentAt, item.eta!, now) * 100)}
          className="hud-bar mt-1.5 text-env-primary"
        >
          <i style={{ width: `${transitProgress(item.sentAt, item.eta!, now) * 100}%` }} />
        </span>
      )}
    </li>
  )
}
