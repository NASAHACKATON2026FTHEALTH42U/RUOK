import { useEffect, useState } from 'react'
import { serverNow } from '../../api/client'
import { missionPhase, type Mission } from '../behavioral/missionPhase'

/** Solo lo que usa el reloj (vale el `Environment` del contrato o el de la caché). */
interface ClockEnv {
  id: string
  mission?: Mission | null
}

/** Reloj de la cabecera HUD: hora del servidor (la demo acelera el reloj) y día de misión. */
export function HudClock({ env }: { env?: ClockEnv }) {
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 1000)
    return () => clearInterval(id)
  }, [])

  const phase = env?.mission ? missionPhase(env.mission, now) : null
  // En Marte el día es un "sol"; en el resto, un día de misión.
  const day =
    phase?.status === 'active' ? `${env?.id === 'mars' ? 'Sol' : 'Día'} ${phase.day} · ` : ''

  return (
    <div className="text-right">
      <time
        dateTime={now.toISOString()}
        className="block font-mono text-[19px] leading-tight font-light tabular-nums"
      >
        {now.toLocaleTimeString('es-ES', { hour12: false })}
      </time>
      <span className="hud-label text-[9px]">{day}Hora local</span>
    </div>
  )
}
