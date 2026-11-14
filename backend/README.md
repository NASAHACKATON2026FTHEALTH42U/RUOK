# backend/ — servidor de a bordo (FastAPI + SQLModel + SQLite)

Dueños: **Back A** y **Back B**. Contrato de la API: [`docs/api-contract.md`](../docs/api-contract.md).

## Comandos
```bash
cd backend
uv sync --all-extras --dev                 # instala dependencias (.venv)
uv run uvicorn app.main:app --reload       # API en http://localhost:8000/api/v1, Swagger en /docs
uv run pytest                              # tests
uv run --with ruff ruff check .            # lint (lo mismo que la CI)
```

## Variables de entorno
| Variable | Por defecto | Uso |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./ruok.db` | Base de datos SQLite (se abre en modo WAL y con `foreign_keys=ON`) |
| `CORS_ORIGINS` | `*` | Orígenes permitidos, separados por comas |

## Piezas base
- `app/clock.py`: reloj inyectable. Usa siempre `clock.now()`, nunca `datetime.now()`.
- `app/db.py`: engine de SQLite (WAL) y `get_session()` para `Depends`.
- Todas las respuestas llevan la cabecera `X-Server-Time` con la hora del reloj de la demo.

## Estructura objetivo
Ver [`docs/architecture.md`](../docs/architecture.md).
```
backend/
├── pyproject.toml
├── app/
│   ├── main.py  db.py  models.py  schemas.py  clock.py
│   ├── data/        environments.json, indicators.json, systems.json, interventions.json, protocols.json
│   ├── services/    assessment, alerts, liveness, comm_link, gamification, routine
│   ├── routers/     health, environments, catalog, members, measurements, assessment, alerts, tasks, game, link, demo
│   └── seed.py
└── tests/
```
