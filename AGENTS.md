# AGENTS.md — Instrucciones para agentes de IA (Claude, Codex, Copilot, Cursor…)

Este archivo aplica a **cualquier agente de IA** que trabaje en este repo. Las instrucciones específicas de Claude Code están en [`CLAUDE.md`](CLAUDE.md). Las reglas para humanos, en [`LEEME.txt`](LEEME.txt). Las tres tienen que decir lo mismo: si cambias una regla, cámbiala en las tres. Si hay contradicción, manda este archivo para los agentes.

## Proyecto
**RUOK (R U OK?)** es un prototipo para el NASA Space Apps Challenge 2026: una herramienta de autoevaluación de salud para astronautas que se adapta al entorno (ISS, Luna, Marte, Tierra, hospital, geriatría) y funciona 100 % en local.
- **Stack:** FastAPI + SQLModel + SQLite en `backend/`, y React + Vite + TS en `frontend/`.
- **Documentación:** [`docs/README.md`](docs/README.md).
- **Contrato de la API:** [`docs/api-contract.md`](docs/api-contract.md).

## 🚫 Regla de git obligatoria (`main` está protegida)
`main` **tiene protección de rama** en GitHub (repo público desde el 15/11): todo entra por PR y solo se mergea con los 3 checks de la CI en verde. Aun así, **un agente NUNCA debe:**
- hacer `commit` o `push` directo a `main`;
- hacer `push --force` a `main` ni borrarla;
- mergear una PR con la CI en rojo o pendiente, o sin aprobación humana;
- saltarse los hooks o los checks (`--no-verify`, desactivar jobs de la CI…).

**Flujo obligatorio para un agente:**
1. Partir de `main` actualizado y crear una rama `feat/<area>-<id>-<slug>` (por ejemplo `feat/be-08-assessment-engine`) o `fix/<slug>`.
2. Hacer commits pequeños con el ID de la issue (`BE-08: umbrales por entorno`).
3. Pasar en local lo mismo que la CI, antes de hacer push:
   - back: `cd backend && uv run pytest && uv run --with ruff ruff check .`
   - front: `cd frontend && npm run lint && npm run build && npm test`
   - si se ha tocado la API: `npm run gen:api` y `npm run gen:mocks`, y commitear `types.gen.ts` y `fixtures.gen.ts`.
4. **Antes de abrir la PR, sincronizar con `main`:** `git fetch origin && git merge origin/main`, resolver los conflictos en local y volver a pasar el paso 3.
5. Abrir una PR a `main` con `Closes #<n>`.
6. **El merge lo hace o lo aprueba un humano.** Si `main` ha avanzado desde la PR, el agente repite el paso 4 antes de pedir el merge.

### Evitar conflictos (reglas para agentes)
- **PRs pequeñas y de vida corta.** Una issue = una rama = una PR. No acumular trabajo de varias issues en la misma rama.
- **Nunca subir commits a la rama de una PR ya mergeada.** Antes de cada push, comprobar `gh pr view <n> --json state`. Si está `MERGED`, crear una rama nueva desde `main` actualizado.
- **No apilar PRs.** Si una issue depende de otra que aún no está en `main`, esperar o avisar al humano. Si se apila, dejarlo indicado en la descripción ("mergear después de #X").
- **Ficheros generados en conflicto** (`frontend/src/api/types.gen.ts`, `frontend/src/api/mocks/fixtures.gen.ts`, `package-lock.json`, `uv.lock`): no se editan a mano. Se acepta cualquier versión y se regenera (`npm run gen:api`, `npm run gen:mocks`, `npm install`, `uv lock`).
- **Tras resolver un conflicto,** pasar todos los tests de back y front y revisar que la resolución no reintroduce algo ya corregido en `main` (por ejemplo, valores del contrato o de configuración).
- **En la rama de otra persona,** resolver solo si el humano lo pide y dejar un comentario en la PR explicando los cambios.

## CI (`.github/workflows/ci.yml`)
Tres checks que tienen que estar en verde:
- `Backend (pytest)`
- `Frontend (lint + build)` (ejecuta también `npm test`)
- `Contrato API (tipos TS al día)`

Si fallan, se arregla en la misma rama. No se desactivan ni se marcan como opcionales.

## Alcance del trabajo
- Trabaja **solo sobre la issue asignada** (`gh issue view <n>`) y lee el doc que enlaza. Respeta sus dependencias.
- Si descubres trabajo nuevo, propón una issue (editando `scripts/github/backlog.yaml`). No amplíes el alcance.
- Después del **freeze (domingo 11:00)**, solo bugs y pulido.
- No edites a mano `docs/backlog.md` ni `frontend/src/api/types.gen.ts`: son generados.

## Principios del producto (no negociables)
1. **El contrato manda:** primero `docs/api-contract.md`, después `backend/app/schemas/`, después `npm run gen:api`.
2. **Sin datos = desconocido:** `unknown`, `stale` y `lost` nunca se muestran en verde.
3. **Local-first:** nada de nube, CDNs ni internet en tiempo de ejecución.
4. **Sin pérdida de datos:** los `POST` llevan un UUID del cliente, son idempotentes y las escrituras del front pasan por el outbox.
5. **Configuración, no código:** umbrales, entornos y protocolos van en `backend/app/data/*.json`.
6. **Reloj inyectable:** `app/clock.py` (`now()`), nunca `datetime.now()`.
7. **Vocabulario por entorno:** nunca "astronauta" fijo en la UI.
8. **Login local y roles:** la autorización vive en el backend (`app/auth/permissions.py`) y el front solo la refleja. El SOS funciona sin sesión y un 401 nunca borra el outbox. Ver `docs/auth-and-roles.md`.
9. **Multi-dispositivo en red local:** HTTP sin contexto seguro (sin `crypto.randomUUID()` ni service workers), vistas de member mobile-first, IndexedDB por dispositivo y eventos con `events.emit()` para el SSE. Ver `docs/control-center-and-devices.md`.
10. **Privacidad conductual** y **disclaimer** ("no es un dispositivo médico").

## Seguridad y datos
- No subas secretos, tokens ni `.env`.
- No metas datos personales reales: todo el seed es sintético.
- No añadas dependencias de servicios externos sin acordarlo en una issue.
