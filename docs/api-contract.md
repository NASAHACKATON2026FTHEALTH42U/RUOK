# Contrato de la API — v0

> **Fuente de verdad entre front y back.** Cualquier cambio se hace primero aquí, en una PR pequeña, y se avisa al equipo. Los tipos TS se generan desde `/openapi.json` (`npm run gen:api`).

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
- **Hora del servidor.** Las respuestas llevan la cabecera `X-Server-Time`, que es el reloj de la demo (puede ir acelerado).
- **CORS** abierto en desarrollo.
- **Autenticación:** `Authorization: Bearer <jwt>` en todos los endpoints salvo `/health`, `/auth/*` y el SOS de emergencia. `401` = sin sesión válida; `403` = rol sin permiso o dato ajeno. Ver [auth-and-roles.md](auth-and-roles.md).

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
```
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
| POST | `/auth/login` | — | `{username, password}` → `{access_token, expires_at, user: User}` |
| POST | `/auth/pin` | — | `{username, pin}` → igual que login (PIN rápido en tablets) |
| GET | `/auth/me` | ✅ | `User` actual |
| GET | `/auth/demo-users` | — | Solo con `DEMO_MODE=true`: usuarios sembrados para el selector de la demo |
| GET | `/users?env_id=` *(P2)* | admin | Listado de usuarios |
| POST | `/users` *(P2)* | admin | Crear usuario |

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
| POST | `/members/{member_id}/heartbeat` | `{device_id, activity?: "normal"\|"eva"\|"sleep"}`. Devuelve `{liveness, checkin_required: bool}` |
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
| GET | `/members/{member_id}/tasks?date=YYYY-MM-DD` | Tareas del día (`Task[]`) |
| POST | `/members/{member_id}/tasks/{task_id}/complete` | `{id: uuid, completed_at}`, idempotente. Devuelve `GameState` |
| GET | `/members/{member_id}/game` | `GameState` |
| GET | `/environments/{env_id}/leaderboard` | Puntos de la tripulación (cooperativo) |

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
  "liveness": { "stale_after_s": 300, "lost_after_s": 900, "eva_stale_after_s": 30, "ruok_timeout_s": 120 },
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

// Member
{ "id": 1, "env_id": "mars", "name": "Cmdr. Vega", "role": "commander",
  "share_behavioral_details": false, "last_seen_at": "...", "liveness": "active" }

// MeasurementIn  (POST, en lote)
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
    "recommendations": [{ "id": "rec_bp_repeat", "text": "Repite en reposo en 15 min", "priority": 1 }],
    "escalation": { "level": "self", "target_role": "self", "mode": "autonomous",
                    "delay_s": 840, "message": "...", "protocol_id": "proto_bp_high" }
  }],
  "behavioral": { "status": "normal", "details_visible": true }   // privacidad
}

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
{ "id": "t_2026-11-14_measure_bp", "task_type": "measure_bp", "title": "Mide tu tensión",
  "points": 10, "due": "morning", "completed": false, "indicator_id": "bp_systolic" }

// GameState
{ "points": 340, "streak_days": 5, "badges": [{ "id": "early_bird", "name": "...", "earned_at": "..." }],
  "crew_points": 1820 }

// Intervention
{ "id": "int_box_breathing", "title": "Respiración en caja", "category": "stress",
  "system_id": "neuro_behavioral", "duration_min": 4, "steps": ["..."], "offline": true }
```

## Reglas que el front debe respetar
0. Ocultar vistas por rol es UX y no seguridad. El backend valida siempre. Un `401` nunca borra el outbox: se pide login y se reintenta.
1. **Nunca pintar en verde** `unknown`, `stale` ni `lost`. Para esos casos se usa el estilo gris con rayado.
2. Cada `POST` que crea datos lleva un `id` UUID generado en el cliente. Si falla, se guarda en el outbox y se reintenta.
3. La consola `/ground` muestra siempre la antigüedad del dato (`last_seen_at`, `delivered_at`) y el estado del enlace.
