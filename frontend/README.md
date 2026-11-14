# frontend/ — app del member y consola /ground (React + Vite + TS)

Dueños: **Front A** y **Front B**. Scaffolding hecho en **FE-01** (#4); temas, store del entorno y vocabulario en **FE-02** (#19); selección de entorno y member en **FE-03** (#20); semáforo `StatusBadge` en **FE-04** (#21); cuerpo SVG `BodyFigure` en **FE-05** (#22); detalle `SystemPanel` en **FE-06** (#23); layout del dashboard en **FE-07** (#24); `TrendChart` con bandas de umbral en **FE-08** (#25); historial en **FE-09** (#40); formularios de medición en **FE-10** (#26); identidad de dispositivo e IndexedDB en **FE-30** (#74); outbox offline y sincronización en **FE-11** (#41); botón SOS / Pedir ayuda en **FE-13** (#43); login y sesión en **FE-27** (#68); permisos por rol en **FE-28** (#70); estado del enlace en la cabecera en **FE-17** (#47).

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

| Paquete                               | Versión   | Uso                                                                   |
| ------------------------------------- | --------- | --------------------------------------------------------------------- |
| `react`, `react-dom`                  | 18.3      | UI                                                                    |
| `react-router-dom`                    | 6.30      | Rutas (`createBrowserRouter`)                                         |
| `zustand`                             | 5         | Estado global (`src/store/`)                                          |
| `recharts`                            | 3         | Gráficas (`TrendChart`, FE-08)                                        |
| `framer-motion`                       | 14        | Animaciones y transiciones                                            |
| `idb`                                 | 8         | IndexedDB por dispositivo `ruok-<device_id>` (FE-30; outbox en FE-11) |
| `vite` + `@vitejs/plugin-react`       | 6.4 + 4.7 | Bundler y dev server                                                  |
| `tailwindcss` + `@tailwindcss/vite`   | 4         | Estilos (sin `tailwind.config.js`: se configura en CSS con `@theme`)  |
| `typescript`                          | 5.6       | Modo `strict`                                                         |
| `eslint` + `typescript-eslint`        | 9 + 8     | Lint (flat config en `eslint.config.js`)                              |
| `prettier` + `eslint-config-prettier` | 3 + 10    | Formato                                                               |

Notas:

- `@vitejs/plugin-react` está fijado a **v4** porque las versiones 5 y 6 piden Vite 7/8. Si se actualiza Vite, se actualizan los dos a la vez.
- **Local-first:** no hay fuentes ni recursos de CDN. Se usa la pila de fuentes del sistema (`src/styles/index.css`). Las fuentes, iconos o imágenes que se añadan van en `public/` o `src/`.
- Prettier (`.prettierrc.json`): sin punto y coma, comillas simples, `trailingComma: all`, 100 columnas.
- ESLint y Prettier ignoran `src/api/types.gen.ts` (es generado, no se edita a mano).

## Mocks: el front sin backend (FS-04)

| Modo                             | Cómo                                                                                         | Qué pasa                                                                                                                                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Real** (por defecto)           | `npm run dev`                                                                                | Llama al backend. Sin servidor: chip "sin conexión" y `NetworkError`; **nunca datos inventados**                                                                                                                                          |
| **Mock**                         | `VITE_USE_MOCKS=true npm run dev`, o `?mocks=1` en la URL (se recuerda; `?mocks=0` lo quita) | Todo el front funciona contra una API simulada en memoria. Banner amarillo **"DATOS DE EJEMPLO"**                                                                                                                                         |
| **Fallback** (plan B de la demo) | `VITE_MOCK_FALLBACK=true`                                                                    | Si el servidor no responde, **solo las lecturas** usan mocks y aparece el banner. **Las escrituras nunca se simulan**: lanzan `NetworkError`; el formulario conserva los datos para reintentar (guardado persistente en IndexedDB: FE-11) |

- **Datos:** `src/api/mocks/fixtures.gen.ts` lo genera `npm run gen:mocks`, que llama a cada endpoint del backend con su `TestClient`: el catálogo sale de los JSON reales (`backend/app/data/`) y el resto, mientras no esté implementado, de `backend/app/stubs.py`. Cada fixture lleva su tipo (`: Schema<'Assessment'>`), así que **si el contrato cambia y los mocks no encajan, `npm run build` falla**. No se edita a mano.
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
├── .env.example               VITE_API_PROXY_TARGET, VITE_API_ORIGIN, VITE_USE_MOCKS, VITE_MOCK_FALLBACK
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
    ├── offline/
    │   ├── device.ts          identidad del dispositivo: getDevice(), ?device=<nombre> (+ test)
    │   ├── db.ts              base IndexedDB ruok-<device_id> con los stores de data-model.md
    │   ├── outbox.ts          outbox + sincronizador: sendMeasurements(), syncNow(), useOutboxStore
    │   ├── backoff.ts         backoffMs(), classify(), isDue() (+ test)
    │   └── cache.ts           caché offline: withCatalogCache(), última evaluación, isUnavailable()
    ├── lib/time.ts            formatAgo(): "hace 12 min" con la hora del servidor (+ test)
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
    │   ├── useIndicators.ts   hook de GET /indicators (catálogo, una petición compartida)
    │   ├── useLoad.ts         carga genérica (loading / ready / error + retry, refresco en segundo plano)
    │   ├── useLink.ts         hook de GET /link?env= (estado del enlace)
    │   ├── useInterventions.ts hook de GET /interventions (caché offline)
    │   ├── useMeasurements.ts hook de GET /members/{id}/measurements (serie de N días)
    │   ├── mocks/             API simulada: mode.ts, handlers.ts, mockFetch.ts, events.ts,
    │   │                      useMockStatus.ts, fixtures.gen.ts (GENERADO por npm run gen:mocks)
    │   └── *.test.ts          tests (Vitest)
    ├── auth/                  session.ts (login, logout, kv.auth, 401), roles.ts (homeFor),
    │                          permissions.ts (matriz de acceso), useAuth.ts (+ tests)
    ├── components/auth/       RequireSession, RequireRole, SessionMenu
    ├── components/alerts/     SosButton, SosDialog + sos.ts (categorías, destinos, protocolo; + test)
    ├── components/body/       BodyFigure (SVG) + regions.ts (buildRegions, formatSinceLabel; + test)
    ├── components/dashboard/  SystemPanel, IndicatorCard, TrendChart + format.ts y trend.ts (+ tests)
    ├── components/measure/    IndicatorField + measureForm.ts (parseValue, emptyValue; + test)
    ├── components/environment/  EnvironmentCard (pintada con su propia paleta), MemberList
    ├── components/ui/
    │   ├── Layout.tsx         cabecera + navegación + <Outlet /> + disclaimer
    │   ├── EnvironmentSelector.tsx
    │   ├── ServerStatus.tsx   chip de conexión con el servidor
    │   ├── StatusBadge.tsx    semáforo: icono (forma + símbolo) + etiqueta
    │   ├── LinkStatusChip.tsx estado del enlace con tierra en la cabecera + link.ts (+ test)
    │   ├── PendingSyncChip.tsx "N pendientes de sincronizar" en la cabecera
    │   ├── status.ts          statusStyle(), livenessState(), STATUS_COLORS (+ status.test.ts)
    │   ├── MockBanner.tsx     banner obligatorio con datos de ejemplo
    │   └── PagePlaceholder.tsx
    └── pages/                 una página por ruta (CheckIn, Missions, Alerts y Ground aún son PagePlaceholder)
```

Carpetas que aún no existen y que crean sus issues: `components/{behavioral,game}/`. `offline/` tiene la identidad de dispositivo y la base IndexedDB (FE-30) y el outbox persistente con su sincronización (FE-11).

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

Las rutas `/checkin` (FE-19), `/missions` (FE-18), `/alerts` (FE-14) y `/ground` (FE-16) aún muestran un `PagePlaceholder` con la issue que las completará.

## Entorno activo (FE-02)

### Store (`src/store/environment.ts`)

`useEnvironmentStore` guarda `envId`, `memberId` y `vocabulary`, y se persiste en `localStorage` con la clave `ruok-session-<device_id>` (una sesión por dispositivo o pestaña, FE-30), así que sobrevive a una recarga también sin conexión.

- `selectEnvironment({ id, vocabulary })` cambia `envId` y `vocabulary` **a la vez** (nunca hay un vocabulario de otro entorno). Si el entorno cambia, pone `memberId` a `null`, porque cada entorno tiene sus propios members. Las claves que falten del vocabulario se rellenan con el término neutro.
- `selectMember(id)` elige el member (lo usa `MemberList` en FE-03).
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
- **Colores alineados con el backend:** `theme.primary` de `backend/app/data/environments.json` usa los mismos `primary` que `src/environments/themes/` (en `earth`, `#2bb3c9`, no verde). Si cambias uno, cambia el otro.

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

| `svg_region` | Dibujo                             | Sistema (`systems.json`) |
| ------------ | ---------------------------------- | ------------------------ |
| `brain`      | cerebro, en la cabeza              | neuro-conductual         |
| `eyes`       | los dos ojos                       | ojos (SANS)              |
| `heart`      | corazón, lado izquierdo del cuerpo | cardiovascular           |
| `immune`     | ganglios (cuello, axilas, ingles)  | inmune                   |
| `metabolic`  | abdomen                            | metabólico y nutrición   |
| `bones`      | huesos de brazos y piernas         | musculoesquelético       |
| `halo`       | halo punteado alrededor del cuerpo | radiación                |

- Los colores son los del semáforo (`STATUS_COLORS`). Un sistema sin evaluación es `unknown` (rayado gris), **nunca verde**.
- Con liveness `stale` o `lost`, **toda la figura** pasa a gris rayado y arriba aparece "Sin datos desde hace X min" (calculado con `serverNow()`, no con el reloj del dispositivo). El tooltip indica el último estado conocido.
- Cada región es un botón accesible (`role="button"`, `aria-label` con nombre y estado, Enter/Espacio) y muestra un tooltip al pasar el ratón o al enfocarla.
- Debajo hay una **leyenda clicable** con un `StatusBadge` por sistema: la misma información sin depender del color.
- Las regiones que no están en el catálogo de sistemas no se dibujan; un `svg_region` desconocido se ignora.
- Al seleccionar un sistema se abre el `SystemPanel` (FE-06).

## Detalle del sistema: `SystemPanel` (FE-06)

Se abre al hacer clic (o Enter) en una región de la figura o en la leyenda, y se cierra con **Esc**, con el botón ✕ o con un **clic fuera**. En escritorio es un panel lateral a la derecha; en móvil, una hoja desde abajo. Al abrirse, el foco va al botón de cerrar (`role="dialog"`, `aria-modal`).

Contenido:

- **Función** del sistema y, en entornos espaciales (`kind: space`), **efectos en el espacio** y **peligros** (los cinco de NASA HRP: radiación, aislamiento, distancia, gravedad y entorno hostil; `formatHazard()`).
- **Indicadores** de la evaluación: nombre (del catálogo `/indicators`), último valor con unidad (`formatValue()`: las escalas `1-5` salen como "3 / 5"), `StatusBadge`, tendencia con flecha y texto (`formatTrend()`) y antigüedad (`formatAgo()` con `serverNow()`; "Nunca medido" si no hay dato).
- **Recomendaciones** ordenadas por prioridad.
- Botón **"Medir ahora"** → `/measure?system=<id>` (formulario de FE-10).
- Con liveness `stale` o `lost`, los estados se muestran como "Sin datos recientes", igual que la figura.

## Dashboard (FE-07)

`/dashboard` (`src/pages/Dashboard.tsx`) muestra el panel del member activo (`memberId` del store). Sin member, enlaza a `/` para elegirlo.

- **Cabecera:** `StatusBadge` con el estado general (`overall_status`), el liveness si no es `active` ("Sin datos desde hace X min") y la frescura de los datos ("Actualizado hace…"). El estado del enlace está en la cabecera global (FE-17).
- **Izquierda:** `BodyFigure` (fija al hacer scroll en escritorio).
- **Derecha:** cuadrícula de `IndicatorCard` con todos los indicadores de la evaluación, **ordenados por gravedad** (`bySeverity`: crítico, atención, sin datos, normal). Clic en una tarjeta → `SystemPanel` de su sistema.
- En móvil, todo en una columna.

**Refresco cada 15 s.** `useAssessment(memberId, 15_000)` usa `useLoad({ refreshMs })`, que recarga en segundo plano sin volver al esqueleto de carga. Si un refresco falla, se mantienen los últimos datos y la cabecera avisa **"No se pudo actualizar: los datos pueden estar desfasados"** (nunca se finge que están al día).

`IndicatorCard` (`components/dashboard/`) es la tarjeta de un indicador (valor, semáforo, tendencia y antigüedad). La usan la cuadrícula y el `SystemPanel`; con `showTrend` añade la `TrendChart` (FE-08).

## Gráfica de tendencia: `TrendChart` (FE-08)

Serie temporal de un indicador con Recharts, dentro de cada `IndicatorCard` del `SystemPanel` (`showTrend`). En la cuadrícula del dashboard no se muestra, para no lanzar una petición por indicador cada 15 s.

- **Datos:** `useMeasurements(memberId, indicatorId, días)` → `GET /members/{id}/measurements?indicator_id=&from=`, con `from` calculado con la hora del servidor.
- **Periodo:** selector **7 d / 30 d** (`PeriodSwitch`).
- **Piezas:** `TrendPlot` es solo la gráfica (recibe los puntos); `TrendChart` la usa en las tarjetas cargando sus propios datos; el historial la usa con sus datos compartidos con la tabla.
- **Bandas:** `normal` y `warning` de `IndicatorAssessment.range` (ya ajustadas al entorno), como lavado suave (12 %) de los colores del semáforo. La zona fuera de las bandas queda sin sombrear.
- **Marcas** (especificaciones de `dataviz`): una sola serie y por tanto sin leyenda (el pie dice periodo y unidad); línea de 2 px en el color de texto del tema; puntos solo si hay 14 o menos; el último punto siempre marcado (r 4,5 con anillo del color de fondo); rejilla horizontal fina; ejes con texto `muted`.
- **Eje Y** (`yDomain()` y `yTicks()`): cubre datos y bandas con un 8 % de margen y marcas en números redondos (40, 60, 80…), para que las bandas se vean siempre enteras.
- **Tooltip** con línea vertical: fecha, hora y valor con unidad.
- **Accesibilidad:** la gráfica es `aria-hidden` y debajo hay una tabla desplegable **"Ver datos (N)"** con todas las mediciones.
- Estados de carga, error con reintento y "Sin mediciones en los últimos N días".

Verificado con una serie sintética de 30 días (interceptando la petición en Chrome), porque el seed de 30 días (BE-07) aún no existe: con el seed real debería verse igual.

## Historial (FE-09)

`/history` (`src/pages/History.tsx`):

- **Selector de indicador**: los indicadores activos del entorno (`Environment.indicators`), con su nombre del catálogo.
- **Selector de periodo**: 7 d / 30 d.
- El indicador y el periodo van en la URL: `/history?indicator=bp_systolic&days=30` (se puede enlazar directamente).
- **Gráfica** grande (`TrendPlot`) con las bandas del entorno: si el indicador está en la evaluación se usan sus rangos ajustados; si no, los del catálogo.
- **Tabla** con todas las mediciones del periodo, de la más reciente a la más antigua: fecha, valor con unidad, origen (`formatSource()`: manual, dispositivo, cámara, check-in, test PVT) y nota. En móvil la tabla hace scroll dentro de su caja.
- **Mediciones nuevas:** la serie se recarga cada 15 s en segundo plano, así que una medición nueva aparece sin recargar la página. Si el refresco falla, se avisa.

## Medición guiada (FE-10)

`/measure` (`src/pages/Measure.tsx`):

1. **Elegir qué medir:** tarjetas de los sistemas que tienen indicadores activos en el entorno.
2. **Formulario** con `?system=<id>` (lo usa "Medir ahora" del `SystemPanel`) o `?indicator=<id>`: un `IndicatorField` por indicador activo del entorno, con sus **pasos numerados** (`measurement_instructions`) y el campo generado a partir de `indicator.input`:

| `input.type` | Campo                                                                |
| ------------ | -------------------------------------------------------------------- |
| `number`     | campo numérico con la unidad; acepta coma decimal                    |
| `scale_1_5`  | 5 botones (`role="radio"`); pulsar el elegido lo quita               |
| `duration`   | horas + minutos, convertidos a la unidad del indicador (`h` o `min`) |

- **Validación** (`parseValue()`): rango `[min, max]` y paso (`step`) de `indicator.input`; los errores salen bajo el campo (`role="alert"`, `aria-invalid`). Los campos vacíos no se envían; hace falta al menos uno.
- **Un solo lote** por formulario: la tensión sistólica y la diastólica (y el resto del sistema) van juntas en `POST /members/{id}/measurements`, con un **UUID por medición** (`newId()`), `taken_at` = hora del servidor y `source: "manual"`, más la nota opcional.
- **Sin conexión no se pierde nada** (FE-11): el lote se guarda primero en el outbox del dispositivo. Si llega al servidor, se ve "N mediciones enviadas" con el estado general que devuelve; si no, "Medición guardada en el dispositivo", y se envía sola cuando vuelva la conexión, con los mismos UUID (sin duplicados).
- "Ver el panel" vuelve a `/dashboard`, que vuelve a pedir la evaluación.

## Dispositivo e IndexedDB (FE-30)

Cada dispositivo (o pestaña, en los ensayos) tiene su propia identidad, su base IndexedDB y su sesión. Detalle en [`docs/control-center-and-devices.md`](../docs/control-center-and-devices.md#4-identidad-de-dispositivo-y-aislamiento).

| URL                     | Dispositivo                                           | Se guarda en     |
| ----------------------- | ----------------------------------------------------- | ---------------- |
| (sin parámetro)         | el del navegador: UUID aleatorio generado una vez     | `localStorage`   |
| `?device=tablet-medico` | con nombre: UUID **determinista** a partir del nombre | `sessionStorage` |
| `?device=tab`           | uno nuevo para esta pestaña                           | `sessionStorage` |

- La pestaña recuerda su dispositivo al navegar o recargar sin el parámetro. En modo pestaña, el pie muestra "Dispositivo: tablet-medico".
- `getDevice()` (`src/offline/device.ts`) se resuelve **de forma síncrona** al arrancar, porque decide:
  - la cabecera **`X-Device-Id`** de todas las peticiones (`configureApi` en `main.tsx`);
  - la base IndexedDB **`ruok-<device_id>`** (`src/offline/db.ts`, librería `idb`), con los stores `outbox`, `measurements`, `assessments`, `catalog`, `alerts`, `tasks` y `kv` de `docs/data-model.md` (el `device_id` y el nombre se copian a `kv`);
  - la clave de la sesión de Zustand: **`ruok-session-<device_id>`**.
- El `device_id` es siempre un UUID (el back lo valida).
- Probado con dos pestañas `?device=a` y `?device=b`: ids, bases, sesión y outbox independientes.

- **Efectos conocidos:**
  - `?mocks=1` es **global** (se guarda en `localStorage` sin `device_id`): afecta a todas las pestañas, aunque tengan `?device=` distinto.
  - Cada pestaña abierta con `?device=tab` deja una base IndexedDB y una clave `ruok-session-<uuid>` que no se borran solas. Para limpiar tras los ensayos: DevTools → Application → Clear storage.

## Outbox offline y sincronización (FE-11)

**Toda escritura pasa por `src/offline/outbox.ts`** (CLAUDE.md, principio 4). Flujo (`docs/data-model.md` §2):

1. **Guardar primero** en la base del dispositivo: entrada en `outbox` (`status: pending`) y, para mediciones, cada una en `measurements` con `synced: false`. Aunque se cierre la app o no haya red, no se pierde.
2. **Enviar.** El sincronizador recorre el outbox por orden de creación y decide con `classify(status)`:

| Respuesta                  | Qué hace                                                                       |
| -------------------------- | ------------------------------------------------------------------------------ |
| 2xx (incluido "duplicado") | borra la entrada, marca las mediciones `synced`, guarda la evaluación devuelta |
| sin red, 408, 429, 5xx     | `attempts + 1` y reintento con **backoff** (2 s, 4 s, 8 s… tope 60 s)          |
| 401                        | **pausa** sin borrar nada; FE-27 pide login y llama a `resumeSync()`           |
| otro 4xx (p. ej. 409, 422) | `failed`: se conserva para revisarla y no se reintenta en bucle                |

3. **Cuándo se sincroniza:** al encolar, al arrancar, con el evento `online` y al volver a la pestaña (estos tres **sin esperar el backoff**), y cada 5 s si hay pendientes. `navigator.locks` evita envíos simultáneos desde dos pestañas del mismo dispositivo. Al arrancar, las entradas que se quedaron "enviando" (app cerrada a mitad) vuelven a `pending`.

- **API:** `sendMeasurements(memberId, mediciones)` → `{ status: 'sent', result }` si ya llegó o `{ status: 'queued' }` si queda pendiente. `syncNow(force?)`, `resumeSync()`. Estado en `useOutboxStore` (`pending`, `failed`, `syncing`, `paused`).
- **Cabecera:** `PendingSyncChip` muestra "⇡ N pendientes de sincronizar" (o "Sincronizando…", "N rechazadas"); pulsarlo fuerza un intento. Solo aparece si hay algo.
- **Caché offline** (`src/offline/cache.ts`): `environments`, `indicators` y `systems` se guardan en el store `catalog` en cada carga y se usan si el servidor no está; la última evaluación de cada member se guarda en `assessments` y, sin servidor, el dashboard la muestra con el aviso "No se pudo actualizar: los datos pueden estar desfasados" (`useLoad({ fallback })`). Aún no hay endpoint de protocolos; las intervenciones (FE-20) pueden usar `withCatalogCache('interventions', …)`.
- **"Sin servidor"** = error de red o 502/503/504 (`isUnavailable()`). En desarrollo, el proxy de Vite responde **503** cuando el backend está parado (`vite.config.ts`), en lugar de su 500 genérico.
- Un 401 o un cierre de sesión **nunca** borran el outbox.

**Probado** (criterio de aceptación): con el backend parado se registran 2 mediciones (temperatura y frecuencia cardiaca) → quedan en el outbox, sobreviven a una recarga y el panel se ve desde la caché → al arrancar el backend se sincronizan en 7 s; cada medición llega una sola vez (sin duplicados).

## Pedir ayuda / SOS (FE-13)

Botón rojo **"✚ Pedir ayuda"** fijo abajo a la derecha en todas las páginas (`SosButton` en `Layout`). Abre `SosDialog` (`role="dialog"`, Esc o clic fuera para cerrar):

- **¿Qué pasa?** `symptom` (síntoma), `physical` (malestar físico), `psychological` (**"Necesito hablar"**, canal confidencial: lo dice el diálogo) o `emergency`.
- **¿Cuánto urge?** `warning` (puede esperar), `critical` (urgente), `emergency`. Elegir "Emergencia" pone la severidad `emergency`.
- **¿A quién avisar?** La escalera del entorno sin `self`, por defecto el siguiente nivel y **se pueden saltar niveles**. Las etiquetas salen del vocabulario (`roleLabel()`: `nurse`/`caregiver` → `medic`, `doctor` → `ground`, `family` → "familia").
- **Mensaje** opcional (si no hay, se envía la categoría).

Se envía **por el outbox** (`sendAlert()`, mismo UUID en el dispositivo y en el servidor; la alerta se guarda en el store `alerts` con `pending=true`):

- **Con conexión:** "✓ Enviado a {destino}". Si el entorno tiene retardo: "le llegará en unos 14 min (hacia las HH:MM, hora del servidor)".
- **Sin conexión:** "**No enviado. Avisa a {tripulación} de viva voz**", la petición queda guardada y se envía sola al volver la conexión. Debajo, **"Mientras tanto"**, el protocolo que hay en el dispositivo:
  - los mensajes de escalado (`escalation.message`, primero los `autonomous`) de la **última evaluación guardada**; "Necesito hablar" solo muestra los del sistema neuro-conductual;
  - las **intervenciones offline** (`offline: true`) del catálogo en caché; para "Necesito hablar", las del sistema neuro-conductual (p. ej. respiración en caja).
- No hay textos clínicos en el código: todo el protocolo viene de la evaluación o del catálogo. **Falta un endpoint de protocolos** (`protocol_id` existe en la evaluación, pero no hay `GET /protocols`); cuando exista, se cachea con `withCatalogCache('protocols')`.
- Sin member elegido, el diálogo pide elegirlo y recuerda avisar de viva voz.

## Login y sesión (FE-27)

Diseño completo en [`docs/auth-and-roles.md`](../docs/auth-and-roles.md).

- **`/login`** (`src/pages/Login.tsx`), fuera del `Layout` pero **con el botón "Pedir ayuda"**:
  - usuario + **contraseña** (`POST /auth/login`) o pestaña **PIN rápido** (`POST /auth/pin`);
  - **usuarios demo** (`GET /auth/demo-users`) para entrar con un clic (PIN `1234`); la lista se reintenta cada 10 s si el servidor no responde;
  - errores: credenciales incorrectas, sin servidor (recuerda el SOS) y bloqueo por intentos (429).
- **Sesión** (`src/auth/session.ts`): `{token, user, exp}` en IndexedDB `kv.auth` y `kv.last_member_id` (para el SOS sin sesión). `initSession()` la recupera al arrancar y conecta el cliente: **`Authorization: Bearer`** en todas las peticiones.
- **Tras el login** se fija el entorno del usuario (y su `member_id` si es member), se reanuda el outbox (`resumeSync()`) y cada rol va a su **vista inicial** (`homeFor()`):

| Rol                  | Vista inicial                      |
| -------------------- | ---------------------------------- |
| `member`, `family`   | `/dashboard`                       |
| `medic`, `commander` | `/members` (members de su entorno) |
| `responder`, `psych` | `/ground`                          |
| `admin`              | `/` (selector de entorno)          |

- **Rutas protegidas:** `RequireSession` envuelve todo menos `/login`. Sin sesión → `/login?next=<ruta>`.
- **401 o `exp` vencido:** la sesión pasa a "caducada" y se va a `/login?expired=1` ("Tu sesión ha caducado… no se ha perdido nada"); al volver a entrar se regresa a la página donde se estaba. El outbox se pausa solo con el 401 (FE-11) y se reanuda tras el login.
- **"Salir"** (cabecera, `SessionMenu`) borra `kv.auth` pero **nunca el outbox**: lo pendiente se envía al volver a entrar.
- **SOS sin sesión:** usa `kv.last_member_id` y solo permite la categoría _emergencia_ (lo único que el back acepta sin token). Si el dispositivo nunca tuvo sesión, pide iniciarla y recuerda avisar de viva voz.
- **Para FE-15:** el modal "R U OK?" debe montarse también en `/login` (fuera del `Layout`), como el SOS.

## Permisos por rol (FE-28)

**Un solo sitio:** `src/auth/permissions.ts` es el espejo de la matriz de [`docs/auth-and-roles.md`](../docs/auth-and-roles.md#matriz-de-acceso-a-vistas). Si cambia la matriz, se cambia allí y aquí (y en el back). `permissions.test.ts` recorre la matriz completa rol a rol y comprueba que la vista inicial de cada rol está permitida (sin bucles de redirección).

```ts
const { user, role, can } = useAuth()
can('view:ground') // vistas: view:dashboard, view:measure, view:checkin, view:ground…
can('action:measure-others') // acciones: action:sos, action:change-environment, action:ack-alerts…
const memberId = useActiveMemberId() // un member: siempre el suyo; el resto: el elegido
```

- **Rutas:** cada ruta de `App.tsx` va envuelta en `<RequireRole>` con el permiso de `ROUTE_PERMISSIONS`. Una ruta prohibida **redirige a la vista inicial del rol** (`homeFor`).
- **Menú:** la navegación solo muestra las vistas permitidas (p. ej. el flight surgeon ve Historial, Alertas y su consola; el medic, además, "Tripulación"). El logo lleva a la vista inicial del rol.
- **Selector de entorno** de la cabecera y página `/`: solo `admin`.
- **"Medir ahora"** del `SystemPanel`: el member para sí mismo; medic y admin para cualquiera ("medir para otro solo medic").
- **SOS:** sin sesión, siempre visible. Con sesión, oculto para `responder` y `psych` (están en tierra).
- **Cabecera:** usuario y rol con el **vocabulario del entorno** (`userRoleLabel()`: astronauta, oficial médico, flight surgeon…; si no hay término, el `role_label` del servidor).
- El panel de demo y `/control` ya tienen permiso (`action:demo-panel`, `view:control`) para FE-31/FE-32.
- Ocultar en la UI **no es seguridad**: el back comprueba rol y propiedad en cada endpoint (BE-27).

## Estado del enlace en la cabecera (FE-17)

`LinkStatusChip` (en `Layout`) muestra el enlace simulado con el control externo en **todas las vistas** en cuanto hay un entorno: `useLink(envId, 5_000)` consulta `GET /link?env=` **cada 5 s**, así que cambia en vivo cuando alguien lo fuerza desde los controles de demo (`POST /demo/link`, FE-32). Cuando llegue el tiempo real (FE-29) se actualizará por eventos.

| Estado    | Icono | Texto                                                   |
| --------- | ----- | ------------------------------------------------------- |
| `online`  | ●     | Enlace con flight surgeon: en línea                     |
| `delayed` | ◐     | … con retardo · 14 min                                  |
| `los`     | ○     | … **sin enlace (LOS) desde las 14:02** (destacado)      |
| sin datos | ?     | … **estado desconocido** (nunca el último estado visto) |

- Se añaden los mensajes en cola: "· 2 en cola". La lógica está en `link.ts` (`describeLink()`, con tests).
- El otro extremo según quién mira: a bordo, "Enlace con {ground}"; para `responder` y `psych`, "Enlace con {crew}".
- En móvil se muestra en corto (icono + "14 min", "Sin enlace"…) y el texto completo va en el `title`.
- Sustituye al `LinkChip` que había en la cabecera del dashboard (FE-07).

## Pendiente

- **FE-26 / FE-34:**
  - a 390 px, con el selector de entorno (desde FE-28 solo lo ve el admin), el chip de servidor y el selector no caben y hay scroll horizontal;
  - el chip "Servidor conectado" usa verde fijo (se confunde con "normal") y hay colores fijos de Tailwind en `ServerStatus` e `IndicatorField`;
  - el dashboard muestra dos badges cuando `unknown` se debe a `stale`;
  - "actualizado hace X" usa el reloj del dispositivo en vez de `serverNow()`.
- **Protocolos:** `protocol_id` llega en la evaluación pero no existe `GET /protocols` (lo usa el SOS sin conexión, FE-13).
