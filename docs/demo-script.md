# Guion de demo (~3 min)

**Preparación (15 min antes)**. Ver el checklist en [control-center-and-devices.md](control-center-and-devices.md#6-montaje-de-la-red-para-la-demo).
- **Red local sin internet:** router de viaje sin WAN, con el portátil-servidor en IP fija (por ejemplo, `192.168.8.10`).
- `POST /demo/reset` y pausar las alertas de liveness hasta el paso 6 (`/control`).
- **Dispositivos:**

| Dispositivo | Usuario (rol) | Vista |
|---|---|---|
| 📱 Móvil A | Cmdr. Vega, Marte (`member`) | Dashboard del astronauta |
| 📱 Móvil / tablet B | Oficial médico, Marte (`medic`) | Lista de members y alertas |
| 💻 Proyector, mitad izquierda | Operador (`admin`) | **Centro de control** `/control` |
| 💻 Proyector, mitad derecha | Flight surgeon (`responder`) | `/ground` |
| 🧾 QR impreso | Para el juez | Se une como member demo |

| # | Tiempo | Qué se muestra | Qué se dice |
|---|---|---|---|
| 1 | 0:00 | Slide con el problema | Los 5 peligros del HRP. En Marte no hay médico en tiempo real: hay 14 minutos de silencio. |
| 2 | 0:20 | Operador → **Centro de control** de la ISS (entorno elegido en el selector de la barra lateral). Clic en un member → cuerpo → corazón | Un único servidor de a bordo, varios dispositivos. La figura explica cada sistema, cómo le afecta el espacio y qué medir. |
| 3 | 0:45 | Entorno **Marte**. **Simulación** → escenario «Mal sueño y tensión al alza» y, en el **móvil A**, medición paso a paso de la tensión con el teclado en pantalla. En el Centro de control aparece al instante | El mismo motor con otro perfil. El cardio pasa a ámbar y el neuro-conductual a rojo. |
| 4 | 1:05 | Móvil A: alerta con **protocolo autónomo** y ETA de 14 min. `/ground` todavía no la ve | El escalado depende del retardo. Mientras tanto, el astronauta sabe qué hacer. |
| 5 | 1:25 | En **Simulación** se pone el enlace en **LOS** y se pulsa **SOS** en el móvil A (el aviso dice quién pide ayuda). La **tablet del médico recibe la alerta al instante** (nivel `crew`, local; vibra si el navegador lo permite por HTTP). `/ground`: en cola. Al volver el enlace se hace fast-forward y llega a `/ground` | La tripulación actúa ya; la Tierra se entera cuando llega. Store-and-forward: no se pierde nada. |
| 6 | 1:50 | El móvil A marca la actividad **EVA** y se **apaga su wifi** (EVA sin contacto). Con EVA el umbral es de 30 s (`stale`) y 2 min (`lost`): se adelanta el reloj en **Simulación** para no esperar. En el Centro de control el dispositivo pasa a perdido, la figura a gris y el médico recibe `no_contact`. Al volver el wifi, el outbox se sincroniza (`sync.batch`) | Sin datos no es "todo bien". Y lo que se midió sin conexión no se ha perdido. |
| 7 | 2:15 | **Un juez escanea el QR** (operador → Dispositivos), entra como member demo y hace el check-in o el **PVT** en su móvil. Aparece en el Centro de control y gana puntos. Desde **Simulación** se le envía una notificación y le salta al momento. Si hay tiempo: «Mensaje a casa» con el resumen de hoy | Rutina, aislamiento y gamificación cooperativa, en su propio móvil. |
| 8 | 2:35 | En el selector de la barra lateral se cambia a **residencia geriátrica** | Mismo producto en la Tierra: residentes, cuidadores, soledad y caídas. |
| 9 | 2:50 | Slide de roadmap y disclaimer | Wearables, rPPG, IA a bordo. Todo esto ha funcionado **sin internet**: el router no tiene salida. |

## Plan B
1. **Si la red local falla:** un solo portátil, con cada pestaña como un dispositivo (`?device=movil-vega`, `?device=tablet-medico`) a pantalla partida.
2. **Si el back cae:** abrir la app con `?mocks=1` (modo demo completo, banner "Datos de ejemplo"), o arrancar el front con `VITE_MOCK_FALLBACK=true` para que solo las lecturas caigan a mocks. Ver [`frontend/README.md`](../frontend/README.md#mocks-el-front-sin-backend-fs-04).
3. Si el portátil falla, se pone el vídeo grabado de la demo (en el Drive del equipo; los vídeos no van a git).
4. Hay un segundo portátil con el build local ya arrancado.

## Criterios del jurado y dónde se cubren
| Criterio | Paso |
|---|---|
| Impacto | 8 (Tierra) y 3–6 (espacio) |
| Creatividad | 3–6 (perfiles, retardo, liveness) |
| Validez | 2 (contenido HRP con fuentes) |
| Relevancia | Responde a las 5 preguntas del enunciado ([vision-and-scope.md](vision-and-scope.md)) |
| Presentación | Historia en directo con varios dispositivos, el juez participando con su móvil y "sin internet" |
