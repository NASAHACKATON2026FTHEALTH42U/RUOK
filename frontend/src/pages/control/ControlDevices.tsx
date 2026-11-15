import { serverNow } from '../../api/client'
import { useDevices } from '../../api/useControl'
import { useUsers } from '../../api/useUsers'
import { ConnectQr } from '../../components/control/ConnectQr'
import { ControlHeader, ControlPanel } from '../../components/control/ControlHeader'
import { useControlScope } from '../../components/control/useControlScope'
import { formatAgo } from '../../lib/time'

const KIND: Record<string, string> = {
  phone: 'Móvil',
  tablet: 'Tablet',
  desktop: 'Ordenador',
  projector: 'Proyector',
}

/**
 * Dispositivos (FE-31/32, solo admin): los del entorno activo (por su último usuario), con lo que
 * tienen pendiente de enviar y su última sincronización, y el QR para conectar uno nuevo.
 */
export default function ControlDevices() {
  const { envId, env } = useControlScope()
  const devices = useDevices(envId)
  const users = useUsers()
  const now = serverNow()
  const userName = (id: number | null) =>
    id == null
      ? '—'
      : ((users.state === 'ready' ? users.data.find((u) => u.id === id)?.display_name : null) ??
        `#${id}`)
  const list = devices.state === 'ready' ? devices.data : []

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <ControlHeader
        title="Dispositivos"
        subtitle={`Móviles y tablets de ${env?.name ?? 'el entorno'}: conexión, pendientes y sincronización.`}
      />
      {/* En escritorio, la tabla mide lo que su contenido y, como mucho, el hueco: el scroll es suyo. */}
      <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <ControlPanel
          title="Dispositivos del entorno"
          aside={devices.state === 'ready' ? `${list.length}` : undefined}
          className="xl:max-h-full xl:min-h-0"
          bodyClassName="min-h-0 flex-1 overflow-auto [scrollbar-color:var(--env-border)_transparent]"
        >
          {devices.state === 'loading' && <div className="m-4 h-32 animate-pulse bg-env-bg" />}
          {devices.state === 'error' && (
            <p className="p-4 text-env-muted">
              No se han podido cargar.{' '}
              <button type="button" onClick={devices.retry} className="underline">
                Reintentar
              </button>
            </p>
          )}
          {devices.state === 'ready' && list.length === 0 && (
            <p className="p-4 text-sm text-env-muted">
              Ningún dispositivo de este entorno todavía. Conecta uno con el QR e inicia sesión.
            </p>
          )}
          {list.length > 0 && (
            <div>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-env-surface text-left">
                  <tr>
                    {['Dispositivo', 'Usuario', 'IP', 'Visto', 'Pendientes', 'Sincronizado'].map(
                      (h) => (
                        <th key={h} className="hud-label px-4 py-2 font-normal">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => (
                    <tr key={d.id} className="border-t border-env-border/60">
                      <td className="px-4 py-2" title={d.id}>
                        {d.label ?? d.id.slice(0, 8)}
                        {d.kind && (
                          <span className="block text-xs text-env-muted">
                            {KIND[d.kind] ?? d.kind}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{userName(d.user_id)}</td>
                      <td className="px-4 py-2 font-mono text-env-muted">{d.ip ?? '—'}</td>
                      <td className="px-4 py-2">{formatAgo(d.last_seen_at, now)}</td>
                      <td
                        className={`px-4 py-2 tabular-nums ${d.pending_outbox > 0 ? 'font-semibold' : ''}`}
                      >
                        {d.pending_outbox > 0 ? `⇡ ${d.pending_outbox}` : '0'}
                      </td>
                      <td className="px-4 py-2">
                        {d.last_sync_at ? formatAgo(d.last_sync_at, now) : 'nunca'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ControlPanel>
        <ConnectQr />
      </div>
    </section>
  )
}
