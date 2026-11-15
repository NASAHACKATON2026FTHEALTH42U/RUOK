# Login and roles (view-based access control)

> Reference design for the 🔐 **Auth** component (issues FS-06, BE-25…BE-27 and FE-27…FE-28). It is consistent with [local-first](architecture.md#local-first-principle) and with [offline-and-liveness.md](offline-and-liveness.md).

## Principles
1. **100 % local authentication.** The onboard server validates users against SQLite. There is no OAuth and no external providers: there is no internet on Mars.
2. **The backend is the authority.** The front end hides views and buttons according to the role, but **every endpoint checks the role and data ownership**. Hiding something in the UI is not security.
3. **SOS never depends on login.** The *SOS* button, the "R U OK?" modal and the autonomous protocol are available **even when the session has expired or is locked**.
4. **No data loss because of the session.** If the token expires while offline, the outbox **keeps everything**, the user is asked to log in again, and then it syncs. A 401 never deletes data.
5. **Generic roles and per-environment vocabulary.** Like `members`, roles are generic and the visible name comes from `environment.vocabulary`.

## Roles

| Role (`role`) | Space (ISS / Moon / Mars) | Hospital | Elderly care | Scope |
|---|---|---|---|---|
| `member` | Astronaut | Patient | Resident | Only their own data |
| `medic` | Onboard medical officer (CMO) | Nursing | Caregiver | All members of **their environment** |
| `commander` | Commander | Ward supervision | Care home coordination | Their environment: aggregate status, crew, alerts |
| `responder` | Flight surgeon (ground) | Physician | Physician | `/ground` console of their environment (only what the link has delivered) |
| `psych` | BHP psychologist (ground) | Psychology | Psychology | Same as `responder`, plus the **confidential channel** and behavioral details |
| `family` *(P2)* | — | Family member | Family member | Aggregate status of **one** member, and messages |
| `admin` | Operator / control center | Administration | Administration | Global: **control center** (`/control`), demo, environment switching, users |

- Each user belongs to **one environment** (`env_id`). Only `admin` is global and can switch environments.
- A user with the `member` role is linked 1:1 to their `member` (`member_id`).

## View access matrix

✅ full access · 👁️ read only · 🔒 no access · *own* = only their own data

| View / action | member | medic | commander | responder | psych | family (P2) | admin |
|---|---|---|---|---|---|---|---|
| Login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SOS** (also **without a session**) and notices to control | ✅ | ✅ | ✅ | — | — | ✅ | — (it is control: creates alerts and notifications from Simulation) |
| Environment selector | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| Dashboard (body + traffic light) | ✅ own | ✅ everyone in the environment | 👁️ everyone | 🔒 (uses `/ground`) | 🔒 | 👁️ aggregate of their relative | ✅ |
| Record measurements | ✅ own | ✅ for any member (assisted) | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| Daily behavioral check-in and PVT test | ✅ own | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| History and charts | ✅ own | ✅ environment | 👁️ environment | 👁️ delivered | 👁️ delivered | 🔒 | ✅ |
| Behavioral details | ✅ own | only if shared or in an emergency | anonymous aggregate | only if shared or in an emergency | ✅ | 🔒 | ✅ |
| Alerts: view | ✅ own | ✅ environment | 👁️ environment | ✅ delivered | ✅ delivered (+ psychological) | 👁️ of their relative | ✅ |
| Alerts: escalate | ✅ own | ✅ | ✅ | — | — | 🔒 | ✅ |
| Alerts: acknowledge / resolve | 🔒 | ✅ `crew` level | ✅ `crew` level | ✅ `ground` level | ✅ psychological | 🔒 | ✅ |
| Missions, points and badges | ✅ own | 👁️ | 👁️ crew board | 🔒 | 🔒 | 🔒 | ✅ |
| Message home *(P2)* | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ✅ (receives/replies) | ✅ |
| `/ground` console | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | ✅ |
| Privacy (`share_behavioral_details`) | ✅ own | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| **Control center** (`/control`: overview, event flow, devices, management) | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| Live event stream (SSE) | own | their environment | their environment | delivered only | delivered only | 🔒 | everything |
| Demo panel (`/demo/*`, link, fast-forward) | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| User management *(P1, FS-07; `family` role P2)* | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |

The matrix lives in code in **a single place** on each side: `backend/app/auth/permissions.py` and `frontend/src/auth/permissions.ts`, generated from or mirroring the backend one. The tests walk through the full matrix.

## Authentication

| Method | For whom | How |
|---|---|---|
| **Username + password** | Everyone | `POST /auth/login`. **bcrypt** hash. Locked for 5 min after 5 consecutive failures. It is the only method: the quick PIN login was removed (screen, endpoints and data). |
| **Demo user picker** | Demo only (`DEMO_MODE=true`) | Buttons on the login screen with the seeded users **of the chosen environment** (by default the space mission, Mars) and the global operator. They log in with the demo password `ruok-<env>`. |

**Session:**
- **JWT HS256** token signed with a local key. The key is generated on first startup and stored in `app_state`. It can also be passed in `RUOK_JWT_SECRET`.
- Payload: `{sub: user_id, role, env_id, member_id, exp}`. It expires after **12 h**, configurable.
- The front end stores `{token, user, exp}` in the IndexedDB `kv` store (key `auth`) and sends it in `Authorization: Bearer <token>`.
- **Logging out** deletes `kv.auth` but **not the outbox**: pending data is sent when the user logs back in.

**Errors:**
- `401` means the token is missing, invalid or expired. The front end shows the login without losing state.
- `403` means the role does not have permission or the data is not theirs.

**SOS without a session:**
- `POST /members/{id}/alerts` accepts requests **without a token** only if `category = emergency`.
- The `member_id` comes from the last user remembered on the device (`kv.last_member_id`).
- The alert is marked `authenticated: false` and the alerts panel shows it.

## Impact on the rest of the system
- **Contract** ([api-contract.md](../api-contract.md#autenticación-y-roles)): every endpoint except `/health`, `/auth/*` and the emergency SOS requires `Authorization`.
- **Data model** ([data-model.md](data-model.md)): `user_account` table and the `auth` key in IndexedDB `kv`.
- **Heartbeat:** only sent by an authenticated `member`. The route is `/members/{member_id}/heartbeat`, and the backend checks that the route's `member_id` matches the token's (403 otherwise).
- **`/ground`:** access only for `responder`, `psych` and `admin`.
- **Demo panel and control center (`/control`):** `admin` only. See [control-center-and-devices.md](control-center-and-devices.md).
- **SSE:** the event stream is filtered on the server according to the token's role.
- **Privacy:** the behavioral filter uses the role (`psych` sees the details; everyone else, only if the member shares or there is an emergency).
- **Forecast (FS-09):** `GET /members/{id}/forecast` uses the same permission as history (row *History and charts*). If the indicator is behavioral and private, the *Behavioral details* row also applies: anyone who cannot see the details gets `403`, because the forecast reveals the values.

## Demo users (seed)
For each environment:
- 3–4 `member`;
- 1 `medic`;
- 1 `commander`;
- 1 `responder`;
- 1 `psych`.

There is also one global `admin`. In elderly care and hospital, 1 `family` is added (P2).

- Demo passwords follow the pattern `ruok-<env>`. They are **for the demo only**: with `DEMO_MODE=false` the seed does not create users with a known password.

## Out of scope (roadmap)
- SSO or agency directory.
- 2FA.
- Encryption at rest for SQLite and IndexedDB.
- Full access auditing.
- Key rotation.
