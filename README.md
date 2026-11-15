# RUOK — R U OK?

🌐 English · [Español](README.es.md)

Real-time biometrics for astronauts, with dual applications in healthcare on Earth.

Prototype for the **NASA Space Apps Challenge 2026**, challenge *Create Health Monitoring Software for Astronauts on Space Missions*.

- **One platform, many environments:** ISS, Moon, Mars… and also hospitals and nursing homes.
- **Clickable human body** with a traffic light per system, guided measurements, trends and cooperative gamification.
- **Local-first:** works without internet, simulates the Earth link with its real delay and never loses data.
- **No data = unknown:** heartbeat and an "R U OK?" check-in for anyone who stops responding.

📚 Documentation: [`docs/`](docs/README.md) · 🗂️ Backlog: [`docs/backlog.md`](docs/backlog.md) · 📋 [Kanban](https://github.com/orgs/NASAHACKATON2026FTHEALTH42U/projects/1) · 👥 Team: read [`LEEME.txt`](LEEME.txt) before your first commit

## Structure
```
backend/        FastAPI + SQLModel + SQLite (on-board server)
frontend/       React + Vite + TS (member app and /ground console)
docs/           documentation (API contract, architecture, backlog…)
scripts/github/ backlog.yaml + issue creation
presentation/   slides and screenshots (videos go to the Drive)
```

## Requirements
| Tool | Version | Installation (no sudo) |
|---|---|---|
| Python | 3.11+ (CI uses 3.12) | already included in Ubuntu 24.04 |
| [uv](https://docs.astral.sh/uv/) | recent | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | 20 LTS | [nvm](https://github.com/nvm-sh/nvm): `nvm install 20`, or the official binary from nodejs.org |
| gh (optional) | recent | see "Tools" in [`CLAUDE.md`](CLAUDE.md) |

## Current status
What is done and what remains: [`docs/status.md`](docs/status.md). In short: **the MVP is integrated.** All contract endpoints are real (assessment engine, alerts and escalation, simulated link, liveness, login and roles, real time, control center, routine and game) and the front end covers every view in the demo script. Without a backend, the whole app can be viewed in **mock mode** (`?mocks=1`).

## Run locally
Use **two terminals**, one for the backend and one for the frontend.

**Terminal 1, backend**: API at http://localhost:8000/api/v1, Swagger at http://localhost:8000/docs
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
uv run pytest && uv run --with ruff ruff check .   # tests + lint (same as CI)
```

**Terminal 2, frontend**: http://localhost:5173 (Vite proxies `/api` to the backend: no CORS)
```bash
cd frontend
npm ci
npm run dev
npm run lint && npm run build && npm test           # same as CI
npm run gen:api       # TS types from OpenAPI (reads the FastAPI code with uv; the server is not needed)
npm run gen:mocks     # front-end mocks from the backend responses
```

**Without a backend (demo mode):** open http://localhost:5173/?mocks=1, or start with `VITE_USE_MOCKS=true npm run dev`. The "SAMPLE DATA" banner appears. Details in [`frontend/README.md`](frontend/README.md).

### Connect a phone (QR)
1. Laptop and phones on **the same wifi** (or the laptop's hotspot: `scripts/lan.sh hotspot`, plan B if the venue's wifi isolates devices).
2. Open the port: `sudo ufw allow 8000/tcp` (and `5173/tcp` in development).
3. Log in as operator → **Devices**: the QR leads to `http://<laptop-IP>:8000`. Scan it with the phone camera and log in.
4. Port 8000 serves the front-end **build** (`frontend/dist`): after changing the front end, run `cd frontend && npm run build` so phones see the new version (reload the page).
5. If something fails: `make lan` (IPs, ports, firewall and `/health`). Live notifications use a stream (SSE); if it drops, the phone retries every 30 s.

**Local network with phones in development** (FS-08). Phones open `http://<laptop-IP>:5173`:
```bash
sudo ufw allow 8000/tcp && sudo ufw allow 5173/tcp
# terminal 1
cd backend  && uv run uvicorn app.main:app --host 0.0.0.0 --reload
# terminal 2
cd frontend && npm run dev -- --host
```
Setting up the network without internet and checklist: [`docs/control-center-and-devices.md`](docs/control-center-and-devices.md).

**Everything in one process ("on board" mode, BE-24).** FastAPI serves the API and the front-end build on port 8000, listening on `0.0.0.0` for phones on the local network:
```bash
make demo            # installs, builds the front end and starts at http://localhost:8000
make lan             # local network diagnostics: IPs, ports, firewall and /health
make test            # same as CI
```

### Docker
```bash
docker compose up --build          # app at http://localhost:8000 + local LLM (Ollama)
RUOK_LAN_HOST=192.168.8.10 docker compose up   # laptop IP for the QR (not visible from inside the container)
OLLAMA_MODEL=llama3.2:3b docker compose up      # another model
```
Three services:
- **`ruok`**: API and front end on port 8000. The SQLite database is stored in the `ruok-data` volume.
- **`ollama`**: the local LLM. Models are stored in the `ollama-models` volume.
- **`ollama-pull`**: downloads the model **once**, with internet only the first time. After that everything works offline. To use an NVIDIA GPU, uncomment the `deploy` block of the `ollama` service in `docker-compose.yml`.

### Local LLM ("Message home")
Replies in "Message home" are given by a **character that depends on the environment**: a relative on the ISS, a partner on the Moon, a brother on Mars, a friend on Earth, family in the hospital and a daughter in the nursing home.
- **Configuration** (`backend/app/data/chat_personas.json`): who the character is, their rules and the bewilderment phrases.
- **Variables:**

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_URL` | unset: the LLM is disabled | Ollama address, e.g. `http://localhost:11434`. Enabled with Docker or by hand |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Model to use |
| `OLLAMA_TIMEOUT_S` | `25` | Maximum time to wait for a reply |

- **Without Docker:** `ollama serve`, then `ollama pull qwen2.5:3b`, and start the backend with `OLLAMA_URL=http://localhost:11434`.
- **Guardrails:** anything outside the context (code, general knowledge, attempts to change its rules…) gets a bewildered reply that steers the conversation back, without querying the model. Replies that give themselves away as AI are discarded. No health data is passed to the model.
- **If the model is missing or slow**, the usual scripted phrase is returned: the app never depends on it.
- The reply arrives with the environment's **link delay**.
- **"Today's summary" and "Week's summary"** (`GET /members/{id}/summary`) are generated from real data, without an LLM.

> ⚠️ Hackathon prototype: **not a medical device**.
