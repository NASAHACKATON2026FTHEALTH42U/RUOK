# Centro de control, multi-dispositivo y red local

> Diseño de referencia para los componentes 🛰️ **Control** y 📶 **Tiempo real**. Complementa [architecture.md](architecture.md), [auth-and-roles.md](auth-and-roles.md) y [offline-and-liveness.md](offline-and-liveness.md).

## 1. Idea
Cada usuario puede usar **su propio dispositivo** (móvil, tablet o portátil). Todos se conectan al **portátil que hace de servidor de a bordo** a través de una **red local sin internet**. Todo sigue corriendo en local.

```
          Wifi local: router de viaje o hotspot del portátil (SIN salida a internet)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ 📱 Astronauta (member)   ─┐                                              │
 │ 📱 Juez (member demo)    ─┤   HTTP + SSE    💻 Servidor de a bordo       │
 │ 📱 Oficial médico (medic)─┼──────────────►  FastAPI + SQLite + web app   │
 │ 💻 Flight surgeon /ground─┤                 http://192.168.x.x:8000      │
 │ 🖥️ Centro de control     ─┘                 (sirve también el frontend)  │
 └──────────────────────────────────────────────────────────────────────────┘
```

- Los dispositivos abren `http://<ip-del-servidor>:8000` en el navegador. **No se instala nada.**
- El **centro de control** muestra un **QR** con esa URL, para que cualquiera (incluido un juez) se una desde su móvil.
- Para ensayar sin móviles: **cada pestaña del navegador es un dispositivo** independiente (ver §4).

## 2. Centro de control (`/control`, rol `admin`)
Es la **vista global, en tiempo real y sin retardo** para operar y gestionar la aplicación. **No sustituye a `/ground`**:

| | `/ground` (flight surgeon / médico) | `/control` (operador / admin) |
|---|---|---|
| Propósito | Atención médica **realista** | Operación, gestión y demo |
| Datos | Solo lo **entregado por el enlace** (con retardo y LOS) | **Todo y al instante** |
| Privacidad | Filtro conductual según rol | Ve todo, porque es la herramienta de operación |
| Ámbito | Su entorno | Todos los entornos |

### Paneles
1. **Panorama global:** cada entorno, sus members con estado global, liveness, última medición y alertas abiertas.
2. **Flujo de datos en vivo:** stream de eventos con filtros por entorno, usuario, dispositivo y tipo:
   - `measurement.created`
   - `heartbeat`
   - `liveness.changed`
   - `alert.created` / `alert.escalated` / `alert.acknowledged` / `alert.resolved`
   - `link.queued` / `link.delivered` / `link.state_changed`
   - `sync.batch` (mediciones que llegan de un outbox tras estar sin conexión)
   - `auth.login` / `auth.failed`
   - `task.completed`
3. **Dispositivos:** `device_id`, usuario, tipo (móvil, tablet o escritorio), IP, última vez visto, última sincronización y **pendientes en su outbox**.
4. **Enlace con tierra:** estado de cada entorno (`online`, `delayed`, `los`) y cola de mensajes con su ETA.
5. **Métricas:** mediciones por hora, alertas abiertas por severidad, tiempo medio de respuesta a alertas y dispositivos activos.
6. **Gestión:**
   - **Usuarios y roles:** crear, desactivar y restablecer PIN.
   - **Entornos:** consultar la configuración. Es de **solo lectura en el MVP**; la edición de umbrales es P2.
   - **Demo:** escenarios, estado del enlace, fast-forward del reloj y reset.
   - **QR de conexión:** la URL del servidor en la red local.

## 3. Tiempo real entre dispositivos (SSE)
- **Server-Sent Events:** `GET /api/v1/events/stream`. Es una conexión HTTP que el servidor mantiene abierta. Es local, sencilla, funciona en todos los navegadores móviles y no necesita WebSockets.
- **Cada evento** se guarda en la tabla `event_log` (ver [data-model.md](data-model.md)) y se publica en el stream.
- **El servidor filtra según el rol del token:**
  - `admin` recibe todo.
  - `medic` y `commander` reciben los eventos de su entorno.
  - `member`, los suyos (y las respuestas de tierra cuando se entregan).
  - `responder` y `psych` reciben solo lo **entregado** por el enlace.
- **Reconexión:** el navegador reconecta solo, y se usa `Last-Event-ID` para no perder eventos. Si SSE falla, el front pasa a polling cada 5 s.
- Como `EventSource` no permite cabeceras, el token se envía como parámetro: `?token=<jwt>`. **Es aceptable en una red local** y está documentado como deuda técnica.
- **Ejemplo en vivo:** el astronauta pulsa SOS en su móvil → la tablet del médico muestra la alerta y vibra **al instante** → el centro de control ve `alert.created` → `/ground` la recibe **14 min después** (Marte, con el reloj acelerado).

## 4. Identidad de dispositivo y aislamiento
- **`device_id`:** UUID generado una vez y guardado en `localStorage` (hace falta conocerlo **antes** de abrir IndexedDB, porque decide el nombre de la base); además se copia al store `kv` de su base. Va en el heartbeat y en la cabecera `X-Device-Id` de cada petición. Implementado en `frontend/src/offline/device.ts` (FE-30).
- **Una base IndexedDB por dispositivo:** `ruok-<device_id>`. Cada base tiene su propio outbox, caché y sesión.
- **Varios dispositivos en una máquina** (ensayos o demo con un solo portátil):
  - El `device_id` de la pestaña se guarda en `sessionStorage`, que es distinto para cada pestaña.
  - El parámetro `?device=<nombre>` fija un dispositivo con nombre (por ejemplo, `?device=tablet-medico`). Su `device_id` es un UUID **determinista** derivado del nombre: el mismo nombre es siempre el mismo dispositivo.
  - `?device=tab` crea un dispositivo nuevo, distinto en cada pestaña.
  - La pestaña recuerda su dispositivo (en `sessionStorage`) al navegar o recargar.
  - Así dos pestañas no comparten sesión ni outbox.
- **Registro en el servidor:** tabla `device`. El heartbeat informa de `pending_outbox` y `last_sync_at`.

## 5. Red local: requisitos técnicos
| Tema | Decisión |
|---|---|
| Servidor accesible desde la red | `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Abrir el puerto en el firewall: `sudo ufw allow 8000/tcp`. |
| Front en desarrollo | `npm run dev -- --host` (Vite, puerto 5173). En la demo, FastAPI sirve `frontend/dist`, así que basta un puerto y no hay problemas de CORS. |
| **Sin HTTPS → no hay "contexto seguro"** | Al entrar por `http://192.168.x.x`, el navegador **no** ofrece `crypto.randomUUID()`, service workers (PWA), cámara ni vibración en algunos navegadores. **MVP:** UUID con `crypto.getRandomValues()` (sí disponible), sin service worker y con la vibración como mejora opcional. IndexedDB y SSE funcionan sin problema. *(Opcional, P2: HTTPS local con Caddy o mkcert, lo que obliga a instalar el certificado raíz en cada móvil.)* |
| Diseño | Las vistas de `member` y `medic` son **mobile-first**. `/ground` y `/control`, para pantalla grande o proyector. |
| Bloqueo de pantalla del móvil | El navegador suspende los temporizadores y el heartbeat se detiene, así que el estado pasa a `stale` y salta el "R U OK?". **Es el comportamiento correcto** y sirve en la demo. Para evitar falsas alarmas mientras se presenta, el member puede marcar la actividad `sleep` o el admin pausar el liveness desde `/control`. |
| Descubrimiento | `GET /api/v1/system/network-info` devuelve las IP de la red local del servidor, y el centro de control genera el QR (librería empaquetada, sin CDN). |

## 6. Montaje de la red para la demo
**Opción A (recomendada): router de viaje.**
1. Router sin cable WAN, o con la WAN desconectada: así no hay internet.
2. El portátil-servidor se conecta por wifi o por cable y se le reserva una **IP fija** en el router (por ejemplo, `192.168.8.10`).
3. Se imprime en papel el QR de `http://192.168.8.10:8000` como plan B.

**Opción B: hotspot del portátil (Ubuntu).**
1. Ajustes → Wi-Fi → "Activar punto de acceso", o bien `nmcli dev wifi hotspot ifname <wlan> ssid RUOK password <clave>`.
2. El servidor queda normalmente en `10.42.0.1`.
3. ⚠️ Algunas tarjetas wifi no permiten hotspot y conexión a la vez, y algunos móviles se desconectan de una red sin internet. **Hay que probarlo el sábado** (issue FS-08).

**Checklist antes de la presentación:**
- [ ] 2 o más móviles conectados y con sesión iniciada.
- [ ] Un SOS desde el móvil llega a la tablet del médico en menos de 2 s.
- [ ] El QR funciona con un móvil que no se había conectado antes.
- [ ] Con un móvil sin wifi: sus mediciones quedan en el outbox y se sincronizan al volver.
- [ ] El portátil no tiene suspensión automática y está enchufado.
