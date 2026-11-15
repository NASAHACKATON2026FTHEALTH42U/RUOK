# Project status

> Snapshot from **Sunday 11/15, 11:30** (after the freeze). Update it at each milestone (or ask Claude: "actualiza docs/status.md"). Source: GitHub Issues/PRs and code review. The detail of each piece is in [`backend.md`](backend.md) and [`frontend/README.md`](../../frontend/README.md).

**79 of 83 issues closed.** The MVP is integrated: **every endpoint in the contract is real** (there are no stubs anymore) and the front end covers every view in the demo script.

## What is left

| Issue / PR | Status | What is missing |
|---|---|---|
| PR #233 and PR #237 (final polish, local LLM, notifications, docs) | CI green, stacked | Merge in order: #233 and then #237 |
| FE-33 #81 (mobile views) | Audit at 375 px: no horizontal scroll and 44 px touch targets | Test on real Android Chrome and iOS Safari |
| FS-08 #73 (local network) | QR, `make lan` and hotspot (`scripts/lan.sh hotspot`); one phone has already connected over the Wi-Fi | **Physical test** with 2 phones without internet, and note the result in the issue |
| FS-10 #234, #236 (local assistant) | The local LLM already answers in «Mensaje a casa» (Message home) (Ollama, optional) | Test the model on the demo machine; decide the minimum model |
| CNT-04 #59 (pitch) | Script in [`demo-script.md`](demo-script.md) and 30 s pitch in [`presentation/pitch-30s.md`](../../presentation/pitch-30s.md) | Record the video, rehearsals and submission to Space Apps |

## Done

| Component | Issues | What is there |
|---|---|---|
| ⚙️ Setup | FS-01, BE-01, FE-01, FS-05, BE-24 | Monorepo, **public repo with protected `main`** (PR required and CI green), CI with 3 jobs, `make demo` and `docker compose up` (FastAPI serves the API and the front-end build on one port) |
| 📜 Contract | FS-02, FS-03, FS-04 | Contract in [`api-contract.md`](../api-contract.md), Pydantic schemas, generated TS types (`npm run gen:api`), typed client and **full mock mode** (`?mocks=1`) generated from the real API |
| 🗄️ DB | BE-02, BE-07 | 16 SQLModel tables, SQLite in WAL mode, **deterministic 30-day seed** and demo scenarios (`mars_sleep_bp`, `eva_no_contact`, `geriatric_fall_risk`) |
| 📚 Config | BE-03, BE-04, BE-33, BE-34, CNT-01, CNT-02, CNT-03 | JSON catalogs validated at startup: environments, indicators, systems, protocols, interventions, task types, badges. Thresholds and texts sourced in [`sources.md`](../sources.md) |
| 🌐 API | BE-05, BE-06 | Members and batched measurements (idempotent by UUID, atomic) |
| 🧠 Engine | BE-08 … BE-11, BE-31, FS-09 | Assessment per indicator, system and overall, trends, baseline and delay-aware escalation. **Forecast** of the next few days per indicator (Holt with damped trend, fitted to each person and 100 % local): informational, does not create alerts |
| 💓 Liveness | BE-12, BE-16, FE-15 | Heartbeat, `overall_status` = worst of health and liveness, "R U OK?" check-in and `no_contact` alert |
| 🚨 Alerts | BE-14, BE-15, BE-17, BE-35, FE-13, FE-14, FE-16 | Automatic alerts with deduplication and escalation ladder, manual SOS (also without a session), as-of `/ground` console |
| 📡 Link | BE-13, BE-32, FE-17 | Simulated link with delay and LOS (persistent store-and-forward), fast-forward with a persistent clock |
| 🔐 Auth | FS-06, BE-25 … BE-27, BE-36, FE-27, FE-28, FS-07 | Local login (username and password), JWT, role matrix validated in the backend, user management in `/control` |
| 📶 Real time | BE-28, BE-29, FE-29, FE-30 | `event_log` journal + SSE, device registry, IndexedDB per device |
| 🛰️ Control | BE-30, FE-31, FE-32 | `/control` control center: environment overview, live events, devices, demo and local-network QR |
| 🛰️ Operator | FE-28, FE-31, FE-32 | Its own menu (no user features) and **a single environment and member selector** in the sidebar. Sections: Control center, **Simulation** (custom alerts and notifications, triggered measurements, scenarios, link, contact and clock), Users, Devices (with the QR) and **Log** of incidents and events |
| 💬 Chat | FE-23 | «Mensaje a casa» (Message home) with an **environment-specific persona** and a **local LLM** (Ollama, optional, with guardrails to keep it on topic) and today's and this week's summaries with real data |
| 🔔 Notices | FE-29, FE-31 | Custom notifications with history; live notices with an icon per type; the stream recovers on its own after a drop |
| 📴 Offline | FE-11, FE-12 | Persistent outbox with sync and backoff; provisional traffic light while offline |
| 🎨 UI | FE-02 … FE-04, FE-26, FE-34 | Per-environment themes, vocabulary, `StatusBadge`, **HUD style** ([`design/hud-style.md`](../design/hud-style.md)) |
| 🫀 Dashboard | FE-05 … FE-09 | Body figure, systems ring, system panel, indicator cards, trends and history |
| 📝 Forms | FE-10, FE-19, FE-22 | Guided measurement, daily check-in and PVT test |
| 🎮 Game | BE-18, BE-19, BE-23, BE-37, FE-18 | Daily routine from the environment profile, points, streak, badges, cooperative leaderboard, kudos and group missions (backend) |
| 🧘 Behavioral | BE-20, BE-21, BE-22, FE-20, FE-21, FE-23, FE-25 | Rules against the baseline, privacy of details, interventions, "Mensaje a casa" (Message home), guided meditation with soundscapes (FE-36, replaces the Earth gallery) |

## Endpoints

Every endpoint in the contract is real. `backend/app/stubs.py` only remains as supporting data for the mock exporter and a few tests; **no router uses it**. Swagger at `/docs`.

## How to check the status

```bash
make test                      # backend ruff + pytest and front-end lint + build + tests
gh issue list --state open     # what is left
gh pr list                     # what is in review
```
