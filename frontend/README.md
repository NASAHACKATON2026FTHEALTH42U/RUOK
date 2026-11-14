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
```

Antes de abrir una PR: `npm run lint && npm run build` (es lo que ejecuta el job `Frontend` de la CI).

> `npm run gen:api` (tipos desde el OpenAPI) llega con **FS-03** (#6) y `VITE_USE_MOCKS=true` con **FS-04** (#7).

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
├── vite.config.ts             React + Tailwind, puerto 5173
├── eslint.config.js  .prettierrc.json  .prettierignore
├── tsconfig.json              referencias a tsconfig.app.json (src/) y tsconfig.node.json (vite.config.ts)
└── src/
    ├── main.tsx               monta <App /> e importa los estilos
    ├── App.tsx                router con todas las rutas
    ├── styles/index.css       Tailwind + tema base (fondo oscuro, fuente del sistema)
    ├── environments/index.ts  lista PROVISIONAL de los 6 entornos (ver más abajo)
    ├── store/environment.ts   store Zustand con el entorno activo (envId)
    ├── components/ui/
    │   ├── Layout.tsx         cabecera + navegación + <Outlet /> + disclaimer
    │   ├── EnvironmentSelector.tsx
    │   └── PagePlaceholder.tsx
    └── pages/                 una página vacía por ruta
```

Carpetas que aún no existen y que crean sus issues: `api/` (FS-03/FS-04), `offline/` (FE-11) y `components/{body,dashboard,measure,alerts,behavioral,game}/`.

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
