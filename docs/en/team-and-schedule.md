# Team, schedule and working rules

## Roles
| Role | Responsible for |
|---|---|
| **Supervisor** | Scope and priorities (has the final say), timekeeping and check-ins. HRP content: thresholds, explanations, interventions and sources. UI texts, pitch, slides, video and submission to Space Apps. Rehearsals. |
| **Full-stack** | Scaffolding, contract and generated types, mocks, front↔back integration, **local network and phones (FS-08)**, user management (FS-07), PVT (FE-22), docker-compose (BE-24). |
| **Front A** | `BodyFigure` SVG, `SystemPanel`, per-environment themes, environment selector, mission phase bar, **`/control` control center**, Earth view. |
| **Front B** | Dashboard, `IndicatorCard`, `TrendChart`, guided forms, check-in, offline outbox, SOS and alerts, `/ground` console. |
| **Back A** | Models, JSON catalogs, environment profiles, members, measurements, seed and scenarios, simulated link, **SSE events, devices and control endpoints**. |
| **Back B** | Assessment engine, trends and baseline, alerts and escalation, liveness, routine and gamification, **auth and permissions**, tests. |

## Schedule (Saturday → Sunday 16:00)
| Time | Milestone |
|---|---|
| **Sat, first 2 h** — **M0 Setup** | Kick-off. Scaffolding, **contract v0 locked**, mocks, initial catalogs. Quick dashboard wireframe. **Local network test with 2 phones (FS-08)**: choose between travel router and hotspot. |
| **+2 to +8 h** | Parallel development: front end against mocks, back end with endpoints and engine. **Check-in every 3 h** (15 min). |
| **Sat night** — **Milestone 1** | Dashboard with body and traffic light using real back-end data, login, environment switching working, daily check-in. **A phone connected over the local network sees its dashboard.** |
| **Night** | Staggered rest shifts (the 2 front-end or the 2 back-end people never sleep at the same time). Alerts, offline, liveness, gamification. |
| **Sun 09:00** — **Milestone 2** | Integrated MVP: alerts, offline, liveness, roles, **control center and real time across devices**. Demo scenarios loaded and offline tests passed with phones. |
| **Sun 11:00** — **Freeze** | **Feature freeze.** Any unfinished P2 work is cut. Only bugs and polish. |
| **Sun 12:00–14:00** | Video, screenshots, slides and submission to Space Apps. |
| **Sun 14:00–15:30** | 2 or 3 full rehearsals. Plan B ready (video + local build). |
| **Sun 16:00** | Presentation. |

## Working rules
- **Backlog:** GitHub Issues ([backlog.md](../backlog.md)). Always pick the highest-priority **P0 or unblocked** issue in your area. When you start it, assign it to yourself.
- **Kanban:** [RUOK Kanban (GitHub Project)](https://github.com/orgs/NASAHACKATON2026FTHEALTH42U/projects/1).
  - Columns: **Todo → In Progress → In Review → Done**.
  - Views: *Kanban* (everything), *Backend*, *Frontend*, *Fullstack + Content*, *Ruta crítica (P0)* (Critical path) and *Tabla* (Table).
  - When you start an issue, move it to *In Progress*; when you open the PR, to *In Review*. When merged with `Closes #n`, it moves to *Done* automatically.
  - Fields for filtering or grouping: *Área* (Area), *Prioridad* (Priority) and *Milestone*.
  - New issues created with `create_issues.py` must also be added to the Project (`gh project item-add 1 --owner NASAHACKATON2026FTHEALTH42U --url <issue>`).
- **Branches:** `feat/<area>-<id>-<slug>`, for example `feat/be-08-assessment-engine`. For fixes, `fix/<slug>`.
- **Small PRs** to `main`. The description includes `Closes #n`. 1 review from the same area or from full-stack is enough. P0s are merged as soon as they are green.
- **Avoiding conflicts** (lessons from PRs #64, #88, #89 and #100, which left FE-09 out of `main` because it was stacked and was rescued in #104; details in [`LEEME.txt`](../../LEEME.txt)):
  - **Short-lived** branches (3–4 h at most) kept in sync with `main` often: `git fetch origin && git merge origin/main`. **Always** before opening the PR and before merging.
  - **Do not push commits to an already-merged PR**; follow-up work goes in a new branch.
  - **Do not stack PRs.** If it is unavoidable, merge the bottom one first.
  - Conflicting **generated files** (`types.gen.ts`, `fixtures.gen.ts`, `package-lock.json`, `uv.lock`) are not resolved by hand: they are regenerated.
  - After resolving a conflict, run **all** the tests. If the branch belongs to someone else, leave them a comment on their PR.
- **🚫 Direct pushes to `main` are forbidden. GitHub enforces it.**
  - The repo has been **public** since 11/15 and `main` has branch protection (FS-05):
    - every change goes in through a PR (administrators included);
    - merging is only possible with the 3 CI checks green: `Backend (pytest)`, `Frontend (lint + build)` and `Contrato API (tipos TS al día)`;
    - force-pushing and deleting `main` are blocked.
  - **By convention** (GitHub does not require it): 1 approval from someone else before merging. It was not made mandatory so as not to block last-minute fixes.
  - If CI breaks and something has to go in urgently, an administrator can relax the rule in *Settings → Branches*; the team is notified in the channel and the rule is re-enabled afterwards.
  - Summary for the team: [`LEEME.txt`](../../LEEME.txt). For AI agents: [`AGENTS.md`](../../AGENTS.md).
- **Contract:** any API change is made first in [api-contract.md](../api-contract.md), then the types are regenerated (`npm run gen:api`) and the team is notified.
- **Commits:** imperative and short, with the issue ID (`BE-08: umbrales por entorno`).
- **Definition of done:**
  - meets the issue's acceptance criteria;
  - has tests (back end) or has been verified in the browser (front end);
  - **CI is green**.
- **CI (GitHub Actions, `.github/workflows/ci.yml`).** Runs on every PR and every push to `main`:
  - **Backend:** `ruff check` + `pytest`.
  - **Frontend:** `npm run lint` + `npm run build` (checks types) + `npm test`.
  - **Contrato API (API contract):** regenerates `types.gen.ts` from FastAPI's OpenAPI and fails if there are differences. If you change the API, run `npm run gen:api` and commit the result.
- **Blockers:** if you have been stuck for more than 30 minutes, tell the supervisor.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Scope creep | The supervisor decides, the freeze is at 11:00 and P2 work is explicitly flagged |
| Late integration | Contract at hour 2, mocks in the front end and Milestone 1 on Saturday night |
| Live demo failure | Everything local, deterministic seed, `/demo/reset` and a backup video |
| Medical claims | Visible disclaimer and sources in [sources.md](../sources.md) |
