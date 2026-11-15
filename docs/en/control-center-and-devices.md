# Control center, multi-device and local network

> Reference design for the 🛰️ **Control** and 📶 **Real time** components. Complements [architecture.md](architecture.md), [auth-and-roles.md](auth-and-roles.md) and [offline-and-liveness.md](offline-and-liveness.md).

## 1. Idea
Each user can use **their own device** (phone, tablet or laptop). They all connect to the **laptop acting as the onboard server** through a **local network with no internet**. Everything still runs locally.

```
          Local Wi-Fi: travel router or laptop hotspot (NO internet uplink)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ 📱 Astronaut (member)    ─┐                                              │
 │ 📱 Judge (demo member)   ─┤   HTTP + SSE    💻 Onboard server            │
 │ 📱 Medical officer (medic)┼──────────────►  FastAPI + SQLite + web app   │
 │ 💻 Flight surgeon /ground─┤                 http://192.168.x.x:8000      │
 │ 🖥️ Control center        ─┘                 (also serves the frontend)   │
 └──────────────────────────────────────────────────────────────────────────┘
```

- Devices open `http://<server-ip>:8000` in the browser. **Nothing is installed.**
- The **control center** shows a **QR code** with that URL, so anyone (including a judge) can join from their phone.
- To rehearse without phones: **each browser tab is an independent device** (see §4).

## 2. Control center (`/control`, role `admin`)
It is the **global, real-time, zero-delay view** for operating and managing the application. **It does not replace `/ground`**:

| | `/ground` (flight surgeon / physician) | `/control` (operator / admin) |
|---|---|---|
| Purpose | **Realistic** medical care | Operations, management and demo |
| Data | Only what the **link has delivered** (with delay and LOS) | **Everything, instantly** |
| Privacy | Behavioral filter by role | Sees everything, because it is the operations tool |
| Scope | Its own environment | All environments |

> **Current status (Nov 15):** the control center was split into sections of the operator menu: **Centro de control** (Control center; `/control`: metrics, status of each member and live events), **Simulación** (Simulation; `/control/simulate`: custom alert or notification, triggered measurement, scenarios, link, contact watch and clock), **Usuarios** (Users; `/control/users`), **Dispositivos** (Devices; `/control/devices`, with the QR code) and **Registro** (Log; `/control/log`). Everything is limited to the environment (and the member, if one is chosen) of the single selector in the sidebar. Notifications (`notification.sent`) reach the member's phone instantly and stay in their Alerts history.

### Panels
1. **Global overview:** each environment, its members with their overall status, liveness, last measurement and open alerts.
2. **Live data flow:** event stream with filters by environment, user, device and type:
   - `measurement.created`
   - `heartbeat`
   - `liveness.changed`
   - `alert.created` / `alert.escalated` / `alert.acknowledged` / `alert.resolved`
   - `link.queued` / `link.delivered` / `link.state_changed`
   - `sync.batch` (measurements arriving from an outbox after being offline)
   - `auth.login` / `auth.failed`
   - `task.completed`
3. **Devices:** `device_id`, user, type (phone, tablet or desktop), IP, last seen, last sync and **items pending in its outbox**.
4. **Ground link:** status of each environment (`online`, `delayed`, `los`) and message queue with its ETA.
5. **Metrics:** measurements per hour, open alerts by severity, mean alert response time and active devices.
6. **Management:**
   - **Users and roles:** create and enable or disable.
   - **Environments:** view the configuration. It is **read-only in the MVP**; editing thresholds is P2.
   - **Demo:** scenarios, link state, clock fast-forward and reset.
   - **Connection QR:** the server URL on the local network.

## 3. Real time across devices (SSE)
- **Server-Sent Events:** `GET /api/v1/events/stream`. It is an HTTP connection that the server keeps open. It is local, simple, works in every mobile browser and does not need WebSockets.
- **Every event** is stored in the `event_log` table (see [data-model.md](data-model.md)) and published on the stream.
- **The server filters according to the token's role:**
  - `admin` receives everything.
  - `medic` and `commander` receive the events of their environment.
  - `member`, their own (and ground replies once they are delivered).
  - `responder` and `psych` receive only what the link has **delivered**.
- **Reconnection:** the browser reconnects on its own, and `Last-Event-ID` is used so no events are lost. If SSE fails, the front end falls back to polling every 5 s.
- Since `EventSource` does not allow headers, the token is sent as a parameter: `?token=<jwt>`. **This is acceptable on a local network** and is documented as technical debt.
- **Live example:** the astronaut presses SOS on their phone → the medic's tablet shows the alert and vibrates **instantly** → the control center sees `alert.created` → `/ground` receives it **14 min later** (Mars, with the accelerated clock).

## 4. Device identity and isolation
- **`device_id`:** UUID generated once and stored in `localStorage` (it must be known **before** opening IndexedDB, because it determines the database name); it is also copied to the `kv` store of its database. It is sent in the heartbeat and in the `X-Device-Id` header of every request. Implemented in `frontend/src/offline/device.ts` (FE-30).
- **One IndexedDB database per device:** `ruok-<device_id>`. Each database has its own outbox, cache and session.
- **Several devices on one machine** (rehearsals or a demo with a single laptop):
  - The tab's `device_id` is stored in `sessionStorage`, which is different for each tab.
  - The `?device=<name>` parameter pins a named device (for example, `?device=tablet-medico`). Its `device_id` is a **deterministic** UUID derived from the name: the same name is always the same device.
  - `?device=tab` creates a new device, different in each tab.
  - The tab remembers its device (in `sessionStorage`) when navigating or reloading.
  - This way two tabs never share a session or an outbox.
- **Registration on the server:** `device` table. The heartbeat reports `pending_outbox` and `last_sync_at`.

## 5. Local network: technical requirements
| Topic | Decision |
|---|---|
| Server reachable from the network | `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Open the port in the firewall: `sudo ufw allow 8000/tcp`. |
| Front end in development | `npm run dev -- --host` (Vite, port 5173). In the demo, FastAPI serves `frontend/dist`, so a single port is enough and there are no CORS issues. |
| **No HTTPS → no "secure context"** | When accessed via `http://192.168.x.x`, the browser does **not** provide `crypto.randomUUID()`, service workers (PWA), camera, or vibration in some browsers. **MVP:** UUIDs with `crypto.getRandomValues()` (which is available), no service worker, and vibration as an optional enhancement. IndexedDB and SSE work fine. *(Optional, P2: local HTTPS with Caddy or mkcert, which requires installing the root certificate on every phone.)* |
| Design | The `member` and `medic` views are **mobile-first**. `/ground` and `/control` are for a large screen or projector. |
| Phone screen lock | The browser suspends timers and the heartbeat stops, so the status becomes `stale` and the "R U OK?" prompt fires. **This is the correct behavior** and is useful in the demo. To avoid false alarms while presenting, the member can set the `sleep` activity or the admin can pause liveness from `/control`. |
| Discovery | `GET /api/v1/system/network-info` returns the server's local network IPs, and the control center generates the QR code (bundled library, no CDN). |

## 6. Network setup for the demo
**Option A (recommended): travel router.**
1. Router with no WAN cable, or with the WAN disconnected: that way there is no internet.
2. The server laptop connects via Wi-Fi or cable and is given a **fixed IP** reserved on the router (for example, `192.168.8.10`).
3. Print the QR code for `http://192.168.8.10:8000` on paper as a plan B.

**Option B: laptop hotspot (Ubuntu).**
1. Settings → Wi-Fi → "Turn On Wi-Fi Hotspot", or `nmcli dev wifi hotspot ifname <wlan> ssid RUOK password <clave>`.
2. The server is usually at `10.42.0.1`.
3. ⚠️ Some Wi-Fi cards do not allow a hotspot and a connection at the same time, and some phones disconnect from a network with no internet. **It must be tested on Saturday** (issue FS-08).

**Checklist before the presentation:**
- [ ] 2 or more phones connected and logged in.
- [ ] An SOS from a phone reaches the medic's tablet in under 2 s.
- [ ] The QR code works with a phone that had never connected before.
- [ ] With a phone off Wi-Fi: its measurements stay in the outbox and sync when it comes back.
- [ ] The laptop has automatic suspend disabled and is plugged in.
