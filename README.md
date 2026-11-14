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
| Python | 3.12+ | ya incluido en Ubuntu 24.04 |
| [uv](https://docs.astral.sh/uv/) | reciente | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | 20 LTS | [nvm](https://github.com/nvm-sh/nvm): `nvm install 20` |
| gh (opcional) | reciente | ver `docs/team-and-schedule.md` |

## Arrancar en local
> Los comandos funcionan en cuanto estén mergeados BE-01 (#3) y FE-01 (#4).

**Backend**: API en http://localhost:8000/api/v1, Swagger en `/docs`.
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
uv run pytest            # tests
```

**Frontend**: http://localhost:5173
```bash
cd frontend
npm ci
npm run dev
npm run build            # comprueba los tipos y genera el build
npm run gen:api          # regenera los tipos desde el OpenAPI (con el back arrancado)
```
Para trabajar sin backend: `VITE_USE_MOCKS=true npm run dev`.

**Red local con móviles** (FS-08). Los móviles abren `http://<IP-del-portátil>:5173` en desarrollo, o `:8000` en modo a bordo:
```bash
sudo ufw allow 8000/tcp && sudo ufw allow 5173/tcp
cd backend  && uv run uvicorn app.main:app --host 0.0.0.0 --reload
cd frontend && npm run dev -- --host
```
Montaje de la red sin internet y checklist: [`docs/control-center-and-devices.md`](docs/control-center-and-devices.md).

**Todo junto (modo "a bordo", sin internet)**, disponible con BE-24:
```bash
docker compose up
```

> ⚠️ Prototipo de hackathon: **no es un dispositivo médico**.
