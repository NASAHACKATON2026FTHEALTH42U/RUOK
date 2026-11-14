/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origen de la API. Vacío (por defecto) = mismo origen; Vite hace de proxy de /api. */
  readonly VITE_API_ORIGIN?: string
  /** Destino del proxy /api en `npm run dev` (por defecto http://localhost:8000). */
  readonly VITE_API_PROXY_TARGET?: string
  /** 'true' = todo el front contra la API simulada (FS-04). */
  readonly VITE_USE_MOCKS?: string
  /** 'true' = si el servidor no responde, las lecturas usan datos de ejemplo (plan B). */
  readonly VITE_MOCK_FALLBACK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
