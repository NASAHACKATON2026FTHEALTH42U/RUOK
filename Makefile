# R U OK? — comandos de arranque (BE-24).
#   make demo   → modo "a bordo": build del front + FastAPI sirviéndolo todo en :8000,
#                 escuchando en 0.0.0.0 para los móviles de la red local. Sin internet.
#   make dev    → desarrollo: backend con --reload y Vite (dos procesos).

PORT ?= 8000
HOST ?= 0.0.0.0

.PHONY: demo install build serve dev test docker

demo: install build serve

install:
	cd backend && uv sync
	cd frontend && npm ci --no-audit --no-fund

build:
	cd frontend && npm run build

serve:
	@echo "R U OK? en http://localhost:$(PORT)  (red local: http://<ip-de-este-equipo>:$(PORT))"
	cd backend && uv run uvicorn app.main:app --host $(HOST) --port $(PORT)

dev:
	cd backend && uv run uvicorn app.main:app --host $(HOST) --port $(PORT) --reload & \
	cd frontend && npm run dev -- --host

test:
	cd backend && uv run --with ruff ruff check . && uv run pytest -q
	cd frontend && npm run lint && npm run build && npm test

docker:
	docker compose up --build
