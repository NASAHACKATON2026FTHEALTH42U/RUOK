# Estado del proyecto

> Foto del **sábado 14/11, por la tarde**. Actualízala en cada hito (o pídeselo a Claude: "actualiza docs/status.md"). Fuente: GitHub Issues/PRs y revisión del código. El detalle de cada pieza está en [`backend.md`](backend.md) y [`frontend/README.md`](../frontend/README.md).

**23 de 75 issues cerradas.** Bloque 📜 Contrato y 🫀 Dashboard completos. **PRs abiertas:** #106 (BE-06, mediciones) y #107 (FE-11, outbox offline).

## Hecho

| Componente | Issues cerradas | Qué hay |
|---|---|---|
| ⚙️ Setup | FS-01, BE-01, FE-01 | Monorepo, FastAPI con `/health` y SQLite WAL, reloj inyectable, Vite + React + TS. **CI con 3 jobs funcionando** (FS-05 sigue abierta solo por la protección de `main`) |
| 📜 Contrato | FS-02, FS-03, FS-04 | Contrato v0 con 44 endpoints, schemas en `backend/app/schemas/`, tipos TS generados (`npm run gen:api`), cliente tipado, **modo mock completo** (`?mocks=1`) |
| 🗄️ BD | BE-02 | Las 15 tablas e índices de [`data-model.md`](data-model.md) |
| 📚 Config | BE-03, BE-04 | `environments.json`, `indicators.json` y `systems.json`, con validación cruzada. Endpoints **reales** |
| 🧠 Motor | BE-08, BE-09, BE-10 (+ BE-11 parte 1) | Evaluación por indicador, por sistema y global, tendencias y línea base, composición del `Assessment`. **Como servicio: el endpoint aún no lo usa** |
| 🔐 Auth | FS-06 | Diseño validado ([`auth-and-roles.md`](auth-and-roles.md)). Sin implementar |
| 🎨 UI | FE-02, FE-03, FE-04 | Temas por entorno, vocabulario (`useVocab`), selección de entorno y member, `StatusBadge` |
| 🫀 Dashboard | FE-05 … FE-09 | BodyFigure, SystemPanel, layout del dashboard, IndicatorCard y TrendChart, historial |
| 📝 Formularios | FE-10 | Formularios guiados de medición |
| 📴 Offline | FE-30 | `device_id` e IndexedDB `ruok-<device_id>` por dispositivo o pestaña |

## Endpoints: reales y stubs

| Real | Stub (datos de ejemplo de `backend/app/stubs.py`) |
|---|---|
| `GET /health` | auth y usuarios (BE-25, BE-26, FS-07) |
| `GET /environments`, `/environments/{id}` (BE-03) | members y privacidad (BE-05) |
| `GET /indicators`, `/indicators/{id}`, `/systems` (BE-04) | mediciones (BE-06, **PR #106 abierta**) |
| `POST /demo/fast-forward` (a medias: no persiste el reloj) | `GET /members/{id}/assessment` (BE-11: el servicio existe, falta conectarlo) |
| | heartbeat y R U OK (BE-12, BE-16) · alertas y consola ground (BE-14, BE-15, BE-17) |
| | tareas y juego (BE-18, BE-19) · intervenciones (BE-21) |
| | eventos SSE, dispositivos, control y network-info (BE-28, BE-29, BE-30) |
| | enlace y demo (BE-13, BE-07) |

**Consecuencia:** con el backend arrancado, el front muestra **el catálogo real y el resto de datos de ejemplo**. Para enseñar la app completa hoy, usa el **modo mock** (`?mocks=1`).

## P0 pendientes (ruta crítica)

| Issue | Estado |
|---|---|
| BE-11 #18 (assessment endpoint) | En curso (bryanfajardo2712-arch). Bloquea BE-12, BE-14 y BE-30 |
| BE-06 #13 (mediciones) | PR #106 abierta (confusedyeti03) |
| FE-11 #41 (outbox offline) | PR #107 abierta (front) |
| FE-27 #68 (login en el front) | Asignada al front, sin PR |
| BE-05 #12 (members), BE-07 #14 (seed), BE-25 #66 y BE-26 #67 (auth), BE-12 #33 (liveness), BE-13 #30 (enlace), BE-14 #31 (alertas), BE-28 #75 (eventos SSE) | **Sin asignar** |
| FS-05 #60 | CI hecha; falta proteger `main` (requiere repo público) |
| FS-08 #73 | Comandos documentados; **falta la prueba real con 2 móviles** |
| CNT-01 #11 | Tabla de umbrales provisional en [`sources.md`](sources.md); faltan las fuentes |

**Sin ninguna issue cerrada todavía:** 🌐 API, 🚨 Alertas, 📡 Enlace, 💓 Liveness, 🎮 Juego, 🧘 Conductual, 📶 Tiempo real, 🛰️ Control y 🎤 Pitch. La mayoría de las issues de front del Hito 2 están asignadas en bloque a xddaso y AlbertoSanzAlonso.

## Inconsistencias de código detectadas en la revisión

La revisión del 14/11 encontró estos problemas. Los docs ya describen el comportamiento correcto; el código todavía no. **P0 = hay que resolverlas antes que las issues que bloquean.**

| Prio | Problema | Issue | Bloquea a |
|---|---|---|---|
| **P0** | El escalado a `crew` (a bordo) sale con el retardo de tierra (840 s en Marte); debe ser `realtime` y 0 s | **#111 BE-31** | BE-14 |
| **P0** | Faltan umbrales en `environments.json`: `lost` en EVA, factor de sueño, check-in matinal, tiempo para escalar un warning persistente | **#112 BE-33** | BE-12, BE-14, BE-16 |
| **P0** | `Alert.target_role` y `delivery_mode` admiten null en la BD, pero el contrato los exige | **#113 BE-35** | BE-14 |
| **P0** | El stub del assessment contradice al motor y su test exige `autonomous` en un `warning` | tareas añadidas a **#18 BE-11** (en curso) | — |
| **P0** | El banner del fallback dice que lo registrado "se guarda para enviarlo" sin outbox persistente | tarea añadida a **#41 FE-11** (PR #107) | — |
| P1 | `/demo/fast-forward` y `/demo/reset` no persisten el reloj | #114 BE-32 | — |
| P1 | `threshold_overrides` con un indicador inexistente se ignora sin avisar; faltan textos de `vocabulary` para roles de la escalera | #115 BE-34 | FE-14 |
| P1 | Colores fijos, chip verde, doble badge, `serverNow()` en el dashboard, `getDb()` sin `catch` | #116 FE-34 | — |
| P0 | `overall_status` no combina salud y liveness; liveness por defecto `active` | tarea añadida a #33 BE-12 | — |
| P1 | Indicadores conductuales no activos en ningún entorno; privacidad de sus valores | tareas añadidas a #28 BE-20 | — |
| P1 | `X-Device-Id` mal formado da 422 incluso en un SOS | tarea añadida a #69 BE-27 | — |
