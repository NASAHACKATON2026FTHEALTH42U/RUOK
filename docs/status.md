# Estado del proyecto

> Foto del **domingo 15/11, de madrugada**. Actualízala en cada hito (o pídeselo a Claude: "actualiza docs/status.md"). Fuente: GitHub Issues/PRs y revisión del código. El detalle de cada pieza está en [`backend.md`](backend.md) y [`frontend/README.md`](../frontend/README.md).

**79 de 83 issues cerradas.** El MVP está integrado: **todos los endpoints del contrato son reales** (ya no hay stubs) y el front cubre todas las vistas del guion de demo.

## Qué queda

| Issue | Estado | Qué falta |
|---|---|---|
| FE-24 #56 (kudos y misiones de tripulación) | **PR #197** en revisión, CI en verde | Mergear |
| FE-33 #81 (vistas móviles) | Auditoría a 375 px hecha y objetivos táctiles corregidos (**PR #198**) | Probar en Android Chrome e iOS Safari reales |
| FS-08 #73 (red local) | Scripts y docs hechos (`scripts/lan.sh`, `make lan`) | **Prueba física** con 2 móviles sin internet y anotar el resultado en la issue |
| CNT-04 #59 (pitch) | Guion en [`demo-script.md`](demo-script.md); borrador de slides | Vídeo de respaldo, ensayos y envío a Space Apps |

**Para la presentación:** revisar con alguien con criterio sanitario los textos marcados como *diseño* en [`sources.md`](sources.md) (protocolos, intervenciones) y verificar las citas marcadas como "de memoria" (S24, S28).

## Hecho

| Componente | Issues | Qué hay |
|---|---|---|
| ⚙️ Setup | FS-01, BE-01, FE-01, FS-05, BE-24 | Monorepo, **repo público con `main` protegida** (PR obligatoria y CI en verde), CI con 3 jobs, `make demo` y `docker compose up` (FastAPI sirve la API y el build del front en un puerto) |
| 📜 Contrato | FS-02, FS-03, FS-04 | Contrato en [`api-contract.md`](api-contract.md), schemas Pydantic, tipos TS generados (`npm run gen:api`), cliente tipado y **modo mock completo** (`?mocks=1`) generado desde la API real |
| 🗄️ BD | BE-02, BE-07 | 16 tablas SQLModel, SQLite en WAL, **seed determinista** de 30 días y escenarios de demo (`mars_sleep_bp`, `eva_no_contact`, `geriatric_fall_risk`) |
| 📚 Config | BE-03, BE-04, BE-33, BE-34, CNT-01, CNT-02, CNT-03 | Catálogos JSON validados al arrancar: entornos, indicadores, sistemas, protocolos, intervenciones, tipos de tarea, insignias. Umbrales y textos con fuente en [`sources.md`](sources.md) |
| 🌐 API | BE-05, BE-06 | Members y mediciones por lotes (idempotentes por UUID, atómicas) |
| 🧠 Motor | BE-08 … BE-11, BE-31 | Evaluación por indicador, sistema y global, tendencias, línea base y escalado según el retardo |
| 💓 Liveness | BE-12, BE-16, FE-15 | Heartbeat, `overall_status` = peor entre salud y liveness, check-in "R U OK?" y alerta `no_contact` |
| 🚨 Alertas | BE-14, BE-15, BE-17, BE-35, FE-13, FE-14, FE-16 | Alertas automáticas con deduplicación y escalera, SOS manual (también sin sesión), consola `/ground` as-of |
| 📡 Enlace | BE-13, BE-32, FE-17 | Enlace simulado con retardo y LOS (store-and-forward persistente), fast-forward con reloj persistente |
| 🔐 Auth | FS-06, BE-25 … BE-27, BE-36, FE-27, FE-28, FS-07 | Login local (usuario y contraseña), JWT, matriz de roles validada en el backend, gestión de usuarios en `/control` |
| 📶 Tiempo real | BE-28, BE-29, FE-29, FE-30 | Bitácora `event_log` + SSE, registro de dispositivos, IndexedDB por dispositivo |
| 🛰️ Control | BE-30, FE-31, FE-32 | Centro de control `/control`: panorama de entornos, eventos en vivo, dispositivos, demo y QR de red local |
| 📴 Offline | FE-11, FE-12 | Outbox persistente con sincronización y backoff; semáforo provisional sin conexión |
| 🎨 UI | FE-02 … FE-04, FE-26, FE-34 | Temas por entorno, vocabulario, `StatusBadge`, **estilo HUD** ([`design/hud-style.md`](design/hud-style.md)) |
| 🫀 Dashboard | FE-05 … FE-09 | Figura del cuerpo, anillo de sistemas, panel de sistema, tarjetas de indicador, tendencias e historial |
| 📝 Formularios | FE-10, FE-19, FE-22 | Medición guiada, check-in diario y test PVT |
| 🎮 Juego | BE-18, BE-19, BE-23, BE-37, FE-18 | Rutina diaria desde el perfil del entorno, puntos, racha, insignias, leaderboard cooperativo, kudos y misiones de grupo (backend) |
| 🧘 Conductual | BE-20, BE-21, BE-22, FE-20, FE-21, FE-23, FE-25 | Reglas frente a la línea base, privacidad de los detalles, intervenciones, "Mensaje a casa", meditación guiada con paisajes sonoros (FE-36, sustituye a la galería de la Tierra |

## Endpoints

Todos los del contrato son reales. `backend/app/stubs.py` solo queda como datos de apoyo para el exportador de mocks y algunos tests; **ningún router lo usa**. Swagger en `/docs`.

## Cómo comprobar el estado

```bash
make test                      # ruff + pytest del backend y lint + build + tests del front
gh issue list --state open     # lo que queda
gh pr list                     # lo que está en revisión
```
