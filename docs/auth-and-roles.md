# Login y roles (control de acceso por vistas)

> Diseño de referencia para el componente 🔐 **Auth** (issues FS-06, BE-25…BE-27 y FE-27…FE-28). Es coherente con [local-first](architecture.md#principio-local-first) y con [offline-and-liveness.md](offline-and-liveness.md).

## Principios
1. **Autenticación 100 % local.** El servidor de a bordo valida los usuarios contra SQLite. No hay OAuth ni proveedores externos: en Marte no hay internet.
2. **El backend es la autoridad.** El front oculta las vistas y los botones según el rol, pero **cada endpoint comprueba el rol y la propiedad del dato**. Ocultar algo en la UI no es seguridad.
3. **El SOS nunca depende del login.** El botón *SOS*, el modal "R U OK?" y el protocolo autónomo están disponibles **también con la sesión caducada o bloqueada**.
4. **Sin pérdida de datos por sesión.** Si el token caduca estando offline, el outbox **conserva todo**, se pide volver a iniciar sesión y después se sincroniza. Un 401 nunca borra datos.
5. **Roles genéricos y vocabulario por entorno.** Igual que `members`, los roles son genéricos y el nombre visible sale de `environment.vocabulary`.

## Roles

| Rol (`role`) | Espacio (ISS / Luna / Marte) | Hospital | Geriatría | Ámbito |
|---|---|---|---|---|
| `member` | Astronauta | Paciente | Residente | Solo sus datos |
| `medic` | Oficial médico de a bordo (CMO) | Enfermería | Cuidador/a | Todos los members de **su entorno** |
| `commander` | Comandante | Supervisión de planta | Coordinación de la residencia | Su entorno: estado agregado, tripulación, alertas |
| `responder` | Flight surgeon (tierra) | Médico/a | Médico/a | Consola `/ground` de su entorno (solo lo entregado por el enlace) |
| `psych` | Psicólogo/a BHP (tierra) | Psicología | Psicología | Igual que `responder`, más el **canal confidencial** y los detalles conductuales |
| `family` *(P2)* | — | Familiar | Familiar | Estado agregado de **un** member y mensajes |
| `admin` | Operador / centro de control | Administración | Administración | Global: **centro de control** (`/control`), demo, cambio de entorno, usuarios |

- Cada usuario pertenece a **un entorno** (`env_id`). Solo `admin` es global y puede cambiar de entorno.
- Un usuario con rol `member` está vinculado 1:1 a su `member` (`member_id`).

## Matriz de acceso a vistas

✅ acceso completo · 👁️ solo lectura · 🔒 sin acceso · *propio* = solo sus datos

| Vista / acción | member | medic | commander | responder | psych | family (P2) | admin |
|---|---|---|---|---|---|---|---|
| Login | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SOS** (también **sin sesión**) y avisos a control | ✅ | ✅ | ✅ | — | — | ✅ | — (es control: crea alertas y notificaciones desde Simulación) |
| Selector de entorno | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| Dashboard (cuerpo + semáforo) | ✅ propio | ✅ todos los del entorno | 👁️ todos | 🔒 (usa `/ground`) | 🔒 | 👁️ agregado de su familiar | ✅ |
| Registrar mediciones | ✅ propio | ✅ para cualquier member (asistida) | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| Check-in diario conductual y test PVT | ✅ propio | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| Historial y gráficas | ✅ propio | ✅ entorno | 👁️ entorno | 👁️ entregado | 👁️ entregado | 🔒 | ✅ |
| Detalles conductuales | ✅ propio | solo si comparte o hay emergencia | agregado anónimo | solo si comparte o hay emergencia | ✅ | 🔒 | ✅ |
| Alertas: ver | ✅ propias | ✅ entorno | 👁️ entorno | ✅ entregadas | ✅ entregadas (+ psicológicas) | 👁️ de su familiar | ✅ |
| Alertas: escalar | ✅ propias | ✅ | ✅ | — | — | 🔒 | ✅ |
| Alertas: reconocer / resolver | 🔒 | ✅ nivel `crew` | ✅ nivel `crew` | ✅ nivel `ground` | ✅ psicológicas | 🔒 | ✅ |
| Misiones, puntos e insignias | ✅ propio | 👁️ | 👁️ tablero de la tripulación | 🔒 | 🔒 | 🔒 | ✅ |
| Mensaje a casa *(P2)* | ✅ | 🔒 | 🔒 | 🔒 | 🔒 | ✅ (recibe/responde) | ✅ |
| Consola `/ground` | 🔒 | 🔒 | 🔒 | ✅ | ✅ | 🔒 | ✅ |
| Privacidad (`share_behavioral_details`) | ✅ propio | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 |
| **Centro de control** (`/control`: panorama, flujo de eventos, dispositivos, gestión) | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| Stream de eventos en vivo (SSE) | propios | su entorno | su entorno | solo entregados | solo entregados | 🔒 | todo |
| Panel de demo (`/demo/*`, enlace, fast-forward) | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| Gestión de usuarios *(P1, FS-07; rol `family` P2)* | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |

La matriz vive en código en **un único sitio** por lado: `backend/app/auth/permissions.py` y `frontend/src/auth/permissions.ts`, generado o espejo del de backend. Los tests recorren la matriz completa.

## Autenticación

| Método | Para quién | Cómo |
|---|---|---|
| **Usuario + contraseña** | Todos | `POST /auth/login`. Hash **bcrypt**. |
| **PIN rápido (4–6 dígitos)** | `member`, `medic` en tablets compartidas | `POST /auth/pin` con `{username, pin}`. Se bloquea 5 min tras 5 fallos. **La pantalla de login ya no lo ofrece** (solo usuario y contraseña); el endpoint sigue en el backend. |
| **Selector de usuarios demo** | Solo en la demo (`DEMO_MODE=true`) | Botones en la pantalla de login con los usuarios sembrados **del entorno elegido** (por defecto la misión espacial, Marte) y el operador global. Entran con la contraseña de demo `ruok-<env>`. |

**Sesión:**
- Token **JWT HS256** firmado con una clave local. La clave se genera en el primer arranque y se guarda en `app_state`. También se puede pasar en `RUOK_JWT_SECRET`.
- Payload: `{sub: user_id, role, env_id, member_id, exp}`. Caduca a las **12 h**, configurable.
- El front guarda `{token, user, exp}` en el store `kv` de IndexedDB (clave `auth`) y lo envía en `Authorization: Bearer <token>`.
- **Cerrar sesión** borra `kv.auth` pero **no el outbox**: los datos pendientes se envían al volver a entrar.

**Errores:**
- `401` significa token ausente, inválido o caducado. El front muestra el login sin perder el estado.
- `403` significa que el rol no tiene permiso o que el dato no es suyo.

**SOS sin sesión:**
- `POST /members/{id}/alerts` acepta peticiones **sin token** solo si `category = emergency`.
- El `member_id` sale del último usuario recordado en el dispositivo (`kv.last_member_id`).
- La alerta se marca `authenticated: false` y el panel de alertas lo muestra.

## Impacto en el resto del sistema
- **Contrato** ([api-contract.md](api-contract.md#autenticación-y-roles)): todos los endpoints salvo `/health`, `/auth/*` y el SOS de emergencia requieren `Authorization`.
- **Modelo de datos** ([data-model.md](data-model.md)): tabla `user_account` y clave `auth` en IndexedDB `kv`.
- **Heartbeat:** solo lo envía un `member` autenticado. La ruta es `/members/{member_id}/heartbeat`, y el backend comprueba que el `member_id` de la ruta coincide con el del token (403 si no).
- **`/ground`:** acceso solo para `responder`, `psych` y `admin`.
- **Panel de demo y centro de control (`/control`):** solo `admin`. Ver [control-center-and-devices.md](control-center-and-devices.md).
- **SSE:** el stream de eventos se filtra en el servidor según el rol del token.
- **Privacidad:** el filtro conductual usa el rol (`psych` ve los detalles; el resto, solo si el member comparte o hay emergencia).

## Usuarios demo (seed)
Por cada entorno:
- 3–4 `member`;
- 1 `medic`;
- 1 `commander`;
- 1 `responder`;
- 1 `psych`.

Además hay un `admin` global. En geriatría y hospital se añade 1 `family` (P2).

- Las contraseñas de demo son del tipo `ruok-<env>` y el PIN es `1234`. Son **solo para la demo**: con `DEMO_MODE=false` el seed no crea usuarios con contraseña conocida.

## Fuera de alcance (roadmap)
- SSO o directorio de la agencia.
- 2FA.
- Cifrado en reposo de SQLite e IndexedDB.
- Auditoría completa de accesos.
- Rotación de claves.
