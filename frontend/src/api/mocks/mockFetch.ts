/** `fetch` simulado: resuelve una Request contra los handlers de la API mock (FS-04). */
import { handlers, mockNow, MockResponse, type MockRequest } from './handlers'

const API_PREFIX = '/api/v1'

interface Route {
  method: string
  regex: RegExp
  paramNames: string[]
  key: string
}

const routes: Route[] = Object.keys(handlers).map((key) => {
  const [method, pattern] = key.split(' ')
  const paramNames: string[] = []
  const source = pattern.replace(/\{(\w+)\}/g, (_, name: string) => {
    paramNames.push(name)
    return '([^/]+)'
  })
  return { method, regex: new RegExp(`^${source}$`), paramNames, key }
})

/** Busca el handler de una operación. Exportado para los tests de cobertura. */
export function matchRoute(method: string, path: string) {
  for (const r of routes) {
    if (r.method !== method) continue
    const m = r.regex.exec(path)
    if (!m) continue
    const params = Object.fromEntries(r.paramNames.map((n, i) => [n, decodeURIComponent(m[i + 1])]))
    return { key: r.key, params }
  }
  return null
}

/** Latencia simulada para que la UI muestre sus estados de carga (0 en los tests). */
const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 150

function sse(events: unknown[]): string {
  return events
    .map((e) => {
      const ev = e as { id: number; type: string }
      return `id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(e)}\n\n`
    })
    .join('')
}

export async function mockFetch(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.startsWith(API_PREFIX)
    ? url.pathname.slice(API_PREFIX.length)
    : url.pathname
  const headers = { 'X-Server-Time': mockNow().toISOString(), 'X-Ruok-Mock': '1' }

  if (LATENCY_MS) await new Promise((r) => setTimeout(r, LATENCY_MS))

  const route = matchRoute(request.method, path)
  if (!route) {
    return Response.json(
      { detail: `Sin mock para ${request.method} ${path}` },
      { status: 404, headers },
    )
  }

  // El cuerpo se lee según el método, no mirando `request.body`: Firefox no implementa esa
  // propiedad (siempre `undefined`) y allí todas las escrituras llegaban vacías (el login del
  // modo demo respondía 401).
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const text = hasBody ? await request.clone().text() : ''
  const req: MockRequest = {
    params: route.params,
    query: url.searchParams,
    body: text ? JSON.parse(text) : undefined,
  }
  const result = handlers[route.key](req)

  if (route.key === 'GET /events/stream') {
    return new Response(sse(result as unknown[]), {
      headers: { ...headers, 'Content-Type': 'text/event-stream' },
    })
  }
  if (result instanceof MockResponse) {
    return Response.json(result.body, { status: result.status, headers })
  }
  return Response.json(result, { headers })
}
