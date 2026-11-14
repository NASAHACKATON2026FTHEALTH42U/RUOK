# Modelo de datos: SQLite (servidor de a bordo) e IndexedDB (dispositivo)

> Diseño de referencia para **BE-02** (modelos SQLModel) y **FE-11** (outbox offline). Si cambias una tabla o un store, actualiza este documento en la misma PR.

## Visión general

```mermaid
flowchart LR
  subgraph DEV["Dispositivo del member (navegador)"]
    UI[React app] --> OB[(IndexedDB<br/>ruok-device)]
  end
  subgraph SRV["Servidor de a bordo"]
    API[FastAPI] --> DB[(SQLite WAL<br/>ruok.db)]
    API --> CFG[[Catálogos JSON<br/>app/data/*.json]]
  end
  subgraph GND["Control externo (simulado, local)"]
    G["/ground"]
  end
  OB -- "POST idempotentes (UUID)" --> API
  API -- "assessment, catálogo" --> OB
  DB -- "link_message (cola con retardo)" --> G
```

Hay tres capas de datos:
1. **Catálogos JSON** (solo lectura, versionados en git): entornos, indicadores, sistemas, intervenciones, protocolos e insignias. **No son tablas.** Las tablas los referencian por *slug* (`env_id`, `indicator_id`…).
2. **SQLite**: datos operativos de la misión. Es la fuente de verdad.
3. **IndexedDB**: outbox y caché del dispositivo, para que **no se pierda nada** sin conexión. Es una réplica parcial y no es fuente de verdad.

---

## 1. SQLite: `backend/ruok.db`

### Diagrama entidad-relación

```mermaid
erDiagram
  MEMBER ||--o{ MEASUREMENT : registra
  MEMBER ||--o{ TASK : "tiene asignadas"
  TASK ||--o| TASK_COMPLETION : "se completa con"
  MEMBER ||--o{ ALERT : genera
  ALERT ||--o{ ALERT_EVENT : "timeline"
  MEMBER ||--o{ RUOK_CHECK : "recibe"
  RUOK_CHECK |o--o| ALERT : "si no responde: no_contact"
  MEMBER ||--o{ BADGE_AWARD : gana
  MEMBER ||--o{ KUDOS : "da / recibe (P2)"
  ALERT ||--o{ LINK_MESSAGE : "viaja por el enlace"
  ALERT_EVENT |o--o| LINK_MESSAGE : "mensaje de respuesta"
  LINK_STATE ||--o{ LINK_MESSAGE : "estado por entorno"

  MEMBER {
    int id PK
    text env_id "slug -> environments.json"
    text name
    text role "commander, engineer, patient, resident..."
    bool share_behavioral_details "privacidad, default false"
    text device_id "último dispositivo"
    datetime last_seen_at "último heartbeat"
    text last_activity "normal | eva | sleep"
    datetime created_at
  }

  MEASUREMENT {
    text id PK "UUID generado en el cliente (idempotencia)"
    int member_id FK
    text indicator_id "slug -> indicators.json"
    real value
    text unit
    datetime taken_at "hora del dispositivo"
    datetime received_at "hora del servidor (reloj demo)"
    text source "manual | device | camera | checkin | pvt"
    text note
  }

  TASK {
    text id PK "determinista: t_{date}_{member}_{task_type}"
    int member_id FK
    date date
    text task_type "measure_bp, resistive_exercise, checkin..."
    text title
    int points
    text due "morning | afternoon | evening | any"
    text indicator_id "si se autocompleta al medir"
  }

  TASK_COMPLETION {
    text id PK "UUID del cliente"
    text task_id FK "UNIQUE"
    int member_id FK
    datetime completed_at
    datetime received_at
  }

  ALERT {
    text id PK "UUID (cliente si manual, servidor si auto)"
    int member_id FK
    text env_id
    text origin "auto | manual"
    text category "symptom | physical | psychological | emergency | no_contact | indicator"
    text severity "warning | critical | emergency"
    text system_id "nullable"
    json indicator_ids
    text message
    int level "posición en escalation_ladder"
    text target_role "self | crew | ground | nurse | doctor..."
    text delivery_mode "realtime | delayed | autonomous"
    int delay_s
    datetime eta
    datetime delivered_at
    text status "open | escalated | acknowledged | resolved"
    text dedupe_key "member+system o member+category"
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
    datetime responded_at "null = sin respuesta"
    bool ok
    text note
    text alert_id FK "no_contact si timeout"
  }

  LINK_MESSAGE {
    int id PK
    text env_id
    text direction "up (a tierra) | down (a bordo)"
    text kind "alert | alert_event | home_message"
    text ref_id "alert.id / alert_event.id"
    json payload
    datetime sent_at
    datetime eta "sent_at + comm_delay_s (o al salir de LOS)"
    datetime delivered_at
    text state "queued | in_transit | delivered"
  }

  LINK_STATE {
    text env_id PK
    text state "online | delayed | los"
    datetime since
    int delay_override_s "nullable, para la demo"
  }

  BADGE_AWARD {
    int id PK
    int member_id FK
    text badge_id "slug -> badges.json"
    datetime earned_at
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

Hay además una tabla técnica, fuera del diagrama: **`app_state`** (`key TEXT PK`, `value JSON`). Guarda el offset del reloj de demo (`clock_offset_s`), la versión del seed y el escenario activo.

### Diccionario y reglas por tabla

| Tabla | Notas clave | Issue |
|---|---|---|
| `member` | Cada entorno tiene sus members (`env_id`). `last_seen_at` lo actualiza el heartbeat y de él se deriva el liveness (no se guarda). | BE-02, BE-05, BE-12 |
| `measurement` | **Solo se añade, nunca se edita.** La PK es el UUID del cliente: un reintento con el mismo `id` y el mismo contenido devuelve 200, y con contenido distinto, 409. El check-in y el PVT también son measurements (`source`). | BE-06, BE-20 |
| `task` | Se genera cada día desde `environment.routine`. El `id` determinista evita duplicados si la generación se repite. | BE-18 |
| `task_completion` | `UNIQUE(task_id)`: una tarea se completa una sola vez. Los puntos y las rachas **se calculan** a partir de aquí y no se guardan. | BE-18, BE-19 |
| `alert` | Hay como máximo **una alerta abierta por `dedupe_key`** (índice único parcial). `level` es el índice dentro de la escalera del entorno. | BE-14, BE-15 |
| `alert_event` | Timeline *append-only*, que el front muestra tal cual. | BE-14, BE-15 |
| `ruok_check` | Se crea al pasar a `stale`. Si llega el timeout sin `responded_at`, se crea la alerta `no_contact`. | BE-16 |
| `link_message` | Outbox/inbox **persistente** del enlace simulado. Se entrega cuando `now() >= eta` y el enlace no está en `los`. Sobrevive a reinicios. | BE-13 |
| `link_state` | Una fila por entorno, modificable desde `/demo/link`. | BE-13 |
| `badge_award` | `UNIQUE(member_id, badge_id)`. | BE-19 |
| `kudos` | P2. | BE-23 |

### Índices y restricciones

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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
```

**Convenciones:**
- Todas las fechas se guardan en UTC, en ISO-8601, y se obtienen siempre con `clock.now()`.
- Los campos `json` se guardan como TEXT con `sa_column=Column(JSON)` en SQLModel.

### Catálogos JSON referenciados (no son tablas)

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

`member.env_id`, `measurement.indicator_id`, `alert.system_id`, `badge_award.badge_id` y `task.task_type` se validan contra estos catálogos en la capa de servicio, porque no hay claves foráneas a JSON.

---

## 2. IndexedDB: base `ruok-device` (v1, librería `idb`)

Un dispositivo puede trabajar sin el servidor de a bordo. IndexedDB guarda:
- **qué falta por enviar** (outbox);
- **lo necesario para seguir funcionando** (catálogo, último assessment, protocolos).

```mermaid
classDiagram
  direction TB
  class outbox {
    <<object store · keyPath id>>
    +string id — UUID del recurso (measurement, alert...)
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
    +string id — UUID (mismo que en outbox y SQLite)
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
    +object assessment — último del servidor
    +string received_at
    +boolean provisional — true si lo calculó el front offline
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
    +boolean pending — true = SOS aún en outbox
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
    +string key — device_id | env_id | member_id | last_heartbeat_at
    +any value
  }
  outbox ..> measurements : mismo id
  outbox ..> alerts : mismo id (SOS)
  outbox ..> tasks : completado
  catalog ..> assessments : rangos para el semáforo provisional
```

### Reglas
| Store | Escribe | Lee | Se purga |
|---|---|---|---|
| `outbox` | Todas las escrituras del front, **antes** de llamar a la API | El sincronizador (evento `online` + backoff) | Al recibir 2xx, incluida la respuesta "duplicado" |
| `measurements` | Al registrar una medición (`synced=false`) y al descargar el historial | Historial y gráficas offline, semáforo provisional | Se conservan 30 días |
| `assessments` | Respuesta del servidor, o el cálculo provisional | Dashboard sin conexión | Se sobrescribe |
| `catalog` | Al arrancar con conexión | Formularios, rangos, protocolos e intervenciones offline | Se sobrescribe |
| `alerts` | SOS local (`pending=true`) y alertas del servidor | Panel de alertas y aviso "No enviado" | Las resueltas, a los 7 días |
| `tasks` | Tareas del día y completados locales | Misiones offline | Se conservan los días anteriores al de hoy menos 2 |
| `kv` | Sesión y `device_id` (UUID generado una vez) | Toda la app | Nunca |

### Flujo de sincronización

```mermaid
sequenceDiagram
  participant UI as UI
  participant IDB as IndexedDB
  participant SYNC as Sync
  participant API as FastAPI
  participant DB as SQLite
  UI->>IDB: put measurements {id, synced=false}
  UI->>IDB: put outbox {id, status=pending}
  UI-->>UI: semáforo provisional (catalog)
  SYNC->>IDB: getAll outbox pending
  SYNC->>API: POST /members/1/measurements {id...}
  alt servidor disponible
    API->>DB: INSERT OR IGNORE (PK = id)
    API-->>SYNC: 200 {accepted|duplicates, assessment}
    SYNC->>IDB: delete outbox[id], measurements.synced=true, put assessments
  else sin conexión / 5xx
    SYNC->>IDB: attempts++, next_retry_at (backoff)
  end
```

**Garantía:** el `id` es el mismo en IndexedDB, en el cuerpo de la petición y en la PK de SQLite. Reintentar es seguro: no se duplican datos ni hay conflictos, porque todo es *append-only*.
