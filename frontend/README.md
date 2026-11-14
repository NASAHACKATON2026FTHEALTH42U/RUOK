# frontend/ — app del member y consola /ground (React + Vite + TS)

Dueños: **Front A** y **Front B**. Scaffolding hecho en **FE-01** (#4); temas, store del entorno y vocabulario en **FE-02** (#19); selección de entorno y member en **FE-03** (#20); semáforo `StatusBadge` en **FE-04** (#21); cuerpo SVG `BodyFigure` en **FE-05** (#22).

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
npm run gen:mocks      # regenera src/api/mocks/fixtures.gen.ts desde las respuestas del backend
npm test               # tests unitarios (Vitest)
npm run typecheck      # solo tsc -b
```

Antes de abrir una PR: `npm run lint && npm run build && npm test` (es lo que ejecuta el job `Frontend` de la CI). Si el backend cambió la API: `npm run gen:api` y commitea `types.gen.ts` (lo comprueba el job `Contrato API`).

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

## Mocks: el front sin backend (FS-04)

| Modo                             | Cómo                                                                                         | Qué pasa                                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real** (por defecto)           | `npm run dev`                                                                                | Llama al backend. Sin servidor: chip "sin conexión" y `NetworkError`; **nunca datos inventados**                                                                    |
| **Mock**                         | `VITE_USE_MOCKS=true npm run dev`, o `?mocks=1` en la URL (se recuerda; `?mocks=0` lo quita) | Todo el front funciona contra una API simulada en memoria. Banner amarillo **"DATOS DE EJEMPLO"**                                                                   |
| **Fallback** (plan B de la demo) | `VITE_MOCK_FALLBACK=true`                                                                    | Si el servidor no responde, **solo las lecturas** usan mocks y aparece el banner. **Las escrituras nunca se simulan**: lanzan `NetworkError` y el outbox las guarda |

- **Datos:** `src/api/mocks/fixtures.gen.ts` lo genera `npm run gen:mocks`, que llama a cada endpoint del backend con su `TestClient` (hoy, los stubs de `backend/app/stubs.py`). Cada fixture lleva su tipo (`: Schema<'Assessment'>`), así que **si el contrato cambia y los mocks no encajan, `npm run build` falla**. No se edita a mano.
- **Estado en memoria** (`handlers.ts`): las mediciones enviadas aparecen en el historial (idempotentes por UUID), los SOS se crean, escalan y resuelven, las tareas suman puntos, `/demo/link` y `/demo/fast-forward` funcionan. `POST /demo/reset` lo reinicia.
- **El assessment de ejemplo** tiene los 7 sistemas con los 4 estados (`normal`, `warning`, `critical`, `unknown`), y el modo de escalado cambia según el entorno (`?env=`).
- **Usuarios demo:** `vega` (member, Marte), `medic-mars`, `surgeon-mars` y `admin`, con cualquier contraseña.
- **Feed de eventos:** `EventSource` no pasa por `fetch`, así que en modo mock el cliente SSE (FE-29) usa `createMockEventStream(onEvent)` de `src/api/mocks/events.ts`.
- **Por qué no MSW:** necesita un service worker, que no existe por HTTP en la red local.
- **Cobertura:** `mocks.test.ts` exige un handler para **cada operación del OpenAPI** (`CONTRACT_OPERATIONS`). Si el backend añade un endpoint, regenera con `npm run gen:mocks` y añade su handler.

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
    ├── main.tsx               initTheme() + monta <App /> e importa los estilos
    ├── App.tsx                router con todas las rutas
    ├── styles/index.css       Tailwind, colores env-* (variables CSS) y fuente del sistema
    ├── environments/
    │   ├── format.ts          formato de gravedad, retardo y tipo (+ format.test.ts)
    │   ├── useVocab.ts        hook useVocab() + capitalize()
    │   ├── applyTheme.ts      initTheme(): aplica el tema del entorno activo en <html>
    │   └── themes/            un tema por entorno (iss.ts, mars.ts…) + defaultTheme.ts
    ├── store/environment.ts   store Zustand: envId, memberId, vocabulary (persistido)
    ├── api/
    │   ├── types.gen.ts       GENERADO (npm run gen:api): no editar
    │   ├── client.ts          cliente tipado, ApiError/NetworkError, configureApi, serverNow
    │   ├── newId.ts           UUID v4 sin contexto seguro
    │   ├── useServerHealth.ts hook de GET /health
    │   ├── useEnvironments.ts hook de GET /environments (una petición compartida, con reintento)
    │   ├── useMembers.ts      hook de GET /environments/{id}/members
    │   ├── useSystems.ts      hook de GET /systems (catálogo, una petición compartida)
    │   ├── useAssessment.ts   hook de GET /members/{id}/assessment
    │   ├── useLoad.ts         carga genérica (loading / ready / error + retry)
    │   ├── mocks/             API simulada: mode.ts, handlers.ts, mockFetch.ts, events.ts,
    │   │                      useMockStatus.ts, fixtures.gen.ts (GENERADO por npm run gen:mocks)
    │   └── *.test.ts          tests (Vitest)
    ├── components/body/       BodyFigure (SVG) + regions.ts (buildRegions, formatSinceLabel; + test)
    ├── components/environment/  EnvironmentCard (pintada con su propia paleta), MemberList
    ├── components/ui/
    │   ├── Layout.tsx         cabecera + navegación + <Outlet /> + disclaimer
    │   ├── EnvironmentSelector.tsx
    │   ├── ServerStatus.tsx   chip de conexión con el servidor
    │   ├── StatusBadge.tsx    semáforo: icono (forma + símbolo) + etiqueta
    │   ├── status.ts          statusStyle(), livenessState(), STATUS_COLORS (+ status.test.ts)
    │   ├── MockBanner.tsx     banner obligatorio con datos de ejemplo
    │   └── PagePlaceholder.tsx
    └── pages/                 una página vacía por ruta
```

Carpetas que aún no existen y que crean sus issues: `offline/` (FE-11/FE-30) y `components/{body,dashboard,measure,alerts,behavioral,game}/`.

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

## Entorno activo (FE-02)

### Store (`src/store/environment.ts`)

`useEnvironmentStore` guarda `envId`, `memberId` y `vocabulary`, y se persiste en `localStorage` (`ruok-session`), así que sobrevive a una recarga también sin conexión.

- `selectEnvironment({ id, vocabulary })` cambia `envId` y `vocabulary` **a la vez** (nunca hay un vocabulario de otro entorno). Si el entorno cambia, pone `memberId` a `null`, porque cada entorno tiene sus propios members. Las claves que falten del vocabulario se rellenan con el término neutro.
- `selectMember(id)` elige el member. Aún no lo usa nadie: la lista llega con `GET /environments/{id}/members` (FS-04 / BE-05).
- Sin entorno elegido, el vocabulario es neutro: `persona` / `equipo` / `control externo`.

### Textos: `useVocab()`

```tsx
const { member, crew, ground } = useVocab()
<h1>{capitalize(member)}: tu panel de salud</h1>   // "Astronauta: …", "Residente: …"
```

- Nunca escribas "astronauta" (ni paciente, residente…) fijo en un componente.
- No se generan plurales ni artículos en código. Redacta sin artículo ("Consola de {ground}"). Si hace falta un plural, se añade al contrato (`Environment.vocabulary`).

### Colores: temas por entorno

- Cada entorno tiene su tema en `src/environments/themes/<id>.ts`. Si falta, se usa `defaultTheme`.
- `initTheme()` (llamado en `main.tsx` antes del primer render) escribe los tokens como variables CSS en `<html>` (`--env-bg`…), además de `color-scheme` y `data-env`, y los actualiza al cambiar de entorno, con una transición de 300 ms.
- En los componentes se usan **solo** las clases `env-*`, nunca colores fijos de Tailwind (`slate`, `sky`…):

| Token         | Clase de ejemplo        | Uso                                            |
| ------------- | ----------------------- | ---------------------------------------------- |
| `bg`          | `bg-env-bg`             | Fondo de la app                                |
| `surface`     | `bg-env-surface`        | Tarjetas, cabecera, paneles                    |
| `border`      | `border-env-border`     | Bordes y separadores                           |
| `text`        | `text-env-text`         | Texto principal                                |
| `muted`       | `text-env-muted`        | Texto secundario                               |
| `primary`     | `bg-env-primary`        | **Solo relleno**: botones, enlace activo, foco |
| `primaryText` | `text-env-primary-text` | Texto encima de `primary`                      |

| Entorno     | Esquema | `bg`      | `surface` | `border`  | `text`    | `muted`   | `primary` | `primaryText` |
| ----------- | ------- | --------- | --------- | --------- | --------- | --------- | --------- | ------------- |
| default     | oscuro  | `#0f172a` | `#1e293b` | `#334155` | `#f1f5f9` | `#94a3b8` | `#38bdf8` | `#0f172a`     |
| `iss`       | oscuro  | `#0b1426` | `#14223d` | `#24395f` | `#e8f0ff` | `#9db0d3` | `#4d9fff` | `#0b1426`     |
| `moon`      | oscuro  | `#141518` | `#1f2125` | `#3a3d44` | `#ececf0` | `#a3a6ae` | `#c8ccd6` | `#141518`     |
| `mars`      | oscuro  | `#1a0d09` | `#2a1610` | `#4a2a1e` | `#f6e7df` | `#c9a99a` | `#c1440e` | `#ffffff`     |
| `earth`     | oscuro  | `#0b1a1f` | `#132a31` | `#24474f` | `#e3f4f7` | `#93b8c0` | `#2bb3c9` | `#0b1a1f`     |
| `hospital`  | claro   | `#d9e2ec` | `#e6edf4` | `#b3c2d3` | `#0f2133` | `#3d5063` | `#0b5a96` | `#ffffff`     |
| `geriatric` | claro   | `#e6dccb` | `#f0e8db` | `#c8b89e` | `#2b2118` | `#57493b` | `#6a429e` | `#ffffff`     |

Reglas:

- **Contraste WCAG**: texto y `muted` sobre `bg` y `surface` ≥ 4,5:1; `primary` sobre `bg` ≥ 3:1; `primaryText` sobre `primary` ≥ 4,5:1. Todas las paletas lo cumplen; si cambias un color, comprueba el contraste antes de hacer commit.
- **`primary` no se usa como color de texto**: en Marte (`#c1440e`, el del contrato) solo da 3,7:1 sobre el fondo.
- **El semáforo no depende del tema**: `normal`, `warning`, `critical` y `unknown` usan una paleta fija en todos los entornos (FE-04). Ningún `primary` es verde, para no confundirse con "normal".
- Para añadir un entorno: crea `themes/<id>.ts` y regístralo en `themes/index.ts`.

### Selección de entorno y member (FE-03)

`/` (`src/pages/EnvironmentSelect.tsx`) tiene dos pasos, con animaciones de Framer Motion (respetan `prefers-reduced-motion`):

1. **Entorno:** una `EnvironmentCard` por entorno de `GET /environments`, pintada con la paleta de ese entorno, con tipo, gravedad y retardo (`src/environments/format.ts`). Al elegir una, `selectEnvironment()` cambia ya el tema y los textos.
2. **Member:** `MemberList` con `GET /environments/{id}/members`. El puesto (`position`) solo se muestra si el vocabulario lo traduce (`vocabulary.commander` → "comandante"). Al elegir, `selectMember()` y se va a `/dashboard`.

El selector de la cabecera usa el mismo `useEnvironments()`: hay una sola petición compartida.

## Semáforo: `StatusBadge` (FE-04)

Úsalo **siempre** que se muestre un estado de salud o de liveness (members, sistemas, indicadores, /ground). No pintes estados con colores propios.

```tsx
<StatusBadge status={m.overall_status} />                 // normal | warning | critical | unknown
<StatusBadge status="stale" label="Sin datos desde hace 12 min" size="sm" />
const live = livenessState(m.liveness)                      // null si 'active'
```

| Estado     | Icono           | Color     | Etiqueta            | Rayado |
| ---------- | --------------- | --------- | ------------------- | ------ |
| `normal`   | círculo con ✓   | `#0ca30c` | Normal              | no     |
| `warning`  | triángulo con ! | `#fab219` | Atención            | no     |
| `critical` | octógono con ✕  | `#d03b3b` | Crítico             | no     |
| `unknown`  | círculo con ?   | `#898781` | Sin datos           | sí     |
| `stale`    | círculo con ?   | `#898781` | Sin datos recientes | sí     |
| `lost`     | señal tachada   | `#d03b3b` | Sin contacto        | sí     |

Reglas:

- **La paleta del semáforo es fija**: no depende del tema del entorno (`STATUS_COLORS` en `status.ts`).
- **Nunca solo color**: cada estado tiene forma, símbolo y etiqueta propios. Un test comprueba que se distinguen sin color.
- **`unknown`, `stale` y `lost` nunca son verdes** y llevan fondo rayado (lo comprueba `status.test.ts`).
- El color se usa en el icono, no en el texto: la etiqueta va en `text-env-text`.
- **Accesibilidad:** validada con el script de `dataviz` en las superficies de los 7 temas. La separación para daltonismo es ΔE ≥ 9. En los temas oscuros los 4 colores superan 3:1; en hospital y geriatría el verde y el ámbar bajan de 3:1, por eso la etiqueta es siempre visible y el icono lleva un contorno con el color de texto del tema.
- Si `overall_status` es `unknown` por un liveness `stale`, muestra solo el badge de liveness ("Sin datos recientes"), que explica el motivo (ver `MemberList`).

## Cuerpo: `BodyFigure` (FE-05)

Figura humana SVG con un color por sistema del cuerpo. Está en `/dashboard` cuando hay un member elegido.

```tsx
const regions = buildRegions(systems, assessment.systems)   // catálogo (svg_region) + evaluación (status)
<BodyFigure
  regions={regions}
  liveness={assessment.liveness}
  staleLabel={formatSinceLabel(assessment.last_seen_at, serverNow())}
  selectedSystemId={selected}
  onSelectSystem={setSelected}
/>
```

| `svg_region` | Dibujo                             | Sistema (stubs)        |
| ------------ | ---------------------------------- | ---------------------- |
| `brain`      | cerebro, en la cabeza              | neuro-conductual       |
| `eyes`       | los dos ojos                       | ojos (SANS)            |
| `heart`      | corazón, lado izquierdo del cuerpo | cardiovascular         |
| `immune`     | ganglios (cuello, axilas, ingles)  | inmune                 |
| `metabolic`  | abdomen                            | metabólico y nutrición |
| `bones`      | huesos de brazos y piernas         | musculoesquelético     |
| `halo`       | halo punteado alrededor del cuerpo | radiación              |

- Los colores son los del semáforo (`STATUS_COLORS`). Un sistema sin evaluación es `unknown` (rayado gris), **nunca verde**.
- Con liveness `stale` o `lost`, **toda la figura** pasa a gris rayado y arriba aparece "Sin datos desde hace X min" (calculado con `serverNow()`, no con el reloj del dispositivo). El tooltip indica el último estado conocido.
- Cada región es un botón accesible (`role="button"`, `aria-label` con nombre y estado, Enter/Espacio) y muestra un tooltip al pasar el ratón o al enfocarla.
- Debajo hay una **leyenda clicable** con un `StatusBadge` por sistema: la misma información sin depender del color.
- Las regiones que no están en el catálogo de sistemas no se dibujan; un `svg_region` desconocido se ignora.
- `TODO(FE-06)`: el sistema seleccionado abrirá el `SystemPanel`. `TODO(FE-07)`: layout completo del dashboard.

### Pendiente

- **Cabecera en móvil:** a 390 px el chip de servidor y el selector de entorno no caben y hay scroll horizontal (se arregla en FE-26).

- **TODO(FE-28):** `/` solo será accesible para el rol admin; el resto entra directamente en su entorno.
- **Colores del contrato alineados:** `theme.primary` de `backend/app/data/environments.json` (BE-03) usa los mismos `primary` que `src/environments/themes/` (en `earth`, `#2bb3c9`, no verde). Si cambias uno, cambia el otro.
