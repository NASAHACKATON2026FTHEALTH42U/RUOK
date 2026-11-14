# AGENTS.md — Instrucciones para agentes de IA (Claude, Codex, Copilot, Cursor…)

Este archivo aplica a **cualquier agente de IA** que trabaje en este repo. Las instrucciones específicas de Claude Code están en [`CLAUDE.md`](CLAUDE.md). Las reglas para humanos, en [`LEEME.txt`](LEEME.txt). Las tres dicen lo mismo; si hay contradicción, manda este archivo para los agentes.

## Proyecto
**RUOK (R U OK?)** es un prototipo para el NASA Space Apps Challenge 2026: una herramienta de autoevaluación de salud para astronautas que se adapta al entorno (ISS, Luna, Marte, Tierra, hospital, geriatría) y funciona 100 % en local.
- **Stack:** FastAPI + SQLModel + SQLite en `backend/`, y React + Vite + TS en `frontend/`.
- **Documentación:** [`docs/README.md`](docs/README.md).
- **Contrato de la API:** [`docs/api-contract.md`](docs/api-contract.md).

## 🚫 Regla de git obligatoria (protección de `main` por convención)
`main` **no está protegida técnicamente**: el repo es privado y GitHub Free no permite proteger ramas (HTTP 403). La protección depende de que humanos y agentes la respeten. **Un agente NUNCA debe:**
- hacer `commit` o `push` directo a `main`;
- hacer `push --force` a `main` ni borrarla;
- mergear una PR con la CI en rojo o pendiente, o sin aprobación humana;
- saltarse los hooks o los checks (`--no-verify`, desactivar jobs de la CI…).

**Flujo obligatorio para un agente:**
1. Partir de `main` actualizado y crear una rama `feat/<area>-<id>-<slug>` (por ejemplo `feat/be-08-assessment-engine`) o `fix/<slug>`.
2. Hacer commits pequeños con el ID de la issue (`BE-08: umbrales por entorno`).
3. Pasar en local lo mismo que la CI, antes de hacer push:
   - back: `cd backend && uv run pytest && uv run --with ruff ruff check .`
   - front: `cd frontend && npm run lint && npm run build`
   - si se ha tocado la API: `npm run gen:api` y commitear `types.gen.ts`.
4. Abrir una PR a `main` con `Closes #<n>`.
5. **El merge lo hace o lo aprueba un humano.**

## CI (`.github/workflows/ci.yml`)
Tres checks que tienen que estar en verde:
- `Backend (pytest)`
- `Frontend (lint + build)`
- `Contrato API (tipos TS al día)`

Si fallan, se arregla en la misma rama. No se desactivan ni se marcan como opcionales.

## Alcance del trabajo
- Trabaja **solo sobre la issue asignada** (`gh issue view <n>`) y lee el doc que enlaza. Respeta sus dependencias.
- Si descubres trabajo nuevo, propón una issue (editando `scripts/github/backlog.yaml`). No amplíes el alcance.
- Después del **freeze (domingo 11:00)**, solo bugs y pulido.
- No edites a mano `docs/backlog.md` ni `frontend/src/api/types.gen.ts`: son generados.

## Principios del producto (no negociables)
1. **El contrato manda:** primero `docs/api-contract.md`, después `app/schemas.py`, después `npm run gen:api`.
2. **Sin datos = desconocido:** `unknown`, `stale` y `lost` nunca se muestran en verde.
3. **Local-first:** nada de nube, CDNs ni internet en tiempo de ejecución.
4. **Sin pérdida de datos:** los `POST` llevan un UUID del cliente, son idempotentes y las escrituras del front pasan por el outbox.
5. **Configuración, no código:** umbrales, entornos y protocolos van en `backend/app/data/*.json`.
6. **Reloj inyectable:** `app/clock.py` (`now()`), nunca `datetime.now()`.
7. **Vocabulario por entorno:** nunca "astronauta" fijo en la UI.
8. **Login local y roles:** la autorización vive en el backend (`app/auth/permissions.py`) y el front solo la refleja. El SOS funciona sin sesión y un 401 nunca borra el outbox. Ver `docs/auth-and-roles.md`.
9. **Privacidad conductual** y **disclaimer** ("no es un dispositivo médico").

## Seguridad y datos
- No subas secretos, tokens ni `.env`.
- No metas datos personales reales: todo el seed es sintético.
- No añadas dependencias de servicios externos sin acordarlo en una issue.
