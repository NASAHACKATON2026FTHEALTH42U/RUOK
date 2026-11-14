# RUOK — R U OK?

Biometría en tiempo real para astronautas, con aplicaciones duales en la sanidad terrestre.

Prototipo para el **NASA Space Apps Challenge 2026**, reto *Create Health Monitoring Software for Astronauts on Space Missions*.

- **Una plataforma, muchos entornos:** ISS, Luna, Marte… y también hospitales y residencias geriátricas.
- **Cuerpo humano clicable** con semáforo por sistema, mediciones guiadas, tendencias y gamificación cooperativa.
- **Local-first:** funciona sin internet, simula el enlace con la Tierra con su retardo real y no pierde datos.
- **Sin datos = desconocido:** heartbeat y check-in "R U OK?" para quien deja de responder.

📚 Documentación: [`docs/`](docs/README.md) · 🗂️ Backlog: [`docs/backlog.md`](docs/backlog.md) · 📋 [Kanban](https://github.com/orgs/NASAHACKATON2026FTHEALTH42U/projects/1) · 👥 Equipo: lee [`LEEME.txt`](LEEME.txt) antes del primer commit

## Estructura
```
backend/        FastAPI + SQLModel + SQLite (servidor de a bordo)
frontend/       React + Vite + TS (app del member y consola /ground)
docs/           documentación (contrato API, arquitectura, backlog…)
scripts/github/ backlog.yaml + creación de issues
presentation/   slides y capturas (los vídeos van al Drive)
```

## Requisitos
| Herramienta | Versión | Instalación (sin sudo) |
|---|---|---|
| Python | 3.11+ (la CI usa 3.12) | ya incluido en Ubuntu 24.04 |
| [uv](https://docs.astral.sh/uv/) | reciente | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | 20 LTS | [nvm](https://github.com/nvm-sh/nvm): `nvm install 20`, o el binario oficial de nodejs.org |
| gh (opcional) | reciente | ver "Herramientas" en [`CLAUDE.md`](CLAUDE.md) |

## Estado actual
Qué está hecho, qué endpoints son reales y qué queda: [`docs/status.md`](docs/status.md). Resumen: **el front ya tiene selección de entorno, dashboard con cuerpo y semáforo, historial y formularios de medición. En el backend son reales el catálogo (entornos, indicadores, sistemas) y el motor de evaluación como servicio, y el resto de endpoints aún devuelve datos de ejemplo (stubs).** Para ver la app completa hoy, usa el **modo mock** (`?mocks=1`).

## Arrancar en local
Usa **dos terminales**, una para el backend y otra para el frontend.

**Terminal 1, backend**: API en http://localhost:8000/api/v1, Swagger en http://localhost:8000/docs
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
uv run pytest && uv run --with ruff ruff check .   # tests + lint (igual que la CI)
```

**Terminal 2, frontend**: http://localhost:5173 (Vite reenvía `/api` al backend: sin CORS)
```bash
cd frontend
npm ci
npm run dev
npm run lint && npm run build && npm test           # igual que la CI
npm run gen:api       # tipos TS desde el OpenAPI (lee el código de FastAPI con uv; no hace falta el servidor)
npm run gen:mocks     # mocks del front desde las respuestas del backend
```

**Sin backend (modo demo):** abre http://localhost:5173/?mocks=1, o arranca con `VITE_USE_MOCKS=true npm run dev`. Aparece el banner "DATOS DE EJEMPLO". Detalles en [`frontend/README.md`](frontend/README.md).

**Red local con móviles** (FS-08). Los móviles abren `http://<IP-del-portátil>:5173` (desarrollo):
```bash
sudo ufw allow 8000/tcp && sudo ufw allow 5173/tcp
# terminal 1
cd backend  && uv run uvicorn app.main:app --host 0.0.0.0 --reload
# terminal 2
cd frontend && npm run dev -- --host
```
Montaje de la red sin internet y checklist: [`docs/control-center-and-devices.md`](docs/control-center-and-devices.md).

**Todo junto en un proceso (modo "a bordo")**: **pendiente de BE-24 (#39)**. FastAPI servirá el build del front y habrá `docker compose up`. Todavía no existe `docker-compose.yml`.

> ⚠️ Prototipo de hackathon: **no es un dispositivo médico**.
