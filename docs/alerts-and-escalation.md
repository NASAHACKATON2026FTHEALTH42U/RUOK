# Alertas y escalado

Las alertas pueden ser **automáticas** (las genera la evaluación) o **manuales** (el usuario pide ayuda). Las dos usan el mismo modelo, la misma escalera y el mismo enlace.

## Escalera por entorno
Se define en `environment.escalation_ladder`:
- Espacio: `self` → `crew` (tripulación / médico de a bordo) → `ground` (flight surgeon).
- Hospital: `self` → `nurse` → `doctor`.
- Geriatría: `self` → `caregiver` → `doctor` → `family`.

`self` y `crew` (y sus equivalentes en tierra) **se resuelven a bordo**, sin enlace. Los niveles externos (`ground`, `doctor`, `family`) salen por el **enlace simulado**.

El corte lo marca `environment.external_from_level`: el índice del primer nivel externo de la escalera (2 en los 6 entornos). Los niveles anteriores son de a bordo.

## Alertas automáticas
1. Cada `POST /measurements` (y cada cambio de liveness) recalcula el assessment.
2. Un sistema en `warning` crea una alerta de nivel `self`, con recomendaciones de autocuidado.
3. Se escala solo al siguiente nivel en estos casos:
   - `critical`;
   - `warning` que persiste o empeora (tendencia) más allá del tiempo que fije el entorno;
   - `no_contact` (ver [offline-and-liveness.md](offline-and-liveness.md)).
4. **Deduplicación.** Hay como máximo una alerta abierta por `member_id + system_id` (o por categoría). Si la situación empeora, la alerta se actualiza (`updated`) y no se crea otra.
5. Si la situación vuelve a `normal` de forma sostenida, la alerta se propone para resolver; no se cierra sola sin dejar rastro.

## Alertas manuales (SOS y avisos a control)
- El botón **SOS** está siempre visible y no tiene formulario: avisa de que **se enviará la alerta de ayuda si no se cancela en 3 s** y después la envía sola (`emergency`, al siguiente nivel de la escalera del entorno). También funciona sin sesión.
- Para lo que no es una emergencia está **"Enviar aviso a control"**, con un formulario. Se elige la categoría:
  - `symptom` (síntoma);
  - `physical` (malestar físico);
  - `psychological` ("Necesito hablar", que va por un canal **confidencial**);
  - `emergency`.
- También se elige la severidad y, si se quiere, un mensaje.
- Se puede elegir el destino y **saltarse niveles** (por ejemplo, ir directo a `ground`).
- Cualquier alerta automática tiene además un botón **"Escalar"**, que por defecto la sube al siguiente nivel.
- Si se pulsa SOS **sin conexión con el servidor de a bordo**, la alerta queda en el outbox del dispositivo y se muestra: *"No enviado. Avisa a la tripulación de viva voz"*, junto con el protocolo autónomo, que está en caché.

## Ciclo de vida
```
open ──▶ escalated ──▶ acknowledged ──▶ resolved
  │           ▲
  └───────────┘ (escalado automático o manual, puede repetirse)
```
Cada paso genera un `AlertEvent`: `created`, `updated`, `escalated`, `queued`, `delivered`, `acknowledged`, `message` o `resolved`. El front lo muestra como una línea de tiempo.

## Enlace simulado con el control externo (`services/comm_link.py`)
El diseño se inspira en las redes tolerantes a retardo (DTN), con **store-and-forward**:
- Cola **outbox/inbox** persistida en SQLite. Sobrevive a reinicios y **no se pierde nada**.
- Cada mensaje sale con `eta = sent_at + comm_delay_s` y pasa a `delivered` cuando el reloj de la demo llega a la ETA.
- Estados del enlace:
  - `online`: retardo prácticamente nulo.
  - `delayed`: retardo normal del entorno.
  - `los` (pérdida de señal): todo se encola y sale cuando vuelve el enlace.
- Las respuestas de tierra vuelven por la misma cola, con el mismo retardo.
- La consola `/ground` **solo ve lo entregado**.

### Modo de escalado según el nivel y el retardo
Las filas con retardo se aplican solo a los niveles **externos**.

| `comm_delay_s` | `escalation.mode` | UX |
|---|---|---|
| Cualquiera, si el nivel es **de a bordo** (`level < external_from_level`) | `realtime`, `delay_s` 0 | La tripulación o el personal del centro reciben la alerta al instante |
| < 5 s | `realtime` | "Contactando con el flight surgeon…" |
| ≥ 5 s | `delayed` | Cuenta atrás con la ETA |
| ≥ 60 s y severidad ≥ `critical` | `autonomous` + `delayed` | **Protocolo autónomo** paso a paso mientras llega la respuesta |

## Privacidad
- Las alertas `psychological` y los detalles conductuales solo los ve el responder de su canal (psicólogo/BHP).
- El resto de la consola ve "alerta conductual activa" sin detalle, salvo que el member haya activado `share_behavioral_details` o la severidad sea `emergency`.

## Escenarios de demo
- `mars_sleep_bp`: varios días de mal sueño y tensión alta. Sale una alerta automática en `self` y después escala a `ground` con ETA de 14 min y protocolo autónomo.
- SOS durante `los`: la alerta queda en la cola y se entrega al volver el enlace (con `fast-forward`).
