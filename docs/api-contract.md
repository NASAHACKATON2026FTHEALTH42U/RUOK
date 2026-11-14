# Contrato de la API — v0 (cerrado en FS-02)

> **Fuente de verdad entre front y back.** Cualquier cambio se hace primero aquí, en una PR pequeña, y se avisa al equipo. Los tipos TS se generan desde `/openapi.json` (`npm run gen:api`).
>
> **Implementación:** los schemas Pydantic están en `backend/app/schemas/` (un módulo por dominio) y los routers stub en `backend/app/routers/`. Los endpoints marcados `STUB(FS-02)` devuelven datos de ejemplo coherentes (`backend/app/stubs.py`) hasta que su issue los implementa. **Swagger (`/docs`) es la referencia detallada** de cada campo. `backend/tests/test_contract.py` comprueba que todo endpoint de este documento existe en el OpenAPI, y viceversa.

## Convenciones
- Base: `http://localhost:8000/api/v1`. Swagger en `/docs`.
- JSON en `snake_case`. Fechas en ISO-8601 UTC (`2026-11-14T10:00:00Z`).
- **IDs**
  - Configuración: slugs (`mars`, `heart_rate`, `cardiovascular`).
  - Datos generados en el cliente (mediciones, completados, alertas manuales): **UUID v4 creado en el cliente**, para que las peticiones sean idempotentes.
  - Resto de datos: enteros.
- **Errores** con el formato estándar de FastAPI: `{"detail": "..."}`.
  - `404`: recurso inexistente.
  - `409`: el mismo `id` llega con un contenido distinto.
  - `422`: error de validación.
- **Idempotencia.** Repetir un `POST` con el mismo `id` devuelve `200` con el recurso existente y no lo duplica.
- **Dispositivo.** Todas las peticiones llevan la cabecera `X-Device-Id: <uuid>` (ver [control-center-and-devices.md](control-center-and-devices.md#4-identidad-de-dispositivo-y-aislamiento)).
- **Hora del servidor.** Las respuestas llevan la cabecera `X-Server-Time`, que es el reloj de la demo (puede ir acelerado).
- **CORS** abierto en desarrollo.
- **Autenticación:** `Authorization: Bearer <jwt>` en todos los endpoints salvo `/health`, `/auth/*`, `/system/network-info`, el catálogo de solo lectura (`/environments`, `/indicators`, `/systems`, `/interventions`: lo usan el SOS y el protocolo autónomo sin sesión) y el SOS de emergencia. `401` = sin sesión válida; `403` = rol sin permiso o dato ajeno. Ver [auth-and-roles.md](auth-and-roles.md).

## Enumeraciones
```
Status         = normal | warning | critical | unknown
Liveness       = active | stale | lost
Trend          = rising | falling | stable | insufficient_data
EscalationMode = realtime | delayed | autonomous
LinkState      = online | delayed | los
AlertOrigin    = auto | manual
AlertSeverity  = warning | critical | emergency
AlertStatus    = open | escalated | acknowledged | resolved
AlertCategory  = symptom | physical | psychological | emergency | no_contact | indicator
Source         = manual | device | camera | checkin | pvt
Role           = member | medic | commander | responder | psych | family | admin
Activity       = normal | eva | sleep
DeviceKind     = mobile | tablet | desktop
Actor          = system | member | responder
AlertEventType = created | updated | escalated | queued | delivered | acknowledged | message | resolved
EventType      = measurement.created | heartbeat | liveness.changed | alert.* | link.* | sync.batch | auth.* | task.completed | device.registered
```
Todas son esquemas con nombre en el OpenAPI (`components["schemas"]["Status"]`, etc.).
- `unknown` significa que no hay datos o que están caducados. **Nunca se muestra en verde.**
- Los roles de la escalera (`self`, `crew`, `ground`, `nurse`, `doctor`, `caregiver`, `family`) los define cada entorno.

## Endpoints

### Sistema
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | `{status:"ok", server_time}` |

### Autenticación y roles
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/login` | — | `{username, password}` → `{access_token, expires_at, user: User}`. `401` = credenciales incorrectas; `429` (+ `Retry-After`) = cuenta bloqueada 5 min tras 5 fallos |
| POST | `/auth/pin` | — | `{username, pin}` → igual que login, también `429` si está bloqueada (PIN rápido en tablets) |
| GET | `/auth/me` | ✅ | `User` actual |
| GET | `/auth/demo-users` | — | Solo con `DEMO_MODE=true`: usuarios sembrados para el selector de la demo |
| GET | `/users?env_id=` *(FS-07)* | admin | Listado de usuarios, activos o no (pestaña Usuarios de `/control`) |
| POST | `/users` *(FS-07)* | admin | Crear usuario: `{username, display_name, role, env_id, member_id?, password, pin?}` → `201 User`. `409` = usuario ya existente o member ya con cuenta; `422` = rol/entorno/member incoherentes |
| PATCH | `/users/{id}` *(FS-07)* | admin | `{active}` → `User`. Desactivar impide el login. `409` si es tu propia cuenta o el último admin activo |
| PUT | `/users/{id}/pin` *(FS-07)* | admin | `{pin}` → `User`. Restablece el PIN y desbloquea la cuenta. Solo roles `member`/`medic` (`422` si no) |

**Permisos por endpoint:** los define la matriz de [auth-and-roles.md](auth-and-roles.md#matriz-de-acceso-a-vistas). Reglas generales:
- un `member` solo accede a `/members/{su_member_id}/…`;
- `medic` y `commander` acceden a los members de su `env_id`;
- `responder` y `psych` acceden solo a `/environments/{su_env}/alerts?view=ground` y a las acciones sobre alertas entregadas;
- `/demo/*` es solo para `admin`.

**Excepción de seguridad:** `POST /members/{id}/alerts` con `category: "emergency"` se acepta **sin token**, y la alerta queda marcada con `authenticated: false`.

### Configuración (solo lectura)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/environments` | Lista de `Environment` |
| GET | `/environments/{env_id}` | Un `Environment` |
| GET | `/indicators` | Catálogo de `Indicator` |
| GET | `/indicators/{indicator_id}` | Un `Indicator` |
| GET | `/systems` | Lista de `BodySystem` |
| GET | `/interventions?system_id=&category=` | Lista de `Intervention` |

### Members
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/environments/{env_id}/members` | Members del entorno, con resumen (`overall_status`, `liveness`) |
| GET | `/members/{member_id}` | `Member` |
| PATCH | `/members/{member_id}/privacy` | `{share_behavioral_details: bool}` |

### Mediciones
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/members/{member_id}/measurements` | **Lote** `{measurements: MeasurementIn[]}`, idempotente. Devuelve `{accepted: n, duplicates: n, assessment: Assessment}` |
| GET | `/members/{member_id}/measurements?indicator_id=&from=&to=` | Serie temporal, ordenada por `taken_at` |

### Evaluación
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/members/{member_id}/assessment?env=` | `Assessment`. Con `env` se evalúa con otro perfil, sin modificar datos |

### Liveness
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/members/{member_id}/heartbeat` | `{device_id, activity?: "normal"\|"eva"\|"sleep", pending_outbox: int, last_sync_at?, device_kind?: "mobile"\|"tablet"\|"desktop"}`. Devuelve `{liveness, checkin_required: bool}`. También actualiza el registro del dispositivo |
| POST | `/members/{member_id}/ruok` | Respuesta al check-in "R U OK?": `{ok: bool, note?}` |

### Alertas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/members/{member_id}/alerts?status=` | Alertas del member |
| POST | `/members/{member_id}/alerts` | **Petición manual de ayuda** (`AlertIn`) |
| POST | `/alerts/{alert_id}/escalate` | `{target_role?, message?}`. Por defecto, el siguiente nivel |
| POST | `/alerts/{alert_id}/ack` | `{actor: "member"\|"responder"}` |
| POST | `/alerts/{alert_id}/resolve` | `{actor, note?}` |
| POST | `/alerts/{alert_id}/messages` | `{actor, text}` (viaja por el enlace si va a tierra) |
| GET | `/environments/{env_id}/alerts?view=ground` | Consola del responder: solo lo **entregado** por el enlace y filtrado por privacidad |

### Rutina y gamificación
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/members/{member_id}/tasks?date=YYYY-MM-DD` | Tareas del día (`Task[]`). Por defecto, hoy (UTC, reloj del servidor). Se generan desde `environment.routine` |
| POST | `/members/{member_id}/tasks/{task_id}/complete` | `{id: uuid, completed_at}`, idempotente. Devuelve `GameState`. El mismo `id` para otra tarea → 409; una tarea ya completada no suma dos veces |

```jsonc
// Task — id determinista: t_{date}_{member}_{task_type}, con sufijo _{n} (1..N) si times_per_day > 1
{ "id": "t_2026-11-14_17_hydration_2", "task_type": "hydration", "title": "Bebe agua (2/3)",
  "points": 5, "due": "afternoon", "completed": false, "indicator_id": "hydration_ml" }
// Las tareas con indicator_id se autocompletan con las mediciones de ese indicador del mismo día
// (una medición completa una tarea). Título, momento del día e indicador: app/data/task_types.json
```
| GET | `/members/{member_id}/game` | `GameState` |
| GET | `/environments/{env_id}/leaderboard` | Puntos de la tripulación (cooperativo): `crew_points` y la aportación de cada member, **en el orden de los members** (no es un ranking) |

```jsonc
// GameState — todo se calcula de task_completion; solo las insignias ganadas se guardan (se conservan)
{ "points": 60, "streak_days": 3, "crew_points": 140,
  "badges": [{ "id": "streak_3", "name": "Constancia", "earned_at": "..." }] }
// streak_days = días seguidos (UTC, reloj del servidor) con al menos una tarea completada,
// contando desde hoy, o desde ayer si hoy aún no hay ninguna. Insignias: app/data/badges.json
```

### Tiempo real, dispositivos y centro de control
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/events/stream?token=&types=&env_id=` | todos (filtrado por rol) | **SSE**. Cada mensaje es un `Event`. Admite `Last-Event-ID` para reanudar |
| GET | `/events?since_id=&env_id=&type=&limit=` | admin | Historial de `event_log` (y fallback de polling) |
| GET | `/devices?env_id=` | admin | Dispositivos registrados con `last_seen_at`, `pending_outbox`, `last_sync_at` e IP |
| GET | `/control/overview` | admin | Todos los entornos: members con `overall_status`, `liveness`, alertas abiertas, enlace y métricas |
| POST | `/control/liveness/pause` | admin | `{env_id, paused: bool}`: pausa las alertas de liveness durante la presentación |
| GET | `/system/network-info` | — | `{lan_urls: ["http://192.168.8.10:8000"], hostname}` para el QR de conexión |

```jsonc
// Event (SSE / event_log)
{ "id": 1234, "type": "alert.created", "at": "...", "env_id": "mars",
  "member_id": 1, "user_id": 7, "device_id": "uuid", "ref_id": "alert-uuid",
  "summary": "SOS emergency de Cmdr. Vega", "payload": {} }
// type = measurement.created | heartbeat | liveness.changed | alert.created | alert.escalated |
//        alert.acknowledged | alert.resolved | link.queued | link.delivered | link.state_changed |
//        sync.batch | auth.login | auth.failed | task.completed | device.registered
```

### Enlace con tierra y demo
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/link?env=` | `{state: LinkState, delay_s, queued, since}` |
| GET | `/link/messages?env=&direction=` | Mensajes pendientes o entregados (P2: "mensaje a casa") |
| POST | `/demo/reset` | Reinicia la base de datos con el seed determinista |
| POST | `/demo/scenarios/{name}` | Ejemplos: `mars_sleep_bp`, `eva_no_contact`, `geriatric_fall_risk` |
| POST | `/demo/link` | `{env, state}`, para forzar `online`, `delayed` o `los` |
| POST | `/demo/fast-forward` | `{seconds}`, para avanzar el reloj de la demo |

## Esquemas

```jsonc
// Environment
{
  "id": "mars", "name": "Base marciana", "kind": "space",   // space | earth
  "gravity_g": 0.38, "comm_delay_s": 840, "radiation_level": "high",
  "escalation_ladder": ["self", "crew", "ground"],
  "external_from_level": 2,   // índice del primer nivel externo: self y crew son a bordo (realtime, 0 s)
  "liveness": { "stale_after_s": 300, "lost_after_s": 900, "eva_stale_after_s": 30, "eva_lost_after_s": 120,
                "sleep_factor": 3, "ruok_timeout_s": 120,
                "morning_checkin_by": null,           // "HH:MM" (geriatría: "10:00"); sin check-in a esa hora → stale
                "warning_escalate_after_s": 21600 },  // un warning que persiste este tiempo escala al siguiente nivel
  "vocabulary": { "member": "astronauta", "crew": "tripulación", "ground": "flight surgeon" },
  "theme": { "primary": "#c1440e", "background": "mars.jpg" },
  "threshold_overrides": { "bp_systolic": { "warning": [130, 140] } },
  "indicators": ["heart_rate", "bp_systolic", "..."],
  "routine": [{ "task_type": "measure_bp", "times_per_day": 1, "points": 10 }],
  "mission": { "start": "2026-10-01", "end": "2027-09-30" }
}

// Indicator
{
  "id": "bp_systolic", "name": "Tensión sistólica", "unit": "mmHg", "system_id": "cardiovascular",
  "ranges": { "normal": [90, 129], "warning": [130, 159], "critical_low": 80, "critical_high": 160 },
  "max_age_s": 172800, "higher_is_worse": true,
  "input": { "type": "number", "min": 50, "max": 250, "step": 1 },   // number | scale_1_5 | duration
  "measurement_instructions": ["Siéntate 5 min en reposo", "..."],
  "why_it_matters": "...", "hazards": ["gravity"]
}

// BodySystem
{ "id": "cardiovascular", "name": "Cardiovascular", "svg_region": "heart",
  "indicators": ["heart_rate", "bp_systolic", "bp_diastolic", "spo2"],
  "function": "...", "space_effects": "...", "hazards": ["gravity", "radiation"] }

// User (sesión)
{ "id": 7, "username": "vega", "display_name": "Cmdr. Vega", "role": "member",   // member | medic | commander | responder | psych | family | admin
  "env_id": "mars", "member_id": 1, "role_label": "astronauta" }                   // role_label sale de environment.vocabulary

// Member   (⚠️ `position` = puesto en la misión; NO es el rol de acceso `User.role`)
{ "id": 1, "env_id": "mars", "name": "Cmdr. Vega", "position": "commander",
  "share_behavioral_details": false, "last_seen_at": "...", "liveness": "active" }
// MemberSummary = Member + { overall_status, open_alerts, last_measurement_at }
//   (listas de members, /ground y /control)

// MeasurementIn  (POST, en lote)
// taken_at = instante de la medición según el RELOJ DEL SERVIDOR que conoce el dispositivo (serverNow() en el
//            front, a partir de X-Server-Time), así funciona igual con el fast-forward de la demo.
{ "id": "uuid", "indicator_id": "bp_systolic", "value": 142, "taken_at": "...",
  "source": "manual", "note": null }
// Measurement  (respuesta)  = MeasurementIn + { member_id, unit, received_at }

// Assessment
{
  "member_id": 1, "env_id": "mars", "generated_at": "...",
  "overall_status": "warning",          // el peor entre la salud y el liveness
  "liveness": "active", "last_seen_at": "...",
  "systems": [{
    "system_id": "cardiovascular", "status": "warning",
    "indicators": [{ "indicator_id": "bp_systolic", "last_value": 142, "unit": "mmHg",
                     "taken_at": "...", "status": "warning", "trend": "rising",
                     "baseline": 118, "range": { "normal": [90, 129] } }],
    "recommendations": [{ "id": "rec_bp_repeat", "text": "Repite en reposo en 15 min", "priority": 1,
                         "intervention_id": null }],
    "escalation": { "level": 0, "target_role": "self", "mode": "realtime",     // level = índice en escalation_ladder.
                    // self/crew (a bordo) → realtime, delay_s 0. Externos: realtime <5 s, delayed,
                    // autonomous si retardo ≥ 60 s Y critical (ver alerts-and-escalation.md)
                    "delay_s": 0, "message": "...", "protocol_id": "proto_cardiovascular_critical" }
  }],
  "behavioral": { "status": "normal", "details_visible": true },  // privacidad: con false, los indicadores
                  // conductuales (mood, stress, energy, loneliness, sleep_quality, crew_relation, pvt_*)
                  // NO aparecen en systems[].indicators; el status del sistema sí (semáforo agregado). BE-20
  "provisional": false                                            // true solo en el cálculo offline del front
}
// MeasurementBatchResult = { accepted, duplicates, assessment }
// HeartbeatResult = { liveness, checkin_required }   ·   RuokResult = { liveness, alert_id? }

// AlertIn  (petición manual)
{ "id": "uuid", "category": "psychological", "severity": "warning",
  "message": "Necesito hablar", "system_id": null, "target_role": "ground" }

// Alert
{ "id": "uuid", "member_id": 1, "env_id": "mars", "origin": "manual", "authenticated": true, "created_by_user_id": 7,
  "category": "psychological", "severity": "warning", "system_id": null, "indicator_ids": [],
  "message": "...", "level": 2, "target_role": "ground",
  "delivery_mode": "delayed", "delay_s": 840, "eta": "...", "delivered_at": null,
  "status": "escalated", "created_at": "...", "updated_at": "...",
  "events": [{ "type": "created", "actor": "member", "at": "...", "payload": {} }] }
// AlertEvent.type = created | updated | escalated | queued | delivered | acknowledged | message | resolved

// Task
{ "id": "t_2026-11-14_1_measure_bp", "task_type": "measure_bp", "title": "Mide tu tensión",
  "points": 10, "due": "morning", "completed": false, "indicator_id": "bp_systolic" }

// GameState
{ "points": 340, "streak_days": 5, "badges": [{ "id": "early_bird", "name": "...", "earned_at": "..." }],
  "crew_points": 1820 }

// LeaderboardEntry / Leaderboard (cooperativo)
{ "env_id": "mars", "crew_points": 1820,
  "members": [{ "member_id": 1, "name": "Cmdr. Vega", "points": 340, "streak_days": 5 }] }

// TokenResponse (login / PIN)
{ "access_token": "…", "token_type": "bearer", "expires_at": "...", "user": { /* User */ } }
// DemoUser = { username, display_name, role, env_id, role_label }

// LinkStatus
{ "env_id": "mars", "state": "delayed", "delay_s": 840, "queued": 1, "since": "..." }
// LinkMessage = { id, env_id, direction: up|down, kind: alert|alert_event|home_message,
//                 ref_id, payload, sent_at, eta, delivered_at, state: queued|in_transit|delivered }

// GroundView (GET /environments/{env_id}/alerts?view=ground): solo lo ENTREGADO
{ "env_id": "mars", "as_of": "...",            // ahora - retardo
  "link": { /* LinkStatus */ }, "members": [ /* MemberSummary */ ], "alerts": [ /* Alert */ ] }

// Device
{ "id": "uuid", "user_id": 7, "kind": "mobile", "label": "movil-vega", "ip": "192.168.8.21",
  "user_agent": "...", "first_seen_at": "...", "last_seen_at": "...",
  "pending_outbox": 0, "last_sync_at": "..." }

// ControlOverview (GET /control/overview)
{ "generated_at": "...",
  "environments": [{ "environment": { "id": "mars", "name": "...", "kind": "space" },
                     "link": { /* LinkStatus */ }, "members": [ /* MemberSummary */ ],
                     "open_alerts": { "warning": 1, "critical": 0, "emergency": 0 },
                     "liveness_paused": false }],
  "metrics": { "measurements_last_hour": 12, "open_alerts": 1, "active_devices": 1,
               "avg_alert_response_s": 95.0 } }

// NetworkInfo = { lan_urls: ["http://192.168.8.10:8000"], hostname }
// OkResponse  = { ok: true, detail? }    (demo/reset, demo/scenarios, control/liveness/pause)
// DemoClock   = { server_time, offset_s } (demo/fast-forward)

// Intervention (app/data/interventions.json, BE-21)
{ "id": "int_box_breathing", "title": "Respiración en caja", "category": "stress",
  "system_id": "neuro_behavioral", "duration_min": 4, "steps": ["..."], "offline": true,
  "indicator_ids": ["stress"],   // a qué indicadores responde; [] = genérica del sistema
  "sources": ["S3"] }            // IDs de docs/sources.md
// En el assessment, un sistema en warning o critical recomienda las intervenciones de sus
// indicadores alterados y siempre las genéricas del sistema (Recommendation.intervention_id).
// Si behavioral.details_visible es false, solo las genéricas: no revelan qué indicador saltó.
```

### SSE: formato de `/events/stream`
```
id: 2
event: alert.created
data: {"id":2,"type":"alert.created","at":"...","env_id":"mars","member_id":1,...}

```
- `id` es el `Event.id`. El navegador lo reenvía como `Last-Event-ID` al reconectar.
- `event` es el `Event.type` y `data` es el `Event` en JSON.
- El stub emite los eventos de ejemplo y cierra la conexión; el stream continuo llega con BE-28.

### Reglas generales de los schemas
- **Valores por defecto:** un campo con default es **opcional en la petición** y **siempre presente en la respuesta**.
- **Entrada estricta:** los cuerpos rechazan campos desconocidos con `422` (`extra="forbid"`), así que una errata en un campo no se pierde en silencio.
- **Fechas:** ISO-8601 con zona. En las query strings usa `Z` (`2026-11-14T10:00:00Z`); un `+00:00` sin codificar llega como espacio.
- `GET /members/{id}/measurements` usa el parámetro `from` (palabra reservada en Python; en el back es `from_` con alias).

## Reglas que el front debe respetar
0. Ocultar vistas por rol es UX y no seguridad. El backend valida siempre. Un `401` nunca borra el outbox: se pide login y se reintenta.
1. **Nunca pintar en verde** `unknown`, `stale` ni `lost`. Para esos casos se usa el estilo gris con rayado.
2. Cada `POST` que crea datos lleva un `id` UUID generado en el cliente. Si falla, se guarda en el outbox y se reintenta.
3. La consola `/ground` muestra siempre la antigüedad del dato (`last_seen_at`, `delivered_at`) y el estado del enlace.
