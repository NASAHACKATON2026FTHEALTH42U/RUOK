# Offline, no pérdida de datos y liveness

## 1. Ningún corte pierde datos

### a) Se corta el enlace con la Tierra o el control externo
No se pierde nada. Los mensajes (alertas, escalados, respuestas) quedan en el outbox del servidor de a bordo, en SQLite en modo WAL y persistente, y se reenvían cuando vuelve el enlace. Ver [alerts-and-escalation.md](alerts-and-escalation.md).

### b) El dispositivo del member pierde conexión con el servidor de a bordo
- **Primero se guarda en local.** Cada medición, tarea completada, respuesta de check-in o petición de ayuda se guarda en **IndexedDB** (`frontend/src/offline/`) y después se intenta enviar.
- **UUID generado en el cliente** en cada registro. Los `POST` son idempotentes, así que reintentar nunca duplica datos.
- **Sincronización automática** al reconectar: evento `online`, reintento con backoff y un indicador en la cabecera ("3 pendientes de sincronizar").
- **Sin conflictos.** Los datos solo se añaden y nunca se editan. Se guarda `taken_at` (hora del dispositivo) y `received_at` (hora del servidor).
- **Semáforo provisional.** El front tiene en caché el catálogo de indicadores y sus rangos, y calcula un estado preliminar marcado como "provisional". Al sincronizar, lo sustituye la evaluación completa del servidor.
- **SOS sin conexión.** Se encola, se muestra *"No enviado. Avisa a la tripulación de viva voz"* y se abre el protocolo autónomo, que está en caché.
- **Caso no cubierto en el MVP:** que se rompa el dispositivo antes de sincronizar. Para eso, en el roadmap está la replicación entre los dispositivos de la tripulación.

## 2. Ausencia de datos ≠ OK
> Si un astronauta colapsa y su dispositivo deja de enviar, el sistema **no puede** seguir mostrando su último estado verde.

### Heartbeat y liveness
- El dispositivo envía `POST /members/{id}/heartbeat` cada **15 s**, con `activity` igual a `normal`, `eva` o `sleep`.
- El servidor calcula el liveness con los umbrales de `environment.liveness`:

| Liveness | Normal | EVA / actividad de riesgo | Sueño programado |
|---|---|---|---|
| `active` | último heartbeat < `stale_after_s` (5 min) | < 30 s | umbrales relajados (×3) |
| `stale` | ≥ 5 min | ≥ 30 s | ≥ 15 min |
| `lost` | ≥ 15 min | ≥ 2 min | ≥ 45 min |

- En geriatría, además, la falta del **check-in matinal** antes de una hora fijada (por ejemplo, las 10:00) pone el estado en `stale`.

### Estado global
```
overall_status = peor(estado_salud, estado_de_liveness)
  active → no afecta
  stale  → mínimo "unknown" (gris)
  lost   → "critical" + alerta no_contact
```
- La figura de un member `stale` o `lost` se ve **en gris con rayado**, con el texto *"Sin datos desde hace 12 min"*.
- **Frescura por indicador:** cada indicador tiene `max_age_s`. Si el dato es más antiguo, el indicador pasa a `unknown` y aparece "Medir ahora".

### Check-in "R U OK?"
1. El member pasa a `stale`, y su dispositivo (si sigue vivo) muestra una pantalla completa: **"R U OK?"** con los botones *Estoy bien* / *Necesito ayuda*.
2. Si no responde en `ruok_timeout_s`, o el estado pasa a `lost`, se crea automáticamente una alerta de categoría `no_contact` y severidad `critical`.
   - Primero va a la **tripulación a bordo** (`crew`), en local y al instante.
   - Después se escala a `ground` por el enlace.
3. Si responde "Necesito ayuda", se abre el flujo SOS.

Con solo una app no se puede distinguir entre "colapsó" y "se le acabó la batería". Las dos se tratan como emergencia hasta que alguien confirme. En el roadmap están los wearables con detección de caídas.

## 3. La consola `/ground` siempre indica la antigüedad del dato
- Cada member muestra **"último dato recibido hace X"** y el estado del enlace.
- Con el enlace en `los`: *"Enlace caído desde las 14:02. Estado actual DESCONOCIDO, último conocido: …"*, en gris y **nunca en verde**.
- Con retardo (Marte): *"Estás viendo el estado de hace 14 min"*.
- Solo se ve lo que el enlace ya ha entregado.

## Pruebas obligatorias antes de la congelación
- [ ] Con el wifi apagado, se completa el guion de demo entero.
- [ ] Con la tablet desconectada del servidor, se registran 2 mediciones, se reconecta y se comprueba que se sincronizan sin duplicados.
- [ ] Se detiene el heartbeat de un member en EVA: pasa a gris, aparece "R U OK?", hay timeout y la alerta `no_contact` llega a la tripulación y, después de la ETA, a tierra.
- [ ] Con el enlace en `los`, un SOS queda en cola y se entrega al volver el enlace.
