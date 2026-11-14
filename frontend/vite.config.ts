/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // El front llama siempre a /api/v1 (mismo origen). En desarrollo, Vite reenvía /api al
      // backend: sin CORS y funcionando igual desde un móvil en la red local (npm run dev -- --host).
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
          changeOrigin: true,
          // Backend parado → 503 (no disponible), no el 500 genérico de Vite: así el front lo
          // trata como "sin servidor" (outbox reintenta, caché offline) y no como un fallo del back.
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if ('writeHead' in res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ detail: 'Servidor de a bordo no disponible' }))
              }
            })
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      // En Node no hay origen de página: los tests usan uno ficticio (en el navegador, '' = mismo origen).
      env: { VITE_API_ORIGIN: 'http://ruok.test' },
    },
  }
})
