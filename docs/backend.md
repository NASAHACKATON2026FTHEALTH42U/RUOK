# Backend: guía de desarrollo

> Guía práctica del servidor de a bordo (`backend/`). El diseño general está en [architecture.md](architecture.md), la API en [api-contract.md](api-contract.md) y las tablas en [data-model.md](data-model.md).
> **Actualiza este documento** cuando una issue de backend añada piezas base (módulos, convenciones, variables de entorno).

## Estado

| Issue | Qué aporta | Estado |
|---|---|---|
| BE-01 (#3) | FastAPI, `/health`, CORS, `X-Server-Time`, SQLite en WAL, reloj inyectable, tests | Hecho |
| FS-02 (#5) | Schemas Pydantic completos del contrato, routers stub de todos los endpoints, test de cobertura del contrato | Hecho |
| BE-02 (#8) | Modelos SQLModel de **todas** las tablas de [data-model.md](data-model.md) con sus índices, `app_state` y persistencia del reloj | Hecho |
| BE-08 (#15) | Motor de evaluación por indicador (`services/assessment.py`) | Hecho |
| BE-09 (#16) | Evaluación agregada por sistema y global (`services/assessment.py`) | Hecho |
| BE-03 (#9) | Perfiles de entorno en `app/data/environments.json`, loader validado y `GET /environments` reales | Hecho |
| BE-04 (#10) | Catálogo de 20 indicadores y 7 sistemas en JSON, validación cruzada y `GET /indicators`, `/systems` reales | Hecho |
| BE-10 (#17) | Tendencias, línea base personal (7 días) y regla de "3 días a peor" (`services/trends.py`) | Hecho |
| BE-11 (#18) | Composición del `Assessment` completo (`services/member_assessment.py`) | **Parcial:** el servicio está hecho, pero `GET /members/{id}/assessment` sigue en stub |
| FS-04 (#7) | `scripts/export_mocks.py`: mocks del front generados desde la API | Hecho |
| BE-06 (#13) | `POST` de mediciones por lotes (idempotente por UUID, atómico, 409) y `GET` con filtros | Hecho |
| BE-05 (#12) | Members de la BD: lista por entorno con resumen, detalle y privacidad guardada | Hecho (PR pendiente de merge) |

Estado global y lista de inconsistencias pendientes: [status.md](status.md).

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
│   ├── main.py           app FastAPI: lifespan (init_db, reloj, entornos y catálogo), CORS, X-Server-Time, /api/v1
│   ├── db.py             engine SQLite (WAL + foreign_keys), init_db(), get_session()
│   ├── clock.py          reloj inyectable: now(), advance(), set_offset(), get_offset(), reset()
│   ├── models.py         tablas SQLModel (15) e índices de data-model.md; tipo UTCDateTime
│   ├── data/
│   │   ├── environments.json  los 6 perfiles de entorno (BE-03)
│   │   ├── indicators.json    20 indicadores con rangos provisionales (BE-04)
│   │   └── systems.json       7 sistemas del cuerpo con su región del SVG (BE-04)
│   ├── services/
│   │   ├── app_state.py     clave-valor de app_state: get_value/set_value, save_clock/restore_clock
│   │   ├── assessment.py    motor de evaluación por indicador y por sistema (BE-08, BE-09)
│   │   ├── catalog.py       indicadores y sistemas: list_indicators(), get_indicator(), list_systems(), check_consistency()
│   │   ├── environments.py  carga y valida environments.json: list_environments(), get_environment()
│   │   ├── measurements.py  lotes idempotentes (save_batch), series (list_series), validación (BE-06)
│   │   ├── member_assessment.py  composición del Assessment completo de un member (BE-11; aún no lo usa el endpoint)
│   │   ├── members.py       members de la BD: get, list_by_env, set_privacy, to_summary; ensure_demo_members (STUB → BE-07)
│   │   └── trends.py        tendencia, línea base de 7 días y regla de 3 días a peor (BE-10)
│   ├── stubs.py          STUB(FS-02): datos de ejemplo de los routers stub (se van retirando)
│   ├── schemas/          modelos Pydantic del contrato, uno por dominio; se importan desde app.schemas
│   │   ├── common.py     enumeraciones (Status, Liveness, Role…), Slug, Range, ApiModel, ErrorResponse
│   │   ├── config.py     Environment, Indicator, BodySystem, Intervention
│   │   ├── auth.py       User, LoginIn, PinLoginIn, TokenResponse, DemoUser, UserCreate
│   │   ├── members.py    Member(Summary), Measurement*, Assessment, Heartbeat*, Ruok*
│   │   ├── alerts.py     Alert, AlertIn, AlertEvent, Escalate/Ack/Resolve/MessageIn, GroundView
│   │   ├── link.py       LinkStatus, LinkMessage
│   │   ├── game.py       Task, TaskCompleteIn, GameState, Badge, Leaderboard
│   │   └── realtime.py   Event, Device, ControlOverview, NetworkInfo, Demo*
│   └── routers/
│       ├── deps.py       Bearer opcional (stub de auth), cabecera X-Device-Id, respuestas de error
│       ├── health.py     GET /health
│       ├── auth.py       /auth/*, /users
│       ├── catalog.py    /environments, /indicators, /systems (reales), /interventions (stub)
│       ├── members.py    members y privacy (reales, BE-05), measurements (real, BE-06), assessment, heartbeat, ruok (stub)
│       ├── alerts.py     alertas del member, acciones sobre alertas, consola ground
│       ├── game.py       tareas, game, leaderboard
│       └── realtime.py   events (SSE), devices, control, system, link, demo (stub salvo /demo/fast-forward)
├── scripts/
│   └── export_mocks.py   genera frontend/src/api/mocks/fixtures.gen.ts (FS-04)
└── tests/
    ├── conftest.py       BD temporal, reset del reloj, fixture `client`
    ├── test_contract.py  FS-02: todo endpoint del contrato está en el OpenAPI (y viceversa) y su stub responde
    ├── test_health.py    /health, X-Server-Time, CORS, /docs
    ├── test_clock.py     reloj y fast-forward
    ├── test_db.py        WAL, foreign_keys y sesión
    ├── test_models.py    tablas, índices, crear/leer cada modelo, restricciones, fechas UTC, app_state
    ├── test_assessment.py   motor de evaluación por indicador (BE-08)
    ├── test_system_assessment.py  evaluación por sistema y global (BE-09)
    ├── test_trends.py       tendencias y línea base (BE-10)
    ├── test_member_assessment.py  composición del Assessment (BE-11)
    ├── test_environments.py perfiles vs docs/environments.md, JSON inválido, GET /environments y 404
    ├── test_catalog.py      indicadores y sistemas, coherencia, rangos con el motor, endpoints y 404
    ├── test_measurements.py idempotencia, 409, lote atómico, validación, filtros y orden del GET
    └── test_members.py      lista por entorno, detalle, privacidad persistida, 404 y 422
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
- `services.app_state.save_clock(session)` lo guarda. ⚠️ **Todavía no lo llaman ni `/demo/fast-forward` ni `/demo/reset`**: tras un reinicio se pierde el offset. Pendiente en BE-07 (ver [status.md](status.md));
- al arrancar, el `lifespan` llama a `restore_clock(session)` y lo recupera.

### Catálogos JSON (`app/data/`)

La configuración de dominio (entornos, indicadores, sistemas, intervenciones…) vive en JSON, **no en el código ni en la BD** (principio *Configuración, no código*). Las tablas la referencian por slug (`env_id`, `indicator_id`…).

| Fichero | Servicio | Issue |
|---|---|---|
| `environments.json` | `services/environments.py` | BE-03 |
| `indicators.json`, `systems.json` | `services/catalog.py` | BE-04 |
| `interventions.json` | — | BE-21 |

Cómo funciona `services/environments.py` (patrón que ya sigue `catalog.py`, de BE-04, y que debe seguir BE-21):
- `load_environments(path)` lee el fichero y lo valida con el schema del contrato (`TypeAdapter(list[Environment])`). `ApiModel` rechaza campos desconocidos, así que una errata en el JSON da error. También rechaza ids duplicados.
- `list_environments()` y `get_environment(env_id)` usan una caché en memoria (`lru_cache`): el fichero se lee una sola vez.
- El `lifespan` lo carga al arrancar: **si el JSON es inválido, el servidor no arranca** (mejor que fallar en mitad de la demo).
- Cambiar el JSON requiere reiniciar el servidor (`--reload` solo vigila los `.py`).

`services/catalog.py` sigue el mismo patrón y además hace una **validación cruzada** (`check_consistency`) al cargar. Falla si:
- el `system_id` de un indicador no existe en `systems.json`;
- un sistema lista un indicador que no existe o que pertenece a otro sistema;
- un indicador no aparece en la lista de ningún sistema;
- un entorno de `environments.json` usa un indicador que no está en el catálogo.

Los **rangos son provisionales** hasta CNT-01. Todos están en la tabla de umbrales de [sources.md](sources.md), con las reglas del motor (un valor más allá de la banda `warning` ya es `critical`).

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
- El `assessment` de la respuesta sigue siendo stub hasta **BE-11**; el evento `measurement.created` / `sync.batch` está marcado con `TODO(BE-28)`.

`GET /members/{id}/measurements?indicator_id=&from=&to=`: ordenado por `taken_at`; `from` y `to` son inclusivos; `from > to` → 422.

### Members (`services/members.py`)

| Endpoint | Qué devuelve |
|---|---|
| `GET /environments/{env_id}/members` | Los members del entorno (de la BD, por `id`) con su `MemberSummary`. 404 si el entorno no existe |
| `GET /members/{id}` | El `Member`. 404 si no existe |
| `PATCH /members/{id}/privacy` | Guarda `share_behavioral_details` y devuelve el member actualizado |

Qué es real y qué sigue siendo stub en el resumen:

| Campo | Origen | Lo sustituye |
|---|---|---|
| `id`, `env_id`, `name`, `position`, `share_behavioral_details`, `last_seen_at` | BD | — |
| `last_measurement_at` | BD (`max(taken_at)` de sus mediciones) | — |
| `liveness` | stub (`stubs.MEMBERS`; un member sin stub sale `stale`) | BE-12 |
| `overall_status` | stub (`stubs.member_summary`) | BE-11 |
| `open_alerts` | stub (`stubs.member_summary`) | BE-14 |

Para sustituir un stub, cambia **solo** `to_schema()` / `to_summary()` en `services/members.py`: los endpoints no cambian. La consola ground (`routers/alerts.py`) y el centro de control (`routers/realtime.py`) siguen usando `stubs.member_summary` hasta BE-17 y BE-30. El permiso de la privacidad (solo el propio member) llega con BE-27.

**Members de ejemplo (temporal):** las mediciones tienen FK a `member`, pero aún no hay seed. Al arrancar, `ensure_demo_members()` inserta los 3 members de `stubs.MEMBERS` si la tabla está vacía. Lo sustituye el seed de **BE-07**.

### Cabecera `X-Server-Time` y CORS (`app/main.py`)

- Un middleware añade `X-Server-Time` (hora de `clock.now()`, ISO-8601) a **todas** las respuestas, como pide [api-contract.md](api-contract.md).
- CORS abierto en desarrollo (`CORS_ORIGINS=*`). La cabecera `X-Server-Time` está en `expose_headers` para que el front la pueda leer.

## Motor de evaluación (BE-08 … BE-11)

- **Funciones puras** que reciben `now=clock.now()`, el catálogo y el entorno, y no tocan la BD. Son fáciles de testear.
- **Orden de gravedad:** `normal < unknown < warning < critical`. Un sistema toma el peor de sus indicadores; `unknown` nunca cuenta como `normal`.
- **Frescura:** un dato más antiguo que `indicator.max_age_s` pasa a `unknown`.
- **Ajustes por entorno:** `environment.threshold_overrides` se fusiona con los rangos del catálogo.
- **Escalado** (regla del contrato, [alerts-and-escalation.md](alerts-and-escalation.md#modo-de-escalado-según-el-retardo)):
  - `self` y `crew` (y sus equivalentes en tierra) se resuelven **a bordo**: `realtime`, `delay_s = 0`. ⚠️ El código actual aún les aplica el retardo del enlace (ver [status.md](status.md)).
  - Los niveles externos usan el retardo: `realtime` si es < 5 s, `delayed` en caso contrario, y `autonomous` si es ≥ 60 s **y** el estado es `critical`.
- **Liveness:** el `overall_status` debe ser el peor entre la salud y el liveness. ⚠️ Aún no se combina; llega con BE-12.

## Próximas piezas que afectan a la base

Decisiones ya documentadas que todavía no están implementadas. Tenlas en cuenta al tocar `main.py`, `db.py` o los modelos:

- **Red local (FS-08, #73):** para que se conecten los móviles, el servidor se arranca con `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000` y se abre el puerto (`sudo ufw allow 8000/tcp`). Ver [control-center-and-devices.md](control-center-and-devices.md). En la demo, FastAPI sirve `frontend/dist` (mismo origen, sin CORS).
- **Autenticación (BE-25/BE-26):** `Authorization: Bearer <jwt>` en todos los endpoints **salvo `/health`**, `/auth/*` y el SOS de emergencia. Código en `app/auth/` (`security.py`, `permissions.py`). Ver [auth-and-roles.md](auth-and-roles.md).
- **Dispositivo (BE-29):** todas las peticiones llevan `X-Device-Id`. El CORS actual ya acepta cualquier cabecera (`allow_headers=["*"]`).
- **Tiempo real (BE-28):** los cambios de estado se registran con `events.emit()` en la tabla `event_log` y se emiten por SSE (`/events/stream`).

## Routers stub (FS-02)

Todos los endpoints del contrato existen. **Reales:** `/health`, `/environments*`, `/indicators*`, `/systems`, members y privacidad (BE-05), `POST`/`GET /members/{id}/measurements` (BE-06) y `/demo/fast-forward` (a medias). **El resto** devuelve datos de ejemplo de `app/stubs.py` e indica en `description` qué issue lo implementa (`STUB(FS-02) → BE-06`). Tabla completa en [status.md](status.md#endpoints-reales-y-stubs).

> El assessment ya sale del motor real (BE-11). Los tests de escalado de `tests/test_contract.py` comprueban la regla del contrato. ⚠️ `test_assessment_mode_depends_on_environment` tiene un `TODO(BE-31)`: hoy acepta `autonomous` con 840 s para un escalado a `crew` (a bordo), que es el bug de BE-31 (#111). Hay que cambiarlo al arreglarlo.

**Al implementar tu issue:**
1. Sustituye el cuerpo del endpoint por la llamada a tu servicio (`app/services/…`). **No cambies la firma ni el `response_model`** sin cambiar antes el contrato.
2. Quita `STUB(FS-02) → …` de la `description`.
3. Borra de `app/stubs.py` lo que ya no se use.
4. `tests/test_contract.py` sigue pasando. Si cambias un endpoint del contrato, actualiza `CONTRACT_ENDPOINTS`.

**Defaults en los schemas:** `ApiModel` usa `json_schema_serialization_defaults_required=True`. En las **respuestas**, los campos con valor por defecto salen como obligatorios (siempre vienen); en las **peticiones** siguen siendo opcionales. El front genera los tipos con `--default-non-nullable false`, así que no obliga a enviar los valores por defecto (por ejemplo, `MeasurementIn.source`).

**Auth en los stubs:** `routers/deps.py` declara `Authorization: Bearer` (opcional) para que Swagger muestre el candado, pero **no valida nada** hasta BE-26 y BE-27. Los endpoints públicos (`/health`, `/auth/login`, `/auth/pin`, `/auth/demo-users`, `/system/network-info`) no lo declaran.

## Exportar mocks para el front (FS-04)

`uv run python scripts/export_mocks.py` (o `npm run gen:mocks` desde `frontend/`) llama a cada endpoint con el `TestClient` y genera `frontend/src/api/mocks/fixtures.gen.ts`. Hoy los datos salen de `app/stubs.py`. Cuando los endpoints sean reales, ejecútalo tras el seed (BE-07) para tener mocks con datos realistas. **Si añades un endpoint, el test de mocks del front exige un handler para él** (`frontend/src/api/mocks/handlers.ts`).

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
- La fixture `client` (`TestClient`) hace peticiones sin arrancar un servidor y ejecuta el `lifespan` (crea las tablas).
