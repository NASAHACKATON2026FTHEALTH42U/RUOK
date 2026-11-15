# Backend: guía de desarrollo

> Guía práctica del servidor de a bordo (`backend/`). El diseño general está en [architecture.md](architecture.md), la API en [api-contract.md](api-contract.md) y las tablas en [data-model.md](data-model.md).
> **Actualiza este documento** cuando una issue de backend añada piezas base (módulos, convenciones, variables de entorno).

## Estado

**Todos los endpoints del contrato son reales** y todas las issues de backend están cerradas. El desglose por issue está en [status.md](status.md) y en [backlog.md](backlog.md).

| Bloque | Dónde vive |
|---|---|
| Base (FastAPI, SQLite en WAL, reloj inyectable, modelos) | `app/main.py`, `app/db.py`, `app/clock.py`, `app/models.py` |
| Catálogos JSON validados al arrancar | `app/data/*.json` + `services/environments.py`, `catalog.py`, `routine.py`, `gamification.py`, `crew.py` |
| Motor de evaluación y tendencias | `services/assessment.py`, `trends.py`, `member_assessment.py`, `behavioral.py` |
| Mediciones y members | `services/measurements.py`, `members.py` |
| Liveness y "R U OK?" | `services/liveness.py`, `liveness_watch.py` |
| Alertas, escalado y consola ground | `services/alerts.py`, `ground.py` |
| Enlace simulado con tierra | `services/comm_link.py` (+ `home_messages.py`) |
| Login y roles | `app/auth/`, `services/accounts.py`, `routers/deps.py` |
| Tiempo real, dispositivos y centro de control | `services/events.py`, `devices.py`, `control.py`, `network.py` |
| Rutina y juego | `services/routine.py`, `gamification.py`, `crew.py` |
| Seed y escenarios de demo | `app/seed.py` |

## Arrancar

```bash
cd backend
uv sync --all-extras --dev                 # instala dependencias en .venv
uv run uvicorn app.main:app --reload       # API en http://localhost:8000/api/v1
uv run pytest                              # tests
uv run --with ruff ruff check .            # lint (igual que la CI)
```

- Swagger: <http://localhost:8000/docs>.
- Comprobación rápida: `curl -i localhost:8000/api/v1/health`.
- La base de datos `backend/ruok.db` se crea sola al arrancar. Está en `.gitignore` (también `-wal` y `-shm`).
- Si cambias la API (rutas, schemas o `description`), regenera los tipos del front: `cd frontend && npm ci && npm run gen:api`. Necesita **Node 20** (`mise use -g node@20` o `nvm install 20`). La CI falla si `types.gen.ts` no está al día.

### Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./ruok.db` | Ruta de la base de datos SQLite |
| `CORS_ORIGINS` | `*` | Orígenes permitidos, separados por comas |

## Estructura actual

```
backend/
├── pyproject.toml        dependencias (fastapi, uvicorn, sqlmodel, pydantic; dev: pytest, httpx, ruff)
├── uv.lock               versiones exactas (lo genera uv, no se edita a mano)
├── app/
│   ├── main.py           app FastAPI: lifespan (init_db, reloj, seed, validación de catálogos, vigilancia de
│   │                     liveness), CORS, X-Server-Time, /api/v1 y el build del front (modo "a bordo")
│   ├── db.py             engine SQLite (WAL + foreign_keys), init_db(), get_session()
│   ├── clock.py          reloj inyectable: now(), advance(), set_offset(), get_offset(), reset()
│   ├── models.py         tablas SQLModel (16) e índices de data-model.md; tipo UTCDateTime
│   ├── seed.py           seed determinista de 30 días, reset y escenarios de demo (BE-07, BE-37)
│   ├── stubs.py          datos de apoyo para export_mocks.py y algunos tests; ningún router lo usa
│   ├── auth/             security.py (JWT HS256 con el reloj de la demo) y permissions.py (matriz de roles)
│   ├── data/
│   │   ├── environments.json  los 6 perfiles de entorno (BE-03, BE-33)
│   │   ├── indicators.json    20 indicadores con rangos revisados en CNT-01 (BE-04)
│   │   ├── systems.json       7 sistemas del cuerpo con su región del SVG (BE-04)
│   │   ├── protocols.json     protocolos por sistema y estado y por categoría de alerta (CNT-02, CNT-03)
│   │   ├── interventions.json tarjetas de intervención con pasos y fuentes (BE-21, CNT-03)
│   │   ├── behavioral_rules.json  reglas conductuales frente a la línea base (BE-20)
│   │   ├── task_types.json    tipos de tarea de la rutina: título, momento del día, indicador (BE-18)
│   │   ├── badges.json        insignias y sus reglas (BE-19)
│   │   ├── crew_game.json     kudos y misiones de tripulación (BE-23)
│   │   └── home_message_replies.json  respuestas simuladas de "Mensaje a casa" (BE-22)
│   ├── services/
│   │   ├── app_state.py     clave-valor de app_state: get_value/set_value, save_clock/restore_clock
│   │   ├── environments.py  carga y valida environments.json
│   │   ├── catalog.py       indicadores, sistemas, intervenciones y protocolos; fuentes de docs/sources.md
│   │   ├── assessment.py    motor de evaluación por indicador y por sistema, escalado (BE-08, BE-09, BE-31)
│   │   ├── trends.py        tendencia, línea base de 7 días y regla de 3 días a peor (BE-10)
│   │   ├── member_assessment.py  composición del Assessment completo de un member (BE-11)
│   │   ├── behavioral.py    reglas conductuales y privacidad de los detalles (BE-20)
│   │   ├── measurements.py  lotes idempotentes (save_batch), series, validación y eventos (BE-06)
│   │   ├── members.py       members de la BD: get, list_by_env, set_privacy, to_summary
│   │   ├── liveness.py      liveness del member y combinación con la salud (BE-12)
│   │   ├── liveness_watch.py  check-in "R U OK?" y alerta no_contact (BE-16)
│   │   ├── alerts.py        alertas automáticas y manuales, deduplicación y escalera (BE-14, BE-15)
│   │   ├── ground.py        consola del responder: estado as-of y filtro de privacidad (BE-17)
│   │   ├── comm_link.py     enlace simulado: cola persistente, retardo y LOS (BE-13)
│   │   ├── home_messages.py "Mensaje a casa" por el enlace (BE-22)
│   │   ├── accounts.py      cuentas, contraseñas, PIN y usuarios de demo (BE-25, FS-07)
│   │   ├── events.py        bitácora event_log y bus SSE (BE-28)
│   │   ├── devices.py       registro de dispositivos (BE-29)
│   │   ├── control.py       panorama del centro de control y pausa del liveness (BE-30)
│   │   ├── network.py       IPs de la red local para el QR (BE-30)
│   │   ├── routine.py       tareas del día, completado idempotente y autocompletado (BE-18)
│   │   ├── gamification.py  puntos, racha, insignias y leaderboard cooperativo (BE-19)
│   │   └── crew.py          kudos y misiones de tripulación (BE-23)
│   ├── schemas/          modelos Pydantic del contrato, uno por dominio; se importan desde app.schemas
│   │   ├── common.py     enumeraciones (Status, Liveness, Role…), Slug, Range, ApiModel, ErrorResponse
│   │   ├── config.py     Environment, Indicator, BodySystem, Intervention y catálogos internos (Protocol, TaskType, BadgeDef)
│   │   ├── auth.py       User, LoginIn, PinLoginIn, TokenResponse, DemoUser, UserCreate
│   │   ├── members.py    Member(Summary), Measurement*, Assessment, Heartbeat*, Ruok*
│   │   ├── alerts.py     Alert, AlertIn, AlertEvent, Escalate/Ack/Resolve/MessageIn, GroundView
│   │   ├── link.py       LinkStatus, LinkMessage
│   │   ├── game.py       Task, GameState, Badge, Leaderboard, Kudos, CrewMission
│   │   ├── home.py       HomeMessage, HomeMessageIn
│   │   └── realtime.py   Event, Device, ControlOverview, NetworkInfo, Demo*
│   └── routers/
│       ├── deps.py       sesión (JWT), permisos por rol y ámbito (allow, allow_member, allow_env), X-Device-Id
│       ├── health.py     GET /health
│       ├── auth.py       /auth/*, /users
│       ├── catalog.py    /environments, /indicators, /systems, /interventions
│       ├── members.py    members, privacy, measurements, assessment, heartbeat, ruok
│       ├── alerts.py     alertas del member, acciones sobre alertas, consola ground
│       ├── game.py       tareas, game, leaderboard, kudos y misiones de tripulación
│       ├── home.py       "Mensaje a casa"
│       └── realtime.py   events (SSE), devices, control, system, link, demo
├── scripts/
│   └── export_mocks.py   genera frontend/src/api/mocks/fixtures.gen.ts (FS-04)
└── tests/                un test_<pieza>.py por servicio o endpoint (conftest.py: BD temporal, reset del reloj,
                          fixtures `client` con sesión de admin, `vega_auth`, `medic_auth`)
```

La estructura objetivo completa (services, data, seed…) está en [architecture.md](architecture.md#estructura-de-carpetas).

## Piezas base

### Base de datos: SQLite en modo WAL (`app/db.py`)

**WAL** (*Write-Ahead Logging*) es un modo del diario de SQLite. En lugar de modificar `ruok.db` directamente, las escrituras se añaden a `ruok.db-wal`, y un *checkpoint* las vuelca a la BD de vez en cuando.

- **Lecturas y una escritura a la vez:** el dashboard puede leer mientras llegan mediciones o el enlace encola mensajes, sin errores `database is locked`.
- **Robustez:** una transacción confirmada ya está en el WAL y se recupera si el proceso cae (principio de *sin pérdida de datos*).
- **Límites:** un solo escritor a la vez (suficiente aquí) y la BD tiene que estar en un disco local.

`make_engine()` ejecuta en **cada conexión** `PRAGMA journal_mode=WAL` y `PRAGMA foreign_keys=ON`. Este último es necesario porque SQLite no comprueba las claves foráneas si no se activa.

Uso en un endpoint (una sesión por petición):

```python
from fastapi import Depends
from sqlmodel import Session
from app.db import get_session

@router.get("/members")
def list_members(session: Session = Depends(get_session)):
    ...
```

`init_db()` importa `app/models.py` y crea las tablas e índices que falten (`create_all`: no borra ni altera tablas existentes). Si cambias una tabla que ya existe en tu `ruok.db`, bórrala (`rm backend/ruok.db*`) para que se vuelva a crear; no hay migraciones.

### Modelos (`app/models.py`)

Una clase `SQLModel` con `table=True` por cada tabla de [data-model.md](data-model.md) §1:

| Grupo | Modelos (tabla) |
|---|---|
| Usuarios y members | `Member` (member), `UserAccount` (user_account), `Device` (device) |
| Mediciones | `Measurement` (measurement) |
| Rutina y gamificación | `Task` (task), `TaskCompletion` (task_completion), `BadgeAward` (badge_award), `Kudos` (kudos) |
| Alertas y check-in | `Alert` (alert), `AlertEvent` (alert_event), `RuokCheck` (ruok_check) |
| Enlace simulado | `LinkMessage` (link_message), `LinkState` (link_state) |
| Tiempo real y técnico | `EventLog` (event_log), `AppState` (app_state) |

Convenciones:
- **Fechas:** `sa_type=UTCDateTime`. SQLite no guarda la zona horaria; este tipo convierte a UTC al guardar y devuelve fechas con `tzinfo=UTC` al leer. **Rechaza fechas sin zona** (`datetime(2026, 1, 1)`): usa `clock.now()`. Los valores por defecto usan `clock.now()`, así que respetan el fast-forward.
- **JSON:** `sa_type=JSON` (`Alert.indicator_ids`, `payload` de `AlertEvent`/`LinkMessage`/`EventLog`, `AppState.value`).
- **Enumeraciones como `str`:** `role`, `status`, `severity`… se guardan como texto (los valores válidos están comentados en cada campo). La validación va en los schemas de la API (FS-02), para no duplicar los enums.
- **PK:** UUID del cliente en `measurement`, `task_completion`, `alert`, `device` y `kudos` (idempotencia); id determinista en `task`; enteros autoincrementales en el resto.
- **Índices:** en `__table_args__`, con los nombres exactos de data-model.md. Los parciales usan `sqlite_where=text(...)`:
  - `ux_alert_open_dedupe`: como máximo una alerta no resuelta por `dedupe_key`;
  - `ux_user_member`: un member tiene como máximo un usuario;
  - `ix_ruok_member_pending`: check-ins sin respuesta.

**Añadir una tabla o columna:** primero en data-model.md, después en `models.py` (con su índice si lo tiene), un test en `test_models.py` y `rm backend/ruok.db*` en local.

### Reloj inyectable (`app/clock.py`)

**Usa siempre `clock.now()`, nunca `datetime.now()`.** La demo acelera el tiempo y todo el backend tiene que ver la misma hora.

| Función | Qué hace |
|---|---|
| `now()` | Hora actual en UTC (con zona) + desfase de la demo |
| `advance(seconds)` | Avanza el reloj (será `/demo/fast-forward`) |
| `set_offset(seconds)` / `get_offset()` | Fija o consulta el desfase |
| `reset()` | Vuelve al reloj real |

El desfase vive en memoria. Para que sobreviva a un reinicio se guarda en `app_state.clock_offset_s`:
- `services.app_state.save_clock(session)` lo guarda; lo llaman `/demo/fast-forward` y `/demo/reset` (BE-32);
- al arrancar, el `lifespan` llama a `restore_clock(session)` y lo recupera.

### Catálogos JSON (`app/data/`)

La configuración de dominio (entornos, indicadores, sistemas, intervenciones…) vive en JSON, **no en el código ni en la BD** (principio *Configuración, no código*). Las tablas la referencian por slug (`env_id`, `indicator_id`…).

| Fichero | Servicio | Issue |
|---|---|---|
| `environments.json` | `services/environments.py` | BE-03 |
| `indicators.json`, `systems.json` | `services/catalog.py` | BE-04 |
| `protocols.json` | `services/catalog.py` (`list_protocols`) | CNT-02 |
| `task_types.json` | `services/routine.py` | BE-18 |
| `badges.json` | `services/gamification.py` | BE-19 |
| `interventions.json` | `services/catalog.py` (`list_interventions`) | BE-21 |
| `behavioral_rules.json` | `services/behavioral.py` | BE-20 |
| `crew_game.json` | `services/crew.py` | BE-23 |
| `home_message_replies.json` | `services/home_messages.py` | BE-22 |

Cómo funciona `services/environments.py` (patrón que siguen todos los catálogos):
- `load_environments(path)` lee el fichero y lo valida con el schema del contrato (`TypeAdapter(list[Environment])`). `ApiModel` rechaza campos desconocidos, así que una errata en el JSON da error. También rechaza ids duplicados.
- `list_environments()` y `get_environment(env_id)` usan una caché en memoria (`lru_cache`): el fichero se lee una sola vez.
- El `lifespan` lo carga al arrancar: **si el JSON es inválido, el servidor no arranca** (mejor que fallar en mitad de la demo).
- Cambiar el JSON requiere reiniciar el servidor (`--reload` solo vigila los `.py`).

`services/catalog.py` sigue el mismo patrón y además hace una **validación cruzada** (`check_consistency`) al cargar. Falla si:
- el `system_id` de un indicador no existe en `systems.json`;
- un sistema lista un indicador que no existe o que pertenece a otro sistema;
- un indicador no aparece en la lista de ningún sistema;
- un entorno de `environments.json` usa un indicador que no está en el catálogo.

Los **rangos están revisados en CNT-01**, con una fuente por fila en la tabla de umbrales de [sources.md](sources.md#tabla-de-umbrales-cnt-01). Regla: el borde exterior de la banda `warning` coincide con el umbral crítico, para que no haya huecos; lo comprueba `test_no_gap_between_warning_and_critical`. Algunos valores son *diseño* (sin umbral clínico publicado) y están marcados así.

Si cambias `indicators.json` o `systems.json`, regenera los mocks del front (`cd frontend && npm run gen:mocks`) además de los tipos.

**Añadir o cambiar un indicador:** añádelo a `indicators.json` **y** a la lista `indicators` de su sistema en `systems.json`, actualiza la tabla de [sources.md](sources.md) y `EXPECTED_INDICATORS` en `tests/test_catalog.py`. Si es para un entorno, añádelo a su `indicators` en `environments.json`. Las regiones SVG (`svg_region`) tienen que coincidir con las de `BodyFigure` en el front.

**Añadir o cambiar un entorno:** edita `environments.json` siguiendo [environments.md](environments.md), actualiza la tabla de ese documento y `DOC_TABLE` en `tests/test_environments.py`, y pasa los tests. Los valores clínicos (`threshold_overrides`) se citan en [sources.md](sources.md).

### Mediciones (`services/measurements.py`)

Implementa el principio **sin pérdida de datos** ([offline-and-liveness.md](offline-and-liveness.md)). El front guarda cada medición en su outbox con un UUID y la reenvía hasta que el servidor confirma; el servidor tiene que aguantar reenvíos.

`POST /members/{id}/measurements` con `{measurements: [...]}`:

| Caso | Resultado |
|---|---|
| id nuevo | se guarda → cuenta en `accepted` |
| mismo id y mismo contenido (reintento) | no se duplica → cuenta en `duplicates` |
| mismo id con contenido distinto | **409**, no se guarda **nada** del lote |
| indicador desconocido, valor fuera de `input.min..max` o `taken_at` sin zona | **422**, no se guarda nada |
| member inexistente | **404** |

- **"Mismo contenido"** compara member, indicador, valor, `taken_at` (como instante UTC: `12:00+02:00` = `10:00Z`), `source` y `note`.
- **Lote atómico:** se valida todo antes de escribir y hay un solo `commit`. El cliente corrige y reenvía el lote entero.
- `unit` sale del catálogo y `received_at` del reloj del servidor (`clock.now()`).
- **Envíos simultáneos** del mismo lote (dos pestañas): si el `commit` choca con la PK, se reintenta una vez y esas mediciones pasan a `duplicates`.
- La respuesta trae el `assessment` real recalculado. Cada medición nueva emite `measurement.created` (o un solo `sync.batch` si el lote llega del outbox) y autocompleta las tareas de la rutina de ese indicador (BE-18).

`GET /members/{id}/measurements?indicator_id=&from=&to=`: ordenado por `taken_at`; `from` y `to` son inclusivos; `from > to` → 422.

### Members (`services/members.py`)

| Endpoint | Qué devuelve |
|---|---|
| `GET /environments/{env_id}/members` | Los members del entorno (de la BD, por `id`) con su `MemberSummary`. 404 si el entorno no existe |
| `GET /members/{id}` | El `Member`. 404 si no existe |
| `PATCH /members/{id}/privacy` | Guarda `share_behavioral_details` y devuelve el member actualizado |

De dónde sale cada campo del resumen (`to_summary()`):

| Campo | Origen |
|---|---|
| `id`, `env_id`, `name`, `position`, `share_behavioral_details`, `last_seen_at` | BD |
| `last_measurement_at` | BD (`max(taken_at)` de sus mediciones) |
| `liveness` | `services/liveness.py` (heartbeat, actividad y umbrales del entorno) |
| `overall_status` | El peor entre la salud (motor) y el liveness |
| `open_alerts` | Alertas sin resolver del member |

`PATCH …/privacy` solo lo puede hacer el propio member (BE-27). Los members salen del seed (`app/seed.py`), que se ejecuta al arrancar si la BD está vacía.

### Cabecera `X-Server-Time` y CORS (`app/main.py`)

- Un middleware añade `X-Server-Time` (hora de `clock.now()`, ISO-8601) a **todas** las respuestas, como pide [api-contract.md](api-contract.md).
- CORS abierto en desarrollo (`CORS_ORIGINS=*`). La cabecera `X-Server-Time` está en `expose_headers` para que el front la pueda leer.

## Motor de evaluación (BE-08 … BE-11)

- **Funciones puras** que reciben `now=clock.now()`, el catálogo y el entorno, y no tocan la BD. Son fáciles de testear.
- **Orden de gravedad:** `normal < unknown < warning < critical`. Un sistema toma el peor de sus indicadores; `unknown` nunca cuenta como `normal`.
- **Frescura:** un dato más antiguo que `indicator.max_age_s` pasa a `unknown`.
- **Ajustes por entorno:** `environment.threshold_overrides` se fusiona con los rangos del catálogo.
- **Escalado** (regla del contrato, [alerts-and-escalation.md](alerts-and-escalation.md#modo-de-escalado-según-el-retardo)):
  - `self` y `crew` (y sus equivalentes en tierra) se resuelven **a bordo**: `realtime`, `delay_s = 0`.
  - Los niveles externos usan el retardo: `realtime` si es < 5 s, `delayed` en caso contrario, y `autonomous` si es ≥ 60 s **y** el estado es `critical`.
- **Liveness:** el `overall_status` es el peor entre la salud y el liveness (`services/liveness.py`).

## Convenciones transversales

- **Autenticación y roles (BE-25 … BE-27):** `Authorization: Bearer <jwt>` en todos los endpoints salvo `/health`, `/auth/*`, `/system/network-info`, el catálogo de solo lectura y el SOS de emergencia. Los routers declaran el permiso con `allow(...)`, `allow_member(...)` o `allow_env(...)` de `routers/deps.py`; la matriz está en `app/auth/permissions.py`. La caducidad del token se mide con `clock.now()`. Ver [auth-and-roles.md](auth-and-roles.md).
- **Dispositivo (BE-29):** las peticiones llevan `X-Device-Id`; uno mal formado se ignora (no da 422, para no romper un SOS).
- **Tiempo real (BE-28):** todo cambio de estado se registra con `events.emit()` en la transacción del cambio y sale por SSE (`/events/stream`) al hacer commit.
- **Red local y modo "a bordo" (FS-08, BE-24):** `make demo` o `docker compose up` arrancan en `0.0.0.0:8000` y FastAPI sirve también `frontend/dist` (mismo origen, sin CORS). Ver [control-center-and-devices.md](control-center-and-devices.md).
- **Idempotencia:** todo `POST` que crea datos recibe un UUID del cliente; reenviarlo no duplica y el mismo UUID con otro contenido da 409.

## Contrato y routers

Todos los endpoints del contrato existen y son reales. `tests/test_contract.py` comprueba que el OpenAPI y `CONTRACT_ENDPOINTS` coinciden: si añades o cambias un endpoint, actualiza el contrato y esa lista. **No cambies la firma ni el `response_model`** de un endpoint sin cambiar antes [api-contract.md](api-contract.md).

**Defaults en los schemas:** `ApiModel` usa `json_schema_serialization_defaults_required=True`. En las **respuestas**, los campos con valor por defecto salen como obligatorios (siempre vienen); en las **peticiones** siguen siendo opcionales. El front genera los tipos con `--default-non-nullable false`, así que no obliga a enviar los valores por defecto (por ejemplo, `MeasurementIn.source`).

## Exportar mocks para el front (FS-04)

`uv run python scripts/export_mocks.py` (o `npm run gen:mocks` desde `frontend/`) llama a cada endpoint con el `TestClient` y genera `frontend/src/api/mocks/fixtures.gen.ts`. **Es determinista:** el reloj se congela en `FROZEN_NOW` (14/11 10:00 UTC), así que dos ejecuciones dan el mismo fichero y solo cambia cuando cambian los datos. Si una PR muestra cambios en `fixtures.gen.ts` sin haber tocado datos, algo usa la hora real en lugar de `clock.now()`. Los datos salen de los endpoints reales sobre el seed de demo. **Si añades un endpoint, el test de mocks del front exige un handler para él** (`frontend/src/api/mocks/handlers.ts`).

## Cómo añadir un endpoint

1. Primero el contrato: [api-contract.md](api-contract.md).
2. El schema en `app/schemas/<dominio>.py`, exportado en `app/schemas/__init__.py`.
3. Un router delgado en `app/routers/<dominio>.py` con `router = APIRouter(tags=["<dominio>"])`; la lógica va en `app/services/`.
4. Registrarlo en `app/main.py`: `api.include_router(<dominio>.router)`.
5. Tests en `backend/tests/` usando la fixture `client`.
6. `npm run gen:api` en el front y commitear `types.gen.ts`.

## Tests

- `conftest.py` apunta `DATABASE_URL` a una BD temporal **antes** de importar la app: los tests nunca tocan `ruok.db`.
- El reloj se resetea antes y después de cada test.
- La fixture `client` (`TestClient`) hace peticiones sin arrancar un servidor, ejecuta el `lifespan` (crea las tablas y el seed) y lleva sesión de **admin**; `vega_auth` y `medic_auth` dan cabeceras de otros roles.
