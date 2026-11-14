# Equipo, cronograma y reglas de trabajo

## Roles
| Rol | Responsable de |
|---|---|
| **Supervisor** | Alcance y prioridades (tiene la última palabra), control del tiempo y check-ins. Contenido HRP: umbrales, explicaciones, intervenciones y fuentes. Textos de la UI, pitch, slides, vídeo y envío a Space Apps. Ensayos. |
| **Full-stack** | Scaffolding, contrato y tipos generados, mocks, integración front↔back, enlace simulado en la UI, controles de demo, gamificación en la UI, PVT, docker-compose. |
| **Front A** | `BodyFigure` SVG, `SystemPanel`, temas por entorno, selector de entorno, barra de fase de misión, Earth view. |
| **Front B** | Dashboard, `IndicatorCard`, `TrendChart`, formularios guiados, check-in, outbox offline, SOS y alertas, consola `/ground`. |
| **Back A** | Modelos, catálogos JSON, perfiles de entorno, members, mediciones, seed y escenarios, enlace simulado. |
| **Back B** | Motor de evaluación, tendencias y línea base, alertas y escalado, liveness, rutina y gamificación, tests. |

## Cronograma (sábado → domingo 16:00)
| Hora | Hito |
|---|---|
| **Sáb, primeras 2 h** — **M0 Setup** | Kick-off. Scaffolding, **contrato v0 cerrado**, mocks, catálogos iniciales. Wireframe rápido del dashboard. |
| **+2 a +8 h** | Desarrollo en paralelo: el front contra mocks, el back con endpoints y motor. **Check-in cada 3 h** (15 min). |
| **Sáb noche** — **Hito 1** | Dashboard con cuerpo y semáforo usando datos reales del back, cambio de entorno funcionando, check-in diario. |
| **Noche** | Turnos de descanso escalonados (nunca duermen a la vez los 2 de front ni los 2 de back). Alertas, offline, liveness, gamificación. |
| **Dom 09:00** — **Hito 2** | MVP integrado, escenarios de demo cargados y pruebas offline superadas. |
| **Dom 11:00** — **Freeze** | **Congelación de funcionalidades.** Lo P2 que no esté terminado se corta. Solo bugs y pulido. |
| **Dom 12:00–14:00** | Vídeo, capturas, slides y envío a Space Apps. |
| **Dom 14:00–15:30** | 2 o 3 ensayos completos. Plan B listo (vídeo + build local). |
| **Dom 16:00** | Presentación. |

## Reglas de trabajo
- **Backlog:** GitHub Issues ([backlog.md](backlog.md)). Se coge siempre la issue **P0 o desbloqueada** de mayor prioridad de tu área. Al empezarla, asígnatela.
- **Ramas:** `feat/<area>-<id>-<slug>`, por ejemplo `feat/be-08-assessment-engine`. Para fixes, `fix/<slug>`.
- **PR pequeñas** a `main`. En la descripción va `Closes #n`. Basta 1 review del mismo área o del full-stack. Los P0 se mergean en cuanto estén verdes.
- **🚫 Push directo a `main` prohibido. Protección por convención.**
  - El repo es privado en una organización Free, y GitHub no permite proteger ramas ni crear *rulesets* en ese plan (la API devuelve HTTP 403). Por tanto, **la regla depende de que el equipo la cumpla**:
    - todo cambio entra por PR;
    - solo se mergea con los 3 checks de la CI en verde y 1 aprobación;
    - el force-push y el borrado de `main` están prohibidos;
    - excepción: los P0 urgentes de madrugada, con el visto bueno del supervisor y avisando en el canal.
  - Cuando el repo pase a **público** (lo exige el envío de Space Apps), se activará la protección automática con esta misma configuración. Ver la issue FS-05.
  - Resumen para el equipo: [`LEEME.txt`](../LEEME.txt).
- **Contrato:** cualquier cambio de API se hace primero en [api-contract.md](api-contract.md), después se regeneran los tipos (`npm run gen:api`) y se avisa al equipo.
- **Commits:** en imperativo y cortos, con el ID de la issue (`BE-08: umbrales por entorno`).
- **Definición de hecho:**
  - cumple los criterios de aceptación de la issue;
  - tiene tests (back) o se ha verificado en el navegador (front);
  - **la CI está en verde**.
- **CI (GitHub Actions, `.github/workflows/ci.yml`).** Se ejecuta en cada PR y en cada push a `main`:
  - **Backend:** `ruff check` + `pytest`.
  - **Frontend:** `npm run lint` + `npm run build` (comprueba los tipos) + `npm test` si existe.
  - **Contrato API:** regenera `types.gen.ts` desde el OpenAPI de FastAPI y falla si hay diferencias. Si cambias la API, ejecuta `npm run gen:api` y commitea el resultado.
  - Cada job se omite (en verde) mientras su carpeta no exista.
- **Bloqueos:** si llevas más de 30 minutos atascado, avisa al supervisor.

## Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Crecimiento del alcance | El supervisor decide, el freeze es a las 11:00 y lo P2 se marca explícitamente |
| Integración tardía | Contrato en la hora 2, mocks en el front e Hito 1 el sábado por la noche |
| Fallo en la demo en directo | Todo local, seed determinista, `/demo/reset` y vídeo de respaldo |
| Afirmaciones médicas | Disclaimer visible y fuentes en [sources.md](sources.md) |
