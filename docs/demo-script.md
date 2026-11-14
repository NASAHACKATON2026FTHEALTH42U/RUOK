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
| 2 | 0:20 | **`/control`**: panorama de todos los entornos (ISS en verde). Clic en un member de la ISS → cuerpo → corazón | Un único servidor de a bordo, varios dispositivos. La figura explica cada sistema, cómo le afecta el espacio y qué medir. |
| 3 | 0:45 | **Móvil A (Marte)**: escenario `mars_sleep_bp` y registro de la tensión. En `/control` aparece `measurement.created` al instante | El mismo motor con otro perfil. El cardio pasa a ámbar y el neuro-conductual a rojo. |
| 4 | 1:05 | Móvil A: alerta con **protocolo autónomo** y ETA de 14 min. `/ground` todavía no la ve | El escalado depende del retardo. Mientras tanto, el astronauta sabe qué hacer. |
| 5 | 1:25 | En `/control` se pone el enlace en **LOS** y se pulsa **SOS** en el móvil A. La **tablet del médico vibra al instante** (nivel `crew`, local). `/ground`: en cola. Al volver el enlace se hace fast-forward y llega a `/ground` | La tripulación actúa ya; la Tierra se entera cuando llega. Store-and-forward: no se pierde nada. |
| 6 | 1:50 | Se **apaga el wifi del móvil A** (EVA sin contacto). En `/control` el dispositivo pasa a perdido, la figura a gris y el médico recibe `no_contact`. Al volver el wifi, el outbox se sincroniza (`sync.batch`) | Sin datos no es "todo bien". Y lo que se midió sin conexión no se ha perdido. |
| 7 | 2:15 | **Un juez escanea el QR**, entra como member demo y hace el check-in o el **PVT** en su móvil. Aparece en `/control` y gana puntos | Rutina, aislamiento y gamificación cooperativa, en su propio móvil. |
| 8 | 2:35 | En `/control` se cambia a **residencia geriátrica** | Mismo producto en la Tierra: residentes, cuidadores, soledad y caídas. |
| 9 | 2:50 | Slide de roadmap y disclaimer | Wearables, rPPG, IA a bordo. Todo esto ha funcionado **sin internet**: el router no tiene salida. |

## Plan B
1. **Si la red local falla:** un solo portátil, con cada pestaña como un dispositivo (`?device=movil-vega`, `?device=tablet-medico`) a pantalla partida.
2. **Si el back cae:** abrir la app con `?mocks=1` (modo demo completo, banner "Datos de ejemplo"), o arrancar el front con `VITE_MOCK_FALLBACK=true` para que solo las lecturas caigan a mocks. Ver `frontend/README.md#mocks`.
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
