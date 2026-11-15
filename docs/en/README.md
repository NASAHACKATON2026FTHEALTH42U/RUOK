# RUOK — Documentation

> **R U OK? (Are You OK?)** is a health self-assessment tool for astronauts that adapts to its environment: ISS, Moon, Mars… and also hospitals and nursing homes on Earth. It runs **100% locally** (it is the onboard computer), simulates the link with Earth with its real delay and **never treats a status as fine without recent data**.

Challenge: NASA Space Apps Challenge 2026, *Create Health Monitoring Software for Astronauts on Space Missions*.
Presentation: **Sunday 16:00**.

## Index

| Document | Audience | Contents |
|---|---|---|
| [status.md](status.md) | Everyone | **Current status**: what is done, real endpoints and stubs, pending P0s and detected inconsistencies |
| [vision-and-scope.md](vision-and-scope.md) | Everyone | Challenge, core idea, differentiators, MVP scope and roadmap |
| [architecture.md](architecture.md) | Dev | Stack, folder structure, local-first principle and deployment |
| [backend.md](backend.md) | Back | **Backend guide**: how to start it, current structure, SQLite in WAL mode, injectable clock and how to add endpoints |
| [api-contract.md](../api-contract.md) *(Spanish)* | Front + Back | **Source of truth** for API v0: conventions, endpoints and schemas |
| [data-model.md](data-model.md) | Back, Front B | **SQLite and IndexedDB UML**: tables, indexes, stores and sync flow |
| [auth-and-roles.md](auth-and-roles.md) | All devs | **Local login and roles**: per-view access matrix, JWT, SOS without a session |
| [design/hud-style.md](../design/hud-style.md) *(Spanish)* | Front | **HUD style** (ISS, Moon, Mars): tokens, `hud-*` classes, no-scroll mobile rule and per-screen changes. Mockups in `design/mockups/` |
| [control-center-and-devices.md](control-center-and-devices.md) | All devs | **Control center**, real time (SSE), multi-device (phones) and local network setup |
| [environments.md](environments.md) | Back A, Front A | Environment profiles (ISS, Moon, Mars, Earth, Hospital, Geriatrics) |
| [alerts-and-escalation.md](alerts-and-escalation.md) | Back B, Front B | Automatic and manual alerts, escalation ladder and simulated link |
| [offline-and-liveness.md](offline-and-liveness.md) | All devs | No data loss, heartbeat, "R U OK?" check-in and as-of console |
| [behavioral-health.md](behavioral-health.md) | Front B, Back B, Supervisor | Isolation and confinement module |
| [team-and-schedule.md](team-and-schedule.md) | Everyone | Roles, schedule, milestones and working rules |
| [backlog.md](../backlog.md) *(Spanish)* | Everyone | Backlog prioritized by dependencies, linked to the GitHub Issues |
| [demo-script.md](demo-script.md) | Supervisor + everyone | Demo script and plan B |
| [sources.md](../sources.md) *(Spanish)* | Supervisor | NASA HRP / ESA references and other sources |

## GitHub wiki

The wiki is a **copy** of this folder for reading on GitHub; the source of truth is still `docs/`. It is regenerated with:

```bash
python3 scripts/github/build_wiki.py --publish     # clones the wiki, regenerates the pages and pushes
python3 scripts/github/build_wiki.py --out ./wiki  # only generates the files, for review
```

The wiki is at https://github.com/NASAHACKATON2026FTHEALTH42U/RUOK/wiki (the repo has been public since 15/11; on the Free plan, GitHub does not offer wikis on private repos). Anything edited by hand on the web is lost when it is regenerated.

## Golden rules
0. **Never push directly to `main`.** Everything goes in through a PR with green CI. Read [`LEEME.txt`](../../LEEME.txt).

1. **The contract rules.** Any API change is made first in [api-contract.md](../api-contract.md) and announced in the team channel.
2. **No data = unknown.** Nothing is shown in green without recent data.
3. **Local-first.** Nothing depends on the internet or the cloud. Devices (phones, tablets) connect to the onboard server over a **local network without internet**.
4. **Feature freeze on Sunday at 11:00.** After that, only bug fixes and polish.

> ⚠️ RUOK is a hackathon prototype and **not a medical device**.
