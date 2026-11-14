# Perfiles de entorno

El **perfil de entorno** es el núcleo de RUOK. Es un JSON (`backend/app/data/environments.json`) que cambia los umbrales, el escalado, el retardo, la rutina, el vocabulario y el tema **sin tocar código**. El esquema completo está en [api-contract.md](api-contract.md#esquemas).

## Los 6 perfiles

| id | Nombre | Gravedad | Retardo (una vía) | Radiación | Escalera | Vocabulario |
|---|---|---|---|---|---|---|
| `iss` | Estación Espacial Internacional | 0 g (microgravedad) | ~0 s → `realtime` | media | self → crew → ground | astronauta / tripulación / flight surgeon |
| `moon` | Base lunar Artemis | 0,16 g | ~1,3 s → `realtime` | alta | self → crew → ground | astronauta / tripulación / flight surgeon |
| `mars` | Base marciana | 0,38 g | 4–24 min (demo: 840 s) → `autonomous` + `delayed` | alta | self → crew → ground | astronauta / tripulación / flight surgeon |
| `earth` | Analógico terrestre (control) | 1 g | 0 s | baja | self → crew → ground | participante / equipo / médico |
| `hospital` | Planta de hospital | 1 g | 0 s | — | self → nurse → doctor | paciente / planta / enfermería |
| `geriatric` | Residencia geriátrica | 1 g | 0 s | — | self → caregiver → doctor → family | residente / residencia / cuidador |

## Qué cambia cada perfil

- **`threshold_overrides`**: ajustan los rangos del catálogo. Por ejemplo:
  - En `geriatric`, el rango normal de tensión es más amplio y se añaden los indicadores de riesgo de caídas.
  - En `mars` y `moon`, son más estrictos el ejercicio mínimo diario (pérdida ósea) y la dosis acumulada.
- **`indicators`**: indicadores activos. La dosis de radiación solo aparece en el espacio; el riesgo de caídas y la hidratación tienen más peso en geriatría.
- **`comm_delay_s`**: decide `escalation.mode`.
  - Por debajo de 5 s se usa `realtime`.
  - Por encima, `delayed` con ETA, y además se muestra un **protocolo autónomo** mientras no llega la respuesta.
- **`escalation_ladder`**: los niveles que siguen las alertas automáticas y entre los que se puede elegir al escalar a mano.
- **`liveness`**: umbrales de heartbeat (normal, EVA, sueño) y el timeout del "R U OK?".
- **`routine`**: tareas diarias para la gamificación. Por ejemplo, el ejercicio resistivo en el espacio y el paseo o la hidratación en geriatría.
- **`vocabulary`** y **`theme`**: textos y aspecto visual (cielo marciano, regolito lunar, hospital claro…).
- **`mission`**: fechas de inicio y fin, para la barra de fase de misión y el aviso del "tercer cuarto".

## Estado de los datos (BE-03)

Los 6 perfiles están en `backend/app/data/environments.json` y los sirve `GET /environments`. Pendiente:
- **`threshold_overrides`:** solo está el ejemplo del contrato (`mars`: `bp_systolic.warning = [130, 140]`). El resto queda vacío hasta que CNT-01 rellene la tabla de umbrales de [sources.md](sources.md); no se inventan valores clínicos.
- **Riesgo de caídas (geriatría):** no hay todavía un indicador en el catálogo de BE-04. Cuando exista, se añade a `geriatric.indicators`.
- **Liveness:** los 6 perfiles usan los umbrales de [offline-and-liveness.md](offline-and-liveness.md) (5 min / 15 min; EVA 30 s). El ajuste de sueño (×3) lo aplica BE-12, no está en el perfil.

## Cómo añadir un entorno nuevo
1. Añadir un objeto a `environments.json` (validado por el schema Pydantic).
2. Añadir el tema en `frontend/src/environments/<id>.ts` (opcional: si falta, se usa el tema por defecto).
3. Añadir los members al seed (`backend/app/seed.py`).
