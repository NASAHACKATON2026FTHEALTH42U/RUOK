# Arquitectura

## Stack
| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript, Tailwind, React Router, Zustand, Recharts, Framer Motion, IndexedDB (`idb`) |
| Backend | Python 3.11+, FastAPI, SQLModel, SQLite (modo WAL), pytest |
| Contrato | OpenAPI generado por FastAPI → tipos TS con `openapi-typescript` |
| Ejecución | Local: `docker compose up` o dos terminales. FastAPI sirve `frontend/dist` en modo "a bordo" |

## Principio local-first
RUOK representa el **ordenador de a bordo**: toda la lógica y el conocimiento viven en local, y **nada depende de internet ni de la conexión con la Tierra**.
- En local están la base de datos, el motor de evaluación, los catálogos (indicadores, protocolos, intervenciones) y la gamificación.
- El enlace con la Tierra o el control externo es **simulado** (`services/comm_link.py`) con una cola persistente que funciona como store-and-forward, al estilo de las redes tolerantes a retardo (DTN). Ver [alerts-and-escalation.md](alerts-and-escalation.md).
- La consola de control externo (`/ground`) también es local: es otra vista del mismo front.
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
│       ├── offline/            outbox IndexedDB, sincronización, caché del catálogo
│       ├── environments/       temas y vocabulario de cada entorno
│       ├── store/              Zustand (entorno activo, member, estado del enlace)
│       ├── pages/              EnvironmentSelect, Dashboard, Measure, History,
│       │                       Missions, Alerts, Ground, CheckIn
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
│   │   ├── services/           assessment.py, alerts.py, liveness.py,
│   │   │                       comm_link.py, gamification.py, routine.py
│   │   ├── routers/            health, environments, catalog, members, measurements,
│   │   │                       assessment, alerts, tasks, game, link, demo
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
| Reloj inyectable (`clock.py`) | Permite acelerar el tiempo en la demo (ETA del enlace, liveness) |
| Mocks en el front con la forma del contrato | El front avanza sin esperar al back y la demo sobrevive si el back cae |
| Mediciones *append-only* con UUID del cliente | La sincronización es idempotente y no hay conflictos |
