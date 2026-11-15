# Data model: SQLite (onboard server) and IndexedDB (device)

> Reference design for **BE-02** (SQLModel models) and **FE-11** (offline outbox). If you change a table or a store, update this document in the same PR.

## Overview

```mermaid
flowchart LR
  subgraph DEV["Member device (browser)"]
    UI[React app<br/>mobile / tablet / tab] --> OB[("IndexedDB<br/>ruok-device_id")]
  end
  subgraph SRV["Onboard server"]
    API[FastAPI] --> DB[(SQLite WAL<br/>ruok.db)]
    API --> CFG[[JSON catalogs<br/>app/data/*.json]]
  end
  subgraph GND["External control (simulated, local)"]
    G["/ground"]
  end
  OB -- "idempotent POSTs (UUID)" --> API
  API -- "assessment, catalog" --> OB
  DB -- "link_message (delayed queue)" --> G
```

There are three data layers:
1. **JSON catalogs** (read-only, versioned in git): environments, indicators, systems, interventions, protocols and badges. **They are not tables.** Tables reference them by *slug* (`env_id`, `indicator_id`…).
2. **SQLite**: the mission's operational data. It is the source of truth.
3. **IndexedDB**: the device's outbox and cache, so that **nothing is lost** while offline. It is a partial replica and not a source of truth.

---

## 1. SQLite: `backend/ruok.db`

### Entity-relationship diagram

```mermaid
erDiagram
  USER_ACCOUNT |o--o| MEMBER : "is (if role=member)"
  USER_ACCOUNT ||--o{ ALERT : "creates / acknowledges"
  MEMBER ||--o{ MEASUREMENT : records
  USER_ACCOUNT ||--o{ DEVICE : "uses"
  DEVICE ||--o{ EVENT_LOG : "source"
  MEMBER ||--o{ TASK : "is assigned"
  TASK ||--o| TASK_COMPLETION : "is completed with"
  MEMBER ||--o{ ALERT : generates
  ALERT ||--o{ ALERT_EVENT : "timeline"
  MEMBER ||--o{ RUOK_CHECK : "receives"
  RUOK_CHECK |o--o| ALERT : "if no answer: no_contact"
  MEMBER ||--o{ BADGE_AWARD : earns
  MEMBER ||--o{ KUDOS : "gives / receives (P2)"
  ALERT ||--o{ LINK_MESSAGE : "travels over the link"
  ALERT_EVENT |o--o| LINK_MESSAGE : "reply message"
  LINK_STATE ||--o{ LINK_MESSAGE : "state per environment"

  USER_ACCOUNT {
    int id PK
    text username "UNIQUE"
    text display_name
    text role "member | medic | commander | responder | psych | family | admin"
    text env_id "slug; null only for admin"
    int member_id FK "UNIQUE, if role=member"
    text password_hash "bcrypt"
    int failed_attempts
    datetime locked_until
    bool active
    datetime last_login_at
    datetime created_at
  }

  MEMBER {
    int id PK
    text env_id "slug -> environments.json"
    text name
    text position "commander, engineer, patient, resident... (not User.role)"
    bool share_behavioral_details "privacy, default false"
    text device_id "last device"
    datetime last_seen_at "last heartbeat"
    text last_activity "normal | eva | sleep"
    datetime created_at
  }

  MEASUREMENT {
    text id PK "client-generated UUID (idempotency)"
    int member_id FK
    text indicator_id "slug -> indicators.json"
    real value
    text unit
    datetime taken_at "time of the measurement (server clock as seen by the device: serverNow())"
    datetime received_at "server time (demo clock)"
    text source "manual | device | camera | checkin | pvt"
    text note
  }

  TASK {
    text id PK "deterministic: t_{date}_{member}_{task_type}"
    int member_id FK
    date date
    text task_type "measure_bp, resistive_exercise, checkin..."
    text title
    int points
    text due "morning | afternoon | evening | any"
    text indicator_id "if auto-completed when measuring"
  }

  TASK_COMPLETION {
    text id PK "client UUID"
    text task_id FK "UNIQUE"
    int member_id FK
    datetime completed_at
    datetime received_at
  }

  ALERT {
    text id PK "UUID (client if manual, server if auto)"
    int member_id FK
    text env_id
    text origin "auto | manual"
    bool authenticated "false = emergency SOS without a session"
    int created_by_user_id FK "nullable"
    text category "symptom | physical | psychological | emergency | no_contact | indicator"
    text severity "warning | critical | emergency"
    text system_id "nullable"
    json indicator_ids
    text message
    int level "position in escalation_ladder"
    text target_role "self | crew | ground | nurse | doctor..."
    text delivery_mode "realtime | delayed | autonomous"
    int delay_s
    datetime eta
    datetime delivered_at
    text status "open | escalated | acknowledged | resolved"
    text dedupe_key "member+system or member+category"
    datetime created_at
    datetime updated_at
  }

  ALERT_EVENT {
    int id PK
    text alert_id FK
    text type "created | updated | escalated | queued | delivered | acknowledged | message | resolved"
    text actor "system | member | responder"
    json payload
    datetime at
  }

  RUOK_CHECK {
    int id PK
    int member_id FK
    datetime requested_at
    datetime responded_at "null = no answer"
    bool ok
    text note
    text alert_id FK "no_contact on timeout"
  }

  LINK_MESSAGE {
    int id PK
    text env_id
    text direction "up (to ground) | down (to onboard)"
    text kind "alert | alert_event | home_message"
    text ref_id "alert.id / alert_event.id"
    json payload
    datetime sent_at
    datetime eta "sent_at + comm_delay_s (or when LOS ends)"
    datetime delivered_at
    text state "queued | in_transit | delivered"
  }

  LINK_STATE {
    text env_id PK
    text state "online | delayed | los"
    datetime since
    int delay_override_s "nullable, for the demo"
  }

  BADGE_AWARD {
    int id PK
    int member_id FK
    text badge_id "slug -> badges.json"
    datetime earned_at
  }

  DEVICE {
    text id PK "UUID generated on the device"
    int user_id FK "last user with a session"
    text kind "mobile | tablet | desktop"
    text label "e.g. movil-vega, ?device="
    text ip
    text user_agent
    datetime first_seen_at
    datetime last_seen_at
    int pending_outbox "reported in the heartbeat"
    datetime last_sync_at
  }

  EVENT_LOG {
    int id PK "autoincrement; used as Last-Event-ID"
    text type "measurement.created | alert.created | ..."
    datetime at
    text env_id
    int member_id "nullable"
    int user_id "nullable"
    text device_id "nullable"
    text ref_id "id of the related resource"
    text summary
    json payload
  }

  KUDOS {
    text id PK "UUID"
    text env_id
    int from_member_id FK
    int to_member_id FK
    text message
    datetime created_at
  }
```

There is also a technical table, outside the diagram: **`app_state`** (`key TEXT PK`, `value JSON`). It stores the demo clock offset (`clock_offset_s`), the seed version and the active scenario.

### Dictionary and rules per table

| Table | Key notes | Issue |
|---|---|---|
| `user_account` | Local login. `UNIQUE(username)` and `UNIQUE(member_id)`. Lockout after 5 failures with `failed_attempts`/`locked_until`. See [auth-and-roles.md](auth-and-roles.md). | BE-25, BE-26 |
| `member` | Each environment has its own members (`env_id`). `last_seen_at` is updated by the heartbeat and liveness is derived from it (not stored). | BE-02, BE-05, BE-12 |
| `measurement` | **Append-only, never edited.** The PK is the client UUID: a retry with the same `id` and the same content returns 200, and with different content, 409. The check-in and the PVT are also measurements (`source`). | BE-06, BE-20 |
| `task` | Generated every day from `environment.routine`. The deterministic `id` prevents duplicates if generation runs again. | BE-18 |
| `task_completion` | `UNIQUE(task_id)`: a task is completed only once. Points and streaks **are computed** from here and not stored. | BE-18, BE-19 |
| `alert` | There is at most **one open alert per `dedupe_key`** (partial unique index). `level` is the index within the environment's escalation ladder. | BE-14, BE-15 |
| `alert_event` | *Append-only* timeline, shown by the front end as is. | BE-14, BE-15 |
| `ruok_check` | Created when the member becomes `stale`. If the timeout is reached without `responded_at`, the `no_contact` alert is created. | BE-16 |
| `link_message` | **Persistent** outbox/inbox of the simulated link. Delivered when `now() >= eta` and the link is not in `los`. Survives restarts. | BE-13 |
| `link_state` | One row per environment, editable from `/demo/link`. | BE-13 |
| `badge_award` | `UNIQUE(member_id, badge_id)`. | BE-19 |
| `kudos` | P2. | BE-23 |
| `device` | One row per device (mobile, tablet, tab). Updated on every heartbeat or request (`X-Device-Id`). | BE-29 |
| `event_log` | *Append-only* log of everything that happens. Feeds SSE and the control center. Purged after 7 days. | BE-28 |

### Indexes and constraints

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX ux_user_username     ON user_account(username);
CREATE UNIQUE INDEX ux_user_member       ON user_account(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX ix_member_env              ON member(env_id);
CREATE INDEX ix_measurement_series      ON measurement(member_id, indicator_id, taken_at);
CREATE INDEX ix_task_member_date        ON task(member_id, date);
CREATE UNIQUE INDEX ux_task_completion  ON task_completion(task_id);
CREATE INDEX ix_alert_member_status     ON alert(member_id, status);
CREATE INDEX ix_alert_env_delivered     ON alert(env_id, delivered_at);
CREATE UNIQUE INDEX ux_alert_open_dedupe ON alert(dedupe_key) WHERE status <> 'resolved';
CREATE INDEX ix_alert_event_alert       ON alert_event(alert_id, at);
CREATE INDEX ix_ruok_member_pending     ON ruok_check(member_id) WHERE responded_at IS NULL;
CREATE INDEX ix_link_due                ON link_message(env_id, state, eta);
CREATE UNIQUE INDEX ux_badge_award      ON badge_award(member_id, badge_id);
CREATE INDEX ix_device_user            ON device(user_id, last_seen_at);
CREATE INDEX ix_event_env_id           ON event_log(env_id, id);
CREATE INDEX ix_event_type_at          ON event_log(type, at);
```

**Conventions:**
- All dates are stored in UTC, as ISO-8601, and are always obtained with `clock.now()`.
- `json` fields are stored as TEXT with `sa_type=JSON` in SQLModel.
- `event_log` **deliberately declares no foreign keys**: it is an *append-only* log that must not fail if a member or a device is deleted. The relationships in the diagram are logical.

### Referenced JSON catalogs (not tables)

```mermaid
classDiagram
  direction LR
  class Environment {
    +slug id
    +float gravity_g
    +int comm_delay_s
    +list escalation_ladder
    +dict liveness
    +dict vocabulary
    +dict theme
    +dict threshold_overrides
    +list routine
    +dict mission
  }
  class Indicator {
    +slug id
    +str unit
    +slug system_id
    +dict ranges
    +int max_age_s
    +dict input
    +list measurement_instructions
  }
  class BodySystem {
    +slug id
    +str svg_region
    +list indicators
  }
  class Intervention {
    +slug id
    +str category
    +slug system_id
    +list steps
  }
  class Protocol {
    +slug id
    +list steps
  }
  class Badge {
    +slug id
    +str rule
  }
  BodySystem "1" --> "*" Indicator
  Environment ..> Indicator : threshold_overrides
  Intervention --> BodySystem
```

`member.env_id`, `measurement.indicator_id`, `alert.system_id`, `badge_award.badge_id` and `task.task_type` are validated against these catalogs in the service layer, because there are no foreign keys to JSON.

---

## 2. IndexedDB: one database per device, `ruok-<device_id>` (v1, `idb` library)

> The `device_id` is stored in `localStorage` (real device) or in `sessionStorage` (each tab is a device, for rehearsals). `?device=<name>` pins a named one. See [control-center-and-devices.md](control-center-and-devices.md#4-device-identity-and-isolation).

A device can work without the onboard server. IndexedDB stores:
- **what is still to be sent** (outbox);
- **what is needed to keep working** (catalog, last assessment, protocols).

```mermaid
classDiagram
  direction TB
  class outbox {
    <<object store · keyPath id>>
    +string id — resource UUID (measurement, alert...)
    +string kind — measurement_batch | task_completion | alert | ruok | privacy
    +string method
    +string path — /members/1/measurements
    +object body
    +number member_id
    +string created_at
    +number attempts
    +string next_retry_at
    +string status — pending | sending | failed
    +string last_error
    +index_by_status_created(status, created_at)
  }
  class measurements {
    <<object store · keyPath id>>
    +string id — UUID (same as in outbox and SQLite)
    +number member_id
    +string indicator_id
    +number value
    +string taken_at
    +string source
    +boolean synced
    +index_by_series(member_id, indicator_id, taken_at)
  }
  class assessments {
    <<object store · keyPath member_id>>
    +number member_id
    +object assessment — latest from the server
    +string received_at
    +boolean provisional — true if computed by the front end offline
  }
  class catalog {
    <<object store · keyPath key>>
    +string key — environments | indicators | systems | interventions | protocols
    +object value
    +string fetched_at
  }
  class alerts {
    <<object store · keyPath id>>
    +string id
    +number member_id
    +object alert
    +boolean pending — true = SOS still in outbox
    +index_by_member(member_id)
  }
  class tasks {
    <<object store · keyPath id>>
    +string id
    +number member_id
    +string date
    +object task
    +boolean completed_local
    +index_by_member_date(member_id, date)
  }
  class kv {
    <<object store · keyPath key>>
    +string key — device_id | device_name | auth | last_member_id | last_heartbeat_at
    +any value
  }
  outbox ..> measurements : same id
  outbox ..> alerts : same id (SOS)
  outbox ..> tasks : completion
  catalog ..> assessments : ranges for the provisional traffic light
```

### Rules
| Store | Written by | Read by | Purged |
|---|---|---|---|
| `outbox` | Every front-end write, **before** calling the API | The synchronizer (`online` event + backoff) | On a 2xx response, including the "duplicate" response |
| `measurements` | When recording a measurement (`synced=false`) and when downloading history | Offline history and charts, provisional traffic light | Kept for 30 days |
| `assessments` | Server response, or the provisional calculation | Offline dashboard | Overwritten |
| `catalog` | On startup with a connection | Offline forms, ranges, protocols and interventions | Overwritten |
| `alerts` | Local SOS (`pending=true`) and server alerts | Alerts panel and "No enviado" (Not sent) notice | Resolved ones, after 7 days |
| `tasks` | Today's tasks and local completions | Offline missions | Days older than today minus 2 are removed |
| `kv` | `device_id` (UUID generated once), `device_name` (`?device=`), `auth` = `{token, user, exp}` (FE-27) and `last_member_id` (for the SOS without a session). **The UI session** (environment, member, vocabulary: Zustand store) **does not go here**: it is stored in `localStorage` under the key `ruok-session-<device_id>` (FE-02/FE-30) | The whole app | `auth` is cleared on logout. The outbox is **never** cleared by a logout or a 401 |

### Synchronization flow

```mermaid
sequenceDiagram
  participant UI as UI
  participant IDB as IndexedDB
  participant SYNC as Sync
  participant API as FastAPI
  participant DB as SQLite
  UI->>IDB: put measurements {id, synced=false}
  UI->>IDB: put outbox {id, status=pending}
  UI-->>UI: provisional traffic light (catalog)
  SYNC->>IDB: getAll outbox pending
  SYNC->>API: POST /members/1/measurements {id...}
  alt server available
    API->>DB: INSERT OR IGNORE (PK = id)
    API-->>SYNC: 200 {accepted|duplicates, assessment}
    SYNC->>IDB: delete outbox[id], measurements.synced=true, put assessments
  else offline / 5xx
    SYNC->>IDB: attempts++, next_retry_at (backoff)
  end
```

**Guarantee:** the `id` is the same in IndexedDB, in the request body and in the SQLite PK. Retrying is safe: no data is duplicated and there are no conflicts, because everything is *append-only*.
