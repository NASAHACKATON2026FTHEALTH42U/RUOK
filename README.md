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
Qué está hecho y qué queda: [`docs/status.md`](docs/status.md). Resumen: **el MVP está integrado.** Todos los endpoints del contrato son reales (motor de evaluación, alertas y escalado, enlace simulado, liveness, login y roles, tiempo real, centro de control, rutina y juego) y el front cubre todas las vistas del guion de demo. Sin backend, la app completa se puede ver en **modo mock** (`?mocks=1`).

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

### Conectar un móvil (QR)
1. Portátil y móviles en **la misma wifi** (o el hotspot del portátil: `scripts/lan.sh hotspot`, plan B si la wifi del sitio aísla los dispositivos).
2. Abre el puerto: `sudo ufw allow 8000/tcp` (y `5173/tcp` en desarrollo).
3. Entra como operador → **Dispositivos**: el QR lleva a `http://<IP-del-portátil>:8000`. Escanéalo con la cámara del móvil e inicia sesión.
4. El puerto 8000 sirve el **build** del front (`frontend/dist`): tras cambiar el front, `cd frontend && npm run build` para que los móviles vean la versión nueva (recargando la página).
5. Si algo falla: `make lan` (IPs, puertos, firewall y `/health`). Los avisos en vivo usan un stream (SSE); si se corta, el móvil vuelve a intentarlo cada 30 s.

**Red local con móviles en desarrollo** (FS-08). Los móviles abren `http://<IP-del-portátil>:5173`:
```bash
sudo ufw allow 8000/tcp && sudo ufw allow 5173/tcp
# terminal 1
cd backend  && uv run uvicorn app.main:app --host 0.0.0.0 --reload
# terminal 2
cd frontend && npm run dev -- --host
```
Montaje de la red sin internet y checklist: [`docs/control-center-and-devices.md`](docs/control-center-and-devices.md).

**Todo junto en un proceso (modo "a bordo", BE-24).** FastAPI sirve la API y el build del front en el puerto 8000, escuchando en `0.0.0.0` para los móviles de la red local:
```bash
make demo            # instala, compila el front y arranca en http://localhost:8000
make lan             # diagnóstico de la red local: IPs, puertos, firewall y /health
make test            # lo mismo que la CI
```

### Docker
```bash
docker compose up --build          # app en http://localhost:8000 + LLM local (Ollama)
RUOK_LAN_HOST=192.168.8.10 docker compose up   # IP del portátil para el QR (dentro del contenedor no se ve)
OLLAMA_MODEL=llama3.2:3b docker compose up      # otro modelo
```
Tres servicios:
- **`ruok`**: API y front en el puerto 8000. La base de datos SQLite se guarda en el volumen `ruok-data`.
- **`ollama`**: el LLM local. Los modelos se guardan en el volumen `ollama-models`.
- **`ollama-pull`**: descarga el modelo **una vez**, con internet solo la primera vez. Después todo funciona sin conexión. Para usar una GPU de NVIDIA, descomenta el bloque `deploy` del servicio `ollama` en `docker-compose.yml`.

### LLM local («Mensaje a casa»)
Las respuestas de «Mensaje a casa» las da un **personaje según el entorno**: familiar en la ISS, pareja en la Luna, hermano en Marte, amigo en la Tierra, familia en el hospital e hija en la residencia.
- **Configuración** (`backend/app/data/chat_personas.json`): quién es, sus normas y las frases de desconcierto.
- **Variables:**

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `OLLAMA_URL` | sin definir: el LLM está desactivado | Dirección de Ollama, p. ej. `http://localhost:11434`. Se activa con Docker o a mano |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Modelo que se usa |
| `OLLAMA_TIMEOUT_S` | `25` | Tiempo máximo de espera de una respuesta |

- **Sin Docker:** `ollama serve`, luego `ollama pull qwen2.5:3b`, y arranca el backend con `OLLAMA_URL=http://localhost:11434`.
- **Barreras:** lo ajeno al contexto (código, datos generales, intentos de cambiar sus normas…) recibe una respuesta de desconcierto que reconduce, sin consultar al modelo. Las respuestas que se delatan como IA se descartan. Al modelo no se le pasa ningún dato de salud.
- **Si el modelo no está o tarda**, responde la frase guionizada de siempre: la app nunca depende de él.
- La respuesta llega con el **retardo del enlace** del entorno.
- **«Resumen de hoy» y «Resumen de la semana»** (`GET /members/{id}/summary`) se generan con los datos reales, sin LLM.

> ⚠️ Prototipo de hackathon: **no es un dispositivo médico**.
