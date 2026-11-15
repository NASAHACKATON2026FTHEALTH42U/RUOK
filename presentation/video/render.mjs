// Renderiza video.html a fotogramas JPEG (30 fps) con Chromium sin pantalla, por CDP y sin
// dependencias. Uso: node --experimental-websocket render.mjs [carpeta] [fps]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const out = resolve(process.argv[2] ?? 'frames')
const FPS = Number(process.argv[3] ?? 30)
mkdirSync(out, { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'ruok-render-'))
const chrome = spawn('chromium', ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
const wsUrl = await new Promise((ok, ko) => {
  let buf = ''
  const t = setTimeout(() => ko(new Error('Chromium no arrancó')), 30000)
  chrome.stderr.on('data', (d) => {
    buf += d
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/)
    if (m) { clearTimeout(t); ok(m[1]) }
  })
})
const ws = new WebSocket(wsUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) { const { ok, ko } = pending.get(msg.id); pending.delete(msg.id); msg.error ? ko(new Error(msg.error.message)) : ok(msg.result) }
})
const send = (method, params = {}, sessionId) => new Promise((ok, ko) => { const i = ++id; pending.set(i, { ok, ko }); ws.send(JSON.stringify({ id: i, method, params, sessionId })) })

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const s = (m, p) => send(m, p, sessionId)
await s('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await s('Page.enable')
const url = pathToFileURL(resolve('video.html')).href + '?render=1'
await s('Page.navigate', { url })
await new Promise((r) => setTimeout(r, 2500))
const ev = (expression) => s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
await ev('window.ready.then(() => true)')
const total = Math.round(30 * FPS)
const t0 = Date.now()
for (let f = 0; f < total; f++) {
  await ev(`window.seek(${f / FPS}); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`)
  const { data } = await s('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
  writeFileSync(join(out, `${String(f).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'))
  if (f % 150 === 0) console.log(`fotograma ${f}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
}
console.log(`listo: ${total} fotogramas en ${out}`)
ws.close()
chrome.kill()
rmSync(profile, { recursive: true, force: true })
