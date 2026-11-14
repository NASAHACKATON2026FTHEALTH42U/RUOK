# Arquitectura

## Stack
| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 6 + TypeScript 5.6 (strict), Tailwind 4 (`@tailwindcss/vite`), React Router 6, Zustand 5, Recharts 3, Framer Motion, IndexedDB (`idb`). ESLint 9 + Prettier. Versiones y estructura en [`frontend/README.md`](../frontend/README.md) |
| Backend | Python 3.11+, FastAPI, SQLModel, SQLite (modo WAL), pytest |
| Contrato | OpenAPI generado por FastAPI → tipos TS con `openapi-typescript` |
| Ejecución | Local: `docker compose up` o dos terminales. FastAPI sirve `frontend/dist` en modo "a bordo", escuchando en `0.0.0.0` para que se conecten **móviles y tablets por la red local** ([control-center-and-devices.md](control-center-and-devices.md)) |
| Tiempo real | Server-Sent Events (`/events/stream`) + tabla `event_log` |

## Principio local-first
RUOK representa el **ordenador de a bordo**: toda la lógica y el conocimiento viven en local, y **nada depende de internet ni de la conexión con la Tierra**.
- En local están la base de datos, el motor de evaluación, los catálogos (indicadores, protocolos, intervenciones) y la gamificación.
- El enlace con la Tierra o el control externo es **simulado** (`services/comm_link.py`) con una cola persistente que funciona como store-and-forward, al estilo de las redes tolerantes a retardo (DTN). Ver [alerts-and-escalation.md](alerts-and-escalation.md).
- La consola de control externo (`/ground`) también es local: es otra vista del mismo front.
- **Multi-dispositivo:** cada usuario puede usar su móvil o tablet conectado al servidor por **wifi local sin internet**. El **centro de control** (`/control`, admin) ve en vivo todo el flujo de datos y gestiona la aplicación.
- **Sin HTTPS en la red local:** no se usan APIs que exigen contexto seguro (`crypto.randomUUID`, service workers, cámara). Los UUID se generan con `crypto.getRandomValues()`.
- No hay CDNs: fuentes, iconos e imágenes van empaquetados.
- Detalle de offline y liveness en [offline-and-liveness.md](offline-and-liveness.md).

```
 ┌──────────── A BORDO (local) ─────────────────────────────┐
 │                                                          │
 │  Tablet/portátil del member         Servidor de a bordo  │
 │  ┌──────────────────────┐   HTTP   ┌──────────────────┐  │
 │  │ React app            │ ───────▶ │ FastAPI          │  │
 │  │ IndexedDB outbox     │ ◀─────── │ assessment       │  │
 │  │ catálogo en caché    │          │ alerts / tasks   │  │
 │  └──────────────────────┘          │ SQLite (WAL)     │  │
 │                                    │ comm_link outbox │  │
 │                                    └────────┬─────────┘  │
 └─────────────────────────────────────────────┼────────────┘
                     enlace simulado (retardo, LOS)
                                               ▼
                                   ┌─────────────────────┐
                                   │ /ground (local)     │
                                   │ flight surgeon /    │
                                   │ enfermería          │
                                   └─────────────────────┘
```

## Estructura de carpetas
```
RUOK/
├── README.md  LICENSE  .gitignore  .editorconfig
├── docker-compose.yml          front + back en un comando
├── docs/                       esta documentación
├── scripts/github/             backlog.yaml + script de creación de issues
├── frontend/                   Vite + React + TS
│   ├── public/                 fondos de los entornos, imágenes de Earth view
│   └── src/
│       ├── main.tsx  App.tsx
│       ├── api/                client.ts, types.gen.ts (generado), mocks/
│       ├── offline/            outbox IndexedDB, sincronización, caché, device_id
│       ├── auth/               sesión, useAuth, permissions.ts, RequireRole
│       ├── realtime/           cliente SSE + fallback a polling
│       ├── environments/       temas y vocabulario de cada entorno
│       ├── store/              Zustand (entorno activo, member, estado del enlace)
│       ├── pages/              Login, EnvironmentSelect, Dashboard, Measure, History,
│       │                       Missions, Alerts, Ground, Control, CheckIn
│       ├── components/
│       │   ├── body/           BodyFigure, regiones SVG
│       │   ├── dashboard/      IndicatorCard, SystemPanel, TrendChart
│       │   ├── measure/        formularios guiados
│       │   ├── alerts/         SosButton, AlertTimeline, EtaCountdown
│       │   ├── behavioral/     CheckIn, InterventionCard, PvtTest
│       │   ├── game/           Missions, Streak, Badges, CrewBoard
│       │   └── ui/             StatusBadge, layout, controles comunes
│       └── styles/
├── backend/                    FastAPI + SQLModel + SQLite
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py  db.py  models.py  schemas.py  clock.py
│   │   ├── data/               environments.json, indicators.json, systems.json,
│   │   │                       interventions.json, protocols.json
│   │   ├── auth/               security.py (hash, JWT), permissions.py (matriz)
│   │   ├── services/           assessment.py, alerts.py, liveness.py, comm_link.py,
│   │   │                       gamification.py, routine.py, events.py (event_log + SSE), devices.py
│   │   ├── routers/            health, auth, environments, catalog, members, measurements,
│   │   │                       assessment, alerts, tasks, game, link, demo, events,
│   │   │                       devices, control, system
│   │   └── seed.py             datos sintéticos y escenarios de demo
│   └── tests/
└── presentation/               slides, vídeo y capturas
```

**Regla de trabajo:** cada persona trabaja sobre todo en su carpeta, para reducir los conflictos.

## Decisiones clave
| Decisión | Motivo |
|---|---|
| `members` genérico, y cada entorno con sus propios members | Mismo modelo para astronauta, paciente o residente; el texto visible sale de `environment.vocabulary` |
| `assessment?env=` opcional | Reevaluar los mismos datos con otro perfil, para mostrarlo en la demo |
| Check-in y PVT guardados como `measurements` | Reutilizan las gráficas, la evaluación, el modo offline y la caducidad sin tablas nuevas |
| `/control` separado de `/ground` | `/ground` es la vista médica realista (con retardo y privacidad); `/control` es la de operación (todo y al instante) |
| SSE en vez de WebSockets | Más simple, va por HTTP normal, reconecta solo y funciona en todos los navegadores móviles |
| IndexedDB por dispositivo (`ruok-<device_id>`) | Varios dispositivos o pestañas en la misma máquina no comparten sesión ni outbox |
| Reloj inyectable (`clock.py`) | Permite acelerar el tiempo en la demo (ETA del enlace, liveness) |
| Mocks en el front con la forma del contrato | El front avanza sin esperar al back y la demo sobrevive si el back cae |
| Mediciones *append-only* con UUID del cliente | La sincronización es idempotente y no hay conflictos |
