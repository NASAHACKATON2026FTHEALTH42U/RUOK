import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useNetworkInfo } from '../../api/useNetworkInfo'
import { joinUrl } from './qr'

/**
 * QR de conexión (FE-32) a partir de `/system/network-info`, generado en el navegador con la
 * librería `qrcode` empaquetada (sin CDN ni servicios externos). Un móvil nuevo lo escanea y
 * abre el login en la red local; cada móvil es un dispositivo propio (su `device_id`).
 */
export function ConnectQr() {
  const info = useNetworkInfo()
  const urls = info.state === 'ready' ? info.data.lan_urls : []
  const [index, setIndex] = useState(0)
  const [svg, setSvg] = useState<string | null>(null)
  const url = urls[index] ? joinUrl(urls[index]) : null

  useEffect(() => {
    if (!url) return
    let cancelled = false
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(
      (s) => !cancelled && setSvg(s),
      () => !cancelled && setSvg(null),
    )
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <section aria-label="QR de conexión" className="hud-panel">
      <h2 className="hud-panel-head">Conectar un móvil</h2>
      <div className="p-4">
        {info.state === 'loading' && <div className="h-48 w-48 animate-pulse bg-env-bg" />}
        {info.state === 'error' && (
          <p className="text-env-muted">
            No se ha podido obtener la dirección del servidor.{' '}
            <button type="button" onClick={info.retry} className="underline">
              Reintentar
            </button>
          </p>
        )}
        {info.state === 'ready' && urls.length === 0 && (
          <p className="text-env-muted">El servidor no tiene dirección en la red local.</p>
        )}
        {url && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Fondo blanco siempre: los lectores de QR necesitan contraste oscuro sobre claro. */}
            <div
              role="img"
              aria-label={`Código QR para abrir ${url}`}
              className="h-48 w-48  bg-white p-2"
              // SVG generado localmente por la librería a partir de la URL del servidor.
              dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
            />
            <div className="space-y-2 text-sm">
              <p>Escanéalo con la cámara del móvil, conectado a la misma wifi que este servidor.</p>
              <p className="font-mono text-base break-all">{url}</p>
              {urls.length > 1 && (
                <label className="block">
                  <span className="text-env-muted">Dirección</span>
                  <select
                    value={index}
                    onChange={(e) => setIndex(Number(e.target.value))}
                    className="mt-1 block  border border-env-border bg-env-bg px-2 py-1 text-env-text"
                  >
                    {urls.map((u, i) => (
                      <option key={u} value={i}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {info.state === 'ready' && (
                <p className="text-env-muted">Servidor: {info.data.hostname}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
