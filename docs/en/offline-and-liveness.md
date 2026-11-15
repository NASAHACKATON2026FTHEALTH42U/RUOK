# Offline, no data loss and liveness

## 1. No outage loses data

### a) The link with Earth or external control goes down
Nothing is lost. Messages (alerts, escalations, replies) stay in the onboard server's outbox, in SQLite in persistent WAL mode, and are forwarded when the link comes back. See [alerts-and-escalation.md](alerts-and-escalation.md).

### b) The member's device loses its connection to the onboard server
- **Save locally first.** Every measurement, completed task, check-in answer or request for help is saved in **IndexedDB** (`frontend/src/offline/`) and only then is sending attempted.
- **Client-generated UUID** on every record. `POST`s are idempotent, so retrying never duplicates data.
- **Automatic sync** on reconnection: `online` event, retry with backoff and an indicator in the header ("3 pendientes de sincronizar", 3 pending sync).
- **No conflicts.** Data is only appended and never edited. Both `taken_at` (the moment of the measurement according to the server clock as known by the device, `serverNow()`) and `received_at` (the real time of arrival at the server) are stored. With the outbox, `taken_at` is when it was measured and `received_at` when it was synced.
- **Provisional traffic light.** The front end caches the indicator catalog and its ranges, and computes a preliminary status marked as "provisional". On sync, it is replaced by the server's full assessment.
- **SOS without a connection.** It is queued, *"No enviado. Avisa a la tripulación de viva voz"* (Not sent. Tell the crew out loud) is shown and the autonomous protocol, which is cached, is opened.
- **Case not covered in the MVP:** the device breaking before it syncs. For that, replication between crew devices is on the roadmap.

## 2. Absence of data ≠ OK
> If an astronaut collapses and their device stops sending, the system **must not** keep showing their last green status.

### Heartbeat and liveness
> **Phones:** when the screen is locked, the browser suspends the heartbeat and the status becomes `stale`. That is correct. To avoid false alarms during the presentation, the member can set the `sleep` activity, or the admin can pause liveness alerts in `/control` (`POST /control/liveness/pause`).

- The device sends `POST /members/{id}/heartbeat` every **15 s**, with `activity` set to `normal`, `eva` or `sleep`.
- The server computes liveness with the thresholds in `environment.liveness`:

| Liveness | Normal | EVA / risky activity | Scheduled sleep |
|---|---|---|---|
| `active` | last heartbeat < `stale_after_s` (5 min) | < 30 s | relaxed thresholds (×3) |
| `stale` | ≥ 5 min | ≥ 30 s | ≥ 15 min |
| `lost` | ≥ 15 min | ≥ 2 min | ≥ 45 min |

- In geriatrics, in addition, a missing **morning check-in** before a set time (for example, 10:00) puts the status in `stale`.

### Overall status
```
overall_status = worst(health_status, liveness_status)
  active → no effect
  stale  → at least "unknown" (grey)
  lost   → "critical" + no_contact alert
```
- The figure of a `stale` or `lost` member is shown **grey and hatched**, with the text *"Sin datos desde hace 12 min"* (No data for 12 min).
- **Per-indicator freshness:** each indicator has a `max_age_s`. If the data is older, the indicator becomes `unknown` and "Medir ahora" (Measure now) appears.

### "R U OK?" check-in
1. The member becomes `stale`, and their device (if still alive) shows a full screen: **"R U OK?"** with the buttons *Estoy bien* (I'm fine) / *Necesito ayuda* (I need help).
2. If there is no answer within `ruok_timeout_s`, or the status becomes `lost`, an alert with category `no_contact` and severity `critical` is created automatically.
   - It first goes to the **onboard crew** (`crew`), locally and instantly.
   - It is then escalated to `ground` through the link.
3. If the answer is "Necesito ayuda" (I need help), the SOS flow opens.

With just an app, it is impossible to tell "collapsed" apart from "the battery died". Both are treated as an emergency until someone confirms. Wearables with fall detection are on the roadmap.

## 3. The `/ground` console always shows the age of the data
- Each member shows **"último dato recibido hace X"** (last data received X ago) and the link status.
- With the link in `los`: *"Enlace caído desde las 14:02. Estado actual DESCONOCIDO, último conocido: …"* (Link down since 14:02. Current status UNKNOWN, last known: …), in grey and **never in green**.
- With delay (Mars): *"Estás viendo el estado de hace 14 min"* (You are seeing the status from 14 min ago).
- Only what the link has already delivered is visible.

## Mandatory tests before the freeze
- [ ] **Without internet** (router with no WAN), the whole demo script is completed with 2 or more phones on the local network.
- [ ] When **one phone's** Wi-Fi is turned off: the device shows as no contact in `/control`, its measurements stay in the outbox and are synced when it comes back (`sync.batch`).
- [ ] With the tablet disconnected from the server, 2 measurements are logged, it reconnects, and they are checked to sync without duplicates.
- [ ] The heartbeat of a member on EVA is stopped: it turns grey, "R U OK?" appears, there is a timeout and the `no_contact` alert reaches the crew and, after the ETA, the ground.
- [ ] With the link in `los`, an SOS stays queued and is delivered when the link comes back.
