# Backend: guía de desarrollo

> Guía práctica del servidor de a bordo (`backend/`). El diseño general está en [architecture.md](architecture.md), la API en [api-contract.md](api-contract.md) y las tablas en [data-model.md](data-model.md).
> **Actualiza este documento** cuando una issue de backend añada piezas base (módulos, convenciones, variables de entorno).

## Estado

| Issue | Qué aporta | Estado |
|---|---|---|
| BE-01 (#3) | FastAPI, `/health`, CORS, `X-Server-Time`, SQLite en WAL, reloj inyectable, tests | Hecho (PR pendiente de merge) |
| BE-02 (#8) | Modelos SQLModel (tablas de [data-model.md](data-model.md)) | Pendiente |
| FS-02 (#5) | Schemas Pydantic completos del contrato | Pendiente |

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
│   ├── main.py           app FastAPI: lifespan (init_db), CORS, cabecera X-Server-Time, router /api/v1
│   ├── db.py             engine SQLite (WAL + foreign_keys), init_db(), get_session()
│   ├── clock.py          reloj inyectable: now(), advance(), set_offset(), get_offset(), reset()
│   ├── schemas.py        modelos Pydantic de la API (de momento solo HealthResponse)
│   └── routers/
│       └── health.py     GET /api/v1/health
└── tests/
    ├── conftest.py       BD temporal, reset del reloj, fixture `client`
    ├── test_health.py    /health, X-Server-Time, CORS, /docs
    ├── test_clock.py     reloj y fast-forward
    └── test_db.py        WAL, foreign_keys y sesión
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

`init_db()` crea las tablas de todos los modelos SQLModel importados. Los modelos llegan en BE-02; para que se creen, `app/models.py` tiene que importarse antes de `init_db()`.

### Reloj inyectable (`app/clock.py`)

**Usa siempre `clock.now()`, nunca `datetime.now()`.** La demo acelera el tiempo y todo el backend tiene que ver la misma hora.

| Función | Qué hace |
|---|---|
| `now()` | Hora actual en UTC (con zona) + desfase de la demo |
| `advance(seconds)` | Avanza el reloj (será `/demo/fast-forward`) |
| `set_offset(seconds)` / `get_offset()` | Fija o consulta el desfase |
| `reset()` | Vuelve al reloj real |

El desfase vive en memoria y se pierde al reiniciar. Su persistencia en `app_state.clock_offset_s` llega con BE-02.

### Cabecera `X-Server-Time` y CORS (`app/main.py`)

- Un middleware añade `X-Server-Time` (hora de `clock.now()`, ISO-8601) a **todas** las respuestas, como pide [api-contract.md](api-contract.md).
- CORS abierto en desarrollo (`CORS_ORIGINS=*`). La cabecera `X-Server-Time` está en `expose_headers` para que el front la pueda leer.

## Próximas piezas que afectan a la base

Decisiones ya documentadas que todavía no están implementadas. Tenlas en cuenta al tocar `main.py`, `db.py` o los modelos:

- **Red local (FS-08, #73):** para que se conecten los móviles, el servidor se arranca con `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000` y se abre el puerto (`sudo ufw allow 8000/tcp`). Ver [control-center-and-devices.md](control-center-and-devices.md). En la demo, FastAPI sirve `frontend/dist` (mismo origen, sin CORS).
- **Autenticación (BE-25/BE-26):** `Authorization: Bearer <jwt>` en todos los endpoints **salvo `/health`**, `/auth/*` y el SOS de emergencia. Código en `app/auth/` (`security.py`, `permissions.py`). Ver [auth-and-roles.md](auth-and-roles.md).
- **Dispositivo (BE-29):** todas las peticiones llevan `X-Device-Id`. El CORS actual ya acepta cualquier cabecera (`allow_headers=["*"]`).
- **Tiempo real (BE-28):** los cambios de estado se registran con `events.emit()` en la tabla `event_log` y se emiten por SSE (`/events/stream`).
- **Tablas nuevas para BE-02:** además de las originales, [data-model.md](data-model.md) incluye ahora `user_account`, `device` y `event_log`.

## Cómo añadir un endpoint

1. Primero el contrato: [api-contract.md](api-contract.md).
2. El schema en `app/schemas.py`.
3. Un router delgado en `app/routers/<dominio>.py` con `router = APIRouter(tags=["<dominio>"])`; la lógica va en `app/services/`.
4. Registrarlo en `app/main.py`: `api.include_router(<dominio>.router)`.
5. Tests en `backend/tests/` usando la fixture `client`.
6. `npm run gen:api` en el front y commitear `types.gen.ts`.

## Tests

- `conftest.py` apunta `DATABASE_URL` a una BD temporal **antes** de importar la app: los tests nunca tocan `ruok.db`.
- El reloj se resetea antes y después de cada test.
- La fixture `client` (`TestClient`) hace peticiones sin arrancar un servidor y ejecuta el `lifespan` (crea las tablas).
