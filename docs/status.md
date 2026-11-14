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

## Inconsistencias de código detectadas en la revisión (pendientes de issue)

La revisión del 14/11 encontró estos problemas en el código. Los docs ya describen el comportamiento correcto; el código todavía no:

| Gravedad | Problema | Dónde | Issue que debería arreglarlo |
|---|---|---|---|
| Alta | El escalado a `crew` (a bordo) sale con el retardo de tierra (840 s en Marte); debe ser `realtime` y 0 s | `services/assessment.py` `build_escalation` | BE-11 / BE-14 |
| Alta | El stub del assessment contradice al motor (142 mmHg en Marte es `critical`, no `warning`) y su test exige `autonomous` en un `warning` | `stubs.py`, `tests/test_contract.py` | BE-11 (conectar el motor y borrar el stub) |
| Alta | El banner del modo fallback dice que lo registrado "se guarda para enviarlo", pero el outbox persistente aún no está en `main` | `MockBanner.tsx` | FE-11 (#107) |
| Media | `overall_status` no combina salud y liveness, y el liveness por defecto es `active` (debería ser "sin datos") | `services/member_assessment.py` | BE-12 |
| Media | `/demo/fast-forward` y `/demo/reset` no persisten el reloj | `routers/realtime.py` | BE-07 |
| Media | Faltan umbrales en `environments.json` (`lost` en EVA, factor de sueño, check-in matinal, tiempo para escalar un warning persistente) | `schemas/config.py`, `environments.json` | BE-12 / BE-14 / BE-16 |
| Media | `vocabulary` no tiene texto para roles de la escalera (`nurse`, `doctor`, `caregiver`, `family`) en hospital y geriatría | `environments.json` | BE-03 (ajuste) |
| Media | 9 indicadores conductuales no están activos en ningún entorno | `environments.json` | BE-20 |
| Media | `Alert.target_role` y `delivery_mode` admiten null en la BD, pero el contrato los exige | `models.py` | BE-14 |
| Media | `threshold_overrides` con un indicador inexistente se ignora sin avisar | `services/catalog.py` | BE-04 (ajuste) |
| Baja | Chip "Servidor conectado" en verde fijo (se confunde con "normal") y colores fijos de Tailwind | `ServerStatus.tsx`, `IndicatorField.tsx` | FE-26 |
| Baja | El dashboard muestra dos badges cuando `unknown` se debe a `stale` | `pages/Dashboard.tsx` | FE-26 |
| Baja | `formatAgo` con el reloj del dispositivo en vez de `serverNow()` | `pages/Dashboard.tsx`, `api/useLoad.ts` | FE-26 |
| Baja | `X-Device-Id` mal formado da 422 incluso en un SOS | `routers/deps.py` | BE-27 |
