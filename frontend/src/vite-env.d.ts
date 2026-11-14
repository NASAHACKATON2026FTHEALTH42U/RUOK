/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origen de la API. Vacío (por defecto) = mismo origen; Vite hace de proxy de /api. */
  readonly VITE_API_ORIGIN?: string
  /** Destino del proxy /api en `npm run dev` (por defecto http://localhost:8000). */
  readonly VITE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
