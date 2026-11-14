# frontend/ — app del member y consola /ground (React + Vite + TS)

Dueños: **Front A** y **Front B**. Scaffolding hecho en **FE-01** (#4).

## Comandos

Requiere Node.js 20 LTS (la CI usa Node 20).

```bash
npm ci                 # instala exactamente lo del package-lock.json
npm run dev            # servidor de desarrollo en http://localhost:5173
npm run build          # chequeo de tipos (tsc -b) + build en dist/
npm run preview        # sirve el build de dist/
npm run lint           # ESLint
npm run format         # Prettier (escribe)
npm run format:check   # Prettier (solo comprueba)
npm run gen:api        # regenera src/api/types.gen.ts desde el OpenAPI del backend (usa uv)
npm test               # tests unitarios (Vitest)
npm run typecheck      # solo tsc -b
```

Antes de abrir una PR: `npm run lint && npm run build && npm test` (es lo que ejecuta el job `Frontend` de la CI). Si el backend cambió la API: `npm run gen:api` y commitea `types.gen.ts` (lo comprueba el job `Contrato API`).

> `VITE_USE_MOCKS=true` llega con **FS-04** (#7).

## API: tipos y cliente (FS-03)

- **Tipos:** `npm run gen:api` lee el OpenAPI **directamente del código de FastAPI** con `uv`, sin arrancar el servidor, y genera `src/api/types.gen.ts` con `openapi-typescript` 7.13. Para leerlo de un servidor en marcha: `OPENAPI_URL=http://<ip>:8000/openapi.json npm run gen:api`. **No edites `types.gen.ts` a mano.**
- **Cliente:** `src/api/client.ts` (`openapi-fetch`). Ruta, parámetros, cuerpo y respuesta están tipados a partir del contrato:

  ```ts
  import { api, unwrap, type Schema } from '../api/client'

  const a: Schema<'Assessment'> = await unwrap(
    api.GET('/api/v1/members/{member_id}/assessment', { params: { path: { member_id: 1 } } }),
  )
  ```

  - `unwrap()` devuelve `data` o lanza **`ApiError`** (`status` y `detail` de FastAPI; los 422 se resumen).
  - Un fallo de red lanza **`NetworkError`**: es la señal para que el outbox (FE-11) guarde y reintente.
  - `configureApi({ getToken, getDeviceId, onUnauthorized })` lo conectan **FE-27** (sesión: añade `Authorization`; con un 401, login sin borrar el outbox) y **FE-30** (añade `X-Device-Id`).
  - `serverNow()` da la hora del servidor (cabecera `X-Server-Time`). **Úsala para "hace X min" y las ETA**: con el fast-forward de la demo, el reloj del dispositivo no vale.

- **IDs:** `newId()` (`src/api/newId.ts`) genera UUID v4 con `crypto.getRandomValues()`. **`crypto.randomUUID()` está prohibido por ESLint**, porque no existe por HTTP en la red local.
- **Proxy de desarrollo:** el front llama siempre a `/api/v1` (mismo origen). `npm run dev` reenvía `/api` a `http://localhost:8000` (`VITE_API_PROXY_TARGET` para cambiarlo, ver `.env.example`). Desde un móvil: `npm run dev -- --host` y abrir `http://<ip-del-portátil>:5173`.
- **Estado del servidor:** el chip _Servidor conectado / sin conexión_ de la cabecera (`ServerStatus`) consulta `GET /health` cada 15 s.

## Stack instalado (FE-01)

| Paquete                               | Versión   | Uso                                                                  |
| ------------------------------------- | --------- | -------------------------------------------------------------------- |
| `react`, `react-dom`                  | 18.3      | UI                                                                   |
| `react-router-dom`                    | 6.30      | Rutas (`createBrowserRouter`)                                        |
| `zustand`                             | 5         | Estado global (`src/store/`)                                         |
| `recharts`                            | 3         | Gráficas (`TrendChart`, FE-08)                                       |
| `framer-motion`                       | 14        | Animaciones y transiciones                                           |
| `idb`                                 | 8         | IndexedDB para el outbox offline (FE-11)                             |
| `vite` + `@vitejs/plugin-react`       | 6.4 + 4.7 | Bundler y dev server                                                 |
| `tailwindcss` + `@tailwindcss/vite`   | 4         | Estilos (sin `tailwind.config.js`: se configura en CSS con `@theme`) |
| `typescript`                          | 5.6       | Modo `strict`                                                        |
| `eslint` + `typescript-eslint`        | 9 + 8     | Lint (flat config en `eslint.config.js`)                             |
| `prettier` + `eslint-config-prettier` | 3 + 10    | Formato                                                              |

Notas:

- `@vitejs/plugin-react` está fijado a **v4** porque las versiones 5 y 6 piden Vite 7/8. Si se actualiza Vite, se actualizan los dos a la vez.
- **Local-first:** no hay fuentes ni recursos de CDN. Se usa la pila de fuentes del sistema (`src/styles/index.css`). Las fuentes, iconos o imágenes que se añadan van en `public/` o `src/`.
- Prettier (`.prettierrc.json`): sin punto y coma, comillas simples, `trailingComma: all`, 100 columnas.
- ESLint y Prettier ignoran `src/api/types.gen.ts` (es generado, no se edita a mano).

## Estructura

```
frontend/
├── index.html                 lang="es", favicon local
├── public/favicon.svg
├── vite.config.ts             React + Tailwind, puerto 5173, proxy /api → :8000, config de Vitest
├── scripts/gen-api.mjs        npm run gen:api (OpenAPI → src/api/types.gen.ts)
├── .env.example               VITE_API_PROXY_TARGET, VITE_API_ORIGIN
├── eslint.config.js  .prettierrc.json  .prettierignore
├── tsconfig.json              referencias a tsconfig.app.json (src/) y tsconfig.node.json (vite.config.ts)
└── src/
    ├── main.tsx               monta <App /> e importa los estilos
    ├── App.tsx                router con todas las rutas
    ├── styles/index.css       Tailwind + tema base (fondo oscuro, fuente del sistema)
    ├── environments/index.ts  lista PROVISIONAL de los 6 entornos (ver más abajo)
    ├── store/environment.ts   store Zustand con el entorno activo (envId)
    ├── api/
    │   ├── types.gen.ts       GENERADO (npm run gen:api): no editar
    │   ├── client.ts          cliente tipado, ApiError/NetworkError, configureApi, serverNow
    │   ├── newId.ts           UUID v4 sin contexto seguro
    │   ├── useServerHealth.ts hook de GET /health
    │   └── *.test.ts          tests (Vitest)
    ├── components/ui/
    │   ├── Layout.tsx         cabecera + navegación + <Outlet /> + disclaimer
    │   ├── EnvironmentSelector.tsx
    │   ├── ServerStatus.tsx   chip de conexión con el servidor
    │   └── PagePlaceholder.tsx
    └── pages/                 una página vacía por ruta
```

Carpetas que aún no existen y que crean sus issues: `api/mocks/` (FS-04), `offline/` (FE-11/FE-30) y `components/{body,dashboard,measure,alerts,behavioral,game}/`.

## Rutas

Todas cuelgan de `Layout`, que pinta la cabecera con el selector de entorno, la navegación y el pie con el disclaimer **"No es un dispositivo médico"**.

| Ruta         | Página              | La implementa |
| ------------ | ------------------- | ------------- |
| `/`          | `EnvironmentSelect` | FE-03         |
| `/dashboard` | `Dashboard`         | FE-07         |
| `/measure`   | `Measure`           | FE-10         |
| `/checkin`   | `CheckIn`           | FE-19         |
| `/history`   | `History`           | FE-09         |
| `/missions`  | `Missions`          | FE-18         |
| `/alerts`    | `Alerts`            | FE-14         |
| `/ground`    | `Ground`            | FE-16         |
| `*`          | `NotFound`          | —             |

Las páginas de FE-01 solo muestran un `PagePlaceholder` con el título y la issue que las completará.

## Provisional (lo sustituye FE-02)

- `src/environments/index.ts` tiene `PLACEHOLDER_ENVIRONMENTS` (slug + nombre) solo para que el selector funcione. La fuente de verdad es `backend/app/data/environments.json` (`GET /environments`); **no añadas aquí umbrales, vocabulario ni temas**.
- `useEnvironmentStore` guarda solo `envId` (empieza en `null`). FE-02 añade el `Environment` completo, el tema y el vocabulario.
- Los textos de la navegación son genéricos. Cuando una pantalla tenga que nombrar al member, el texto saldrá de `environment.vocabulary` y nunca será "astronauta" fijo.
