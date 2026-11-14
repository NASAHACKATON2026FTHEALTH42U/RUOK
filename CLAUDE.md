# CLAUDE.md — RUOK

Prototipo para el **NASA Space Apps Challenge 2026**, reto *"Create Health Monitoring Software for Astronauts on Space Missions"*.
**R U OK? (Are You OK?)** es una herramienta de autoevaluación de salud que se adapta al entorno (ISS, Luna, Marte, Tierra, hospital, residencia geriátrica) y funciona **100 % en local**.
Presentación: **domingo 16:00**. Freeze de funcionalidades: **domingo 11:00**.

Toda la documentación está en [`docs/`](docs/README.md). **Léela antes de diseñar o cambiar algo.** Lo más importante:
- [`docs/api-contract.md`](docs/api-contract.md): **fuente de verdad** de la API.
- [`docs/architecture.md`](docs/architecture.md): stack, estructura y decisiones.
- [`docs/backlog.md`](docs/backlog.md): tareas priorizadas (GitHub Issues).

## Stack y comandos
| Parte | Stack | Comandos |
|---|---|---|
| `backend/` | Python 3.11+, FastAPI, SQLModel, SQLite (WAL), pytest | `cd backend && uv run uvicorn app.main:app --reload` · `uv run pytest` |
| `frontend/` | React 18 + Vite + TS, Tailwind, Zustand, Recharts, Framer Motion, idb | `cd frontend && npm run dev` · `npm run build` · `npm run gen:api` |
| Todo | docker-compose | `docker compose up` |
| Backlog | `scripts/github/backlog.yaml` | `python3 scripts/github/create_issues.py [--dry-run]` |

API en `http://localhost:8000/api/v1`, con Swagger en `/docs`. El front corre en `http://localhost:5173`.
*(Estos comandos se activan cuando se completan FS-01, BE-01 y FE-01. Si cambian, actualiza esta tabla.)*

## Principios no negociables
1. **El contrato manda.** Un cambio de API se hace primero en `docs/api-contract.md`, después en `app/schemas.py`, después `npm run gen:api`. Nunca se editan a mano los tipos generados (`src/api/types.gen.ts`).
2. **Sin datos = desconocido.** `unknown`, `stale` y `lost` **nunca** se pintan en verde. El estado global es el peor entre la salud y el liveness.
3. **Local-first.** Nada de servicios en la nube, CDNs ni dependencias de internet en tiempo de ejecución. Fuentes, iconos e imágenes van empaquetados.
4. **Sin pérdida de datos.** Todo `POST` que crea datos lleva un **UUID generado en el cliente** y es idempotente. El front escribe primero en el outbox de IndexedDB.
5. **El enlace con tierra es simulado** (`services/comm_link.py`). Todo lo que va a niveles externos pasa por la cola, con su retardo.
6. **Configuración, no código.** Umbrales, entornos, protocolos e intervenciones van en `backend/app/data/*.json`. No se escriben valores clínicos fijos en el código.
7. **Reloj inyectable.** Usa siempre `app/clock.py` (`now()`) y nunca `datetime.now()` directo, porque la demo acelera el tiempo.
8. **Privacidad conductual.** Los detalles de ánimo o psicológicos se ocultan fuera del member salvo `share_behavioral_details` o una emergencia.
9. **No es un dispositivo médico.** El disclaimer tiene que estar visible y cada umbral o texto clínico se cita en `docs/sources.md`.

## Convenciones
- **Idioma:** UI y docs en español; código, identificadores y commits en inglés o español, pero de forma coherente dentro de cada archivo. Los IDs de configuración son slugs en inglés (`mars`, `heart_rate`).
- **Recurso genérico `members`.** El texto visible sale de `environment.vocabulary` (astronauta, paciente, residente). Nunca se escribe "astronauta" fijo en un componente.
- **Ramas:** `feat/<area>-<id>-<slug>` (por ejemplo `feat/be-08-assessment-engine`). PR pequeñas a `main` con `Closes #n`. Commits con el ID de la issue (`BE-08: ...`).
- **Backend:**
  - routers delgados y lógica en `services/`;
  - funciones puras en el motor de evaluación (fáciles de testear);
  - todos los tests en `backend/tests/`.
- **Frontend:**
  - componentes por dominio en `src/components/<dominio>/`;
  - toda llamada a la API pasa por `src/api/client.ts` y toda escritura por `src/offline/outbox.ts`;
  - el estado global va en Zustand (`src/store/`).
- **Definición de hecho:** criterios de aceptación de la issue cumplidos, `pytest` verde, `npm run build` sin errores de TS, y verificado en el navegador si es UI.

## Cómo trabajar con Claude en este repo
- **Antes de implementar una issue:** léela (`gh issue view <n>`) junto con el doc enlazado en su cuerpo. Respeta sus dependencias.
- **Alcance:** implementa solo lo que pide la issue. Si detectas trabajo nuevo, propón una issue en lugar de ampliar el alcance. Tras el freeze, solo bugs y pulido.
- **Backlog:** para añadir o cambiar tareas, edita `scripts/github/backlog.yaml` y vuelve a ejecutar el script (es idempotente y regenera `docs/backlog.md`). No edites `docs/backlog.md` a mano.

## Herramientas, skills y MCPs recomendados
### CLI
- **`gh`** (GitHub CLI): issues, PRs, milestones y el script del backlog. Instalación: `sudo apt install gh && gh auth login`.
- **`uv`**: entorno y dependencias de Python. **`npm`**: front.

### Skills de Claude Code
| Skill | Cuándo usarla |
|---|---|
| `/run` | Arrancar la app y comprobar que un cambio funciona de verdad (front + back) |
| `claude-in-chrome` | Probar la UI en el navegador: flujo de demo, capturas, logs de consola, modo offline |
| `dataviz` | **Antes** de escribir `TrendChart`, la paleta del semáforo, KPIs o cualquier gráfica |
| `/code-review` | Revisar una rama o PR antes de mergear (sobre todo los P0 y el motor de evaluación) |
| `/simplify` | Limpiar el código cambiado antes del freeze |
| `/security-review` | Una pasada antes de la entrega (datos de salud, inputs, CORS) |
| `claude-api` | Solo si se aborda el asistente IA del roadmap (por defecto, fuera de alcance) |
| Slides (Artifact) / `pptx` | Slides de la presentación (CNT-04) |
| `artifact-design` / `artifact-diagramming` | Diagramas o páginas explicativas para el pitch |

### Agentes
- **Explore**: búsquedas amplias en el código cuando solo hace falta la conclusión.
- **Plan**: diseñar issues grandes (BE-08/09, BE-13/14, FE-11) antes de codificar.

### MCPs disponibles (requieren autenticación previa)
- **Figma**: wireframes del dashboard y del cuerpo SVG, para pasar el diseño a código.
- **Google Drive**: compartir assets, vídeo y slides con el equipo.
- *(Opcional)* **Claude Docs**: docs colaborativos fuera del repo. La documentación oficial del proyecto vive en `docs/`.
