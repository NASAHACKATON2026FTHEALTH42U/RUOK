import type { Schema } from '../../api/client'
import { formatDelay, hhmm } from '../ui/link'

/**
 * Lógica pura de "Mensaje a casa" (FE-23, docs/behavioral-health.md "Conexión con la Tierra").
 * El estado de cada mensaje lo decide el servidor (enlace simulado, BE-22); aquí solo se junta
 * el hilo con lo que aún está en el outbox del dispositivo y se le pone texto.
 */
export type HomeMessage = Schema<'HomeMessage'>

/** Mensaje escrito en este dispositivo que el servidor todavía no tiene (o ha rechazado). */
export interface LocalMessage {
  id: string
  text: string
  created_at: string
  failed: boolean
}

/**
 * `local` = guardado en el dispositivo, sin enviar; `failed` = el servidor lo rechazó;
 * el resto son los estados del enlace (en cola por LOS, en tránsito con ETA, entregado).
 */
export type MessageState = 'local' | 'failed' | 'queued' | 'in_transit' | 'delivered'

export interface ThreadItem {
  id: string
  direction: 'up' | 'down'
  text: string
  sender: string | null
  sentAt: string
  eta: string | null
  deliveredAt: string | null
  state: MessageState
}

/** Hilo en orden de envío: lo del servidor y, al final, lo que aún no ha salido del dispositivo. */
export function buildThread(server: readonly HomeMessage[], local: readonly LocalMessage[]) {
  const known = new Set(server.map((m) => m.id))
  const items: ThreadItem[] = server.map((m) => ({
    id: m.id,
    direction: m.direction,
    text: m.text,
    sender: m.sender ?? null,
    sentAt: m.sent_at,
    eta: m.eta,
    deliveredAt: m.delivered_at ?? null,
    state: m.state,
  }))
  for (const m of local) {
    if (known.has(m.id)) continue // ya llegó al servidor: manda su estado
    items.push({
      id: m.id,
      direction: 'up',
      text: m.text,
      sender: null,
      sentAt: m.created_at,
      eta: null,
      deliveredAt: null,
      state: m.failed ? 'failed' : 'local',
    })
  }
  return items.sort((a, b) => a.sentAt.localeCompare(b.sentAt))
}

/** Segundos que faltan para la ETA (0 si ya ha pasado). */
export function secondsLeft(eta: string, now: Date): number {
  return Math.max(0, Math.round((new Date(eta).getTime() - now.getTime()) / 1000))
}

/** Parte del viaje ya recorrida, de 0 a 1 (para la barra de "en tránsito"). */
export function transitProgress(sentAt: string, eta: string, now: Date): number {
  const start = new Date(sentAt).getTime()
  const end = new Date(eta).getTime()
  if (end <= start) return 1
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)))
}

export type Tone = 'none' | 'transit' | 'ok' | 'crit'

/** Icono (forma, no solo color), texto y tono del estado de un mensaje. */
export function describeState(
  item: ThreadItem,
  now: Date,
): { icon: string; label: string; tone: Tone } {
  switch (item.state) {
    case 'local':
      return {
        icon: '▫',
        label: 'Guardado en este dispositivo · saldrá al volver la conexión',
        tone: 'none',
      }
    case 'failed':
      return { icon: '✕', label: 'No enviado: el servidor lo ha rechazado', tone: 'crit' }
    case 'queued':
      return { icon: '○', label: 'En cola · sin enlace', tone: 'none' }
    case 'in_transit': {
      const left = item.eta ? secondsLeft(item.eta, now) : 0
      return {
        icon: '◷',
        label: left > 0 ? `En tránsito · llega en ${formatDelay(left)}` : 'En tránsito · llegando',
        tone: 'transit',
      }
    }
    case 'delivered': {
      const at = item.deliveredAt ? ` ${hhmm(item.deliveredAt)}` : ''
      return {
        icon: '✓',
        label: item.direction === 'up' ? `Entregado en casa${at}` : `Recibido${at}`,
        tone: 'ok',
      }
    }
  }
}

export const MAX_LENGTH = 500

/** Texto listo para enviar, o null si está vacío (el servidor exige de 1 a 500 caracteres). */
export function cleanText(raw: string): string | null {
  const text = raw.trim()
  return text.length > 0 ? text.slice(0, MAX_LENGTH) : null
}
