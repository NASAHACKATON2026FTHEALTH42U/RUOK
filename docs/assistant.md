# Asistente local sobre un member (LLM pequeño a bordo)

> Diseño de referencia para la issue **FS-10** (roadmap, después de la demo). **No está implementado.** Es coherente con [local-first](architecture.md#principio-local-first), con [auth-and-roles.md](auth-and-roles.md) y con la previsión de FS-09 (`GET /members/{id}/forecast`).

## Qué es
Un modelo de lenguaje pequeño, ejecutado en el propio servidor de a bordo, al que se puede preguntar por un `member` (astronauta, paciente o residente según el entorno). Responde con **los datos registrados** de ese member y con **la previsión del modelo estadístico** (FS-09). **Solo habla de ese member**: no responde a código, cultura general ni a nada externo.

## Principios
1. **Local-first y datos de salud.** Nada sale de a bordo. Un modelo en la nube daría más calidad, pero necesita internet y envía los datos: descartado.
2. **El modelo elige y el código escribe.** El código redacta la *ficha* del member (frases en castellano con los datos que quien pregunta ya puede ver). El modelo solo entiende la pregunta y elige qué temas de la ficha la responden. Todo lo que se muestra lo ha escrito el código: el asistente no puede hablar de otra cosa ni inventar valores, aunque el modelo se equivoque.
3. **Sin datos = desconocido.** Un indicador caducado sale como «sin datos vigentes», sin valor.
4. **No es un dispositivo médico.** Aviso fijo en la pantalla; las respuestas no son un diagnóstico.
5. **Degradación elegante.** Sin modelo, lento, ocupado o con una respuesta inválida, se devuelve un **resumen automático** por palabras clave. Nunca un 503.

## Flujo

```
pregunta ─► permiso y member ─► ficha: frases escritas por el código, filtradas para quien pregunta
                                   │
                                   ├─► modelo local: recibe el índice de la ficha y la pregunta
                                   │       └─► JSON {tipo, temas}, ambos de lista cerrada
                                   │               ├─ fuera de tema ─► frase fija de rechazo
                                   │               └─ en tema ───────► el código muestra las frases de los temas elegidos
                                   │
                                   └─► sin modelo, lento, ocupado o JSON inválido ─► resumen automático por palabras clave
```

## Quién puede preguntar

| Rol | Puede preguntar sobre |
|---|---|
| `member` | Solo sobre sí mismo |
| `medic`, `commander`, `admin` | Los members de su entorno (admin: el entorno activo) |
| `responder`, `psych`, `family` | Nadie (403) |

Permiso nuevo `assistant:ask` con `allow_member`, el mismo patrón que `get_forecast` en `backend/app/routers/members.py`.

## Contrato (primero en `docs/api-contract.md`)
- `POST /api/v1/members/{member_id}/assistant`, cuerpo `AssistantQuestion {question}` (1–300 caracteres).
- Respuesta `AssistantAnswer {member_id, answer, kind, model, generated_at}`. `kind`:
  - `model`: frases de la ficha elegidas por el modelo local;
  - `summary`: resumen automático, sin modelo;
  - `out_of_scope`: frase fija de rechazo.
- Errores: 401, 403, 404, 422. **Nunca 503.**
- **No crea datos:** no se guarda ni la pregunta ni la respuesta y no se emite ningún evento (medic y commander ven por SSE todos los eventos de su entorno). Por eso no lleva UUID ni pasa por el outbox.

## La ficha y la privacidad (`backend/app/services/assistant.py`)
- `collect(session, member, viewer)` reutiliza lo que ya existe: `for_viewer(assess_member(...))`, `forecast_member(...)` por indicador, `alerts.list_for_member(...)`, el catálogo y el vocabulario del entorno.
- `render_sheet(data)` (función pura) devuelve líneas `{id, text}`:
  - perfil, estado global y última conexión;
  - una por indicador: valor, unidad, estado, antigüedad y su previsión;
  - alertas abiertas;
  - líneas de conjunto: «qué requiere atención» y «cambios previstos en 7 días».
- **El modelo no recibe la ficha entera, solo su índice:** qué temas hay y en qué estado están. Prompt corto y menos datos expuestos.
- **Privacidad conductual.** Los indicadores privados solo entran en la ficha si `can_view_behavioral(...)`. Si no, una línea dice que son privados y solo consta el estado agregado.
- **Alertas:** solo campos estructurados (gravedad, estado, categoría, sistema, antigüedad). Nunca `message`, `indicator_ids` ni eventos: pueden revelar detalles privados y son texto escrito por usuarios.
- Etiquetas y frases (copiadas de la interfaz: `status.ts`, `trend.ts`) en `backend/app/data/assistant.json`: configuración, no código. Horas con `clock.now()`.

## «Solo habla del member»: tres capas
Cada una se puede entregar por separado.

1. **Ficha y resumen automático (sin modelo).** Las frases que coinciden con la pregunta por palabras clave o, si no hay ninguna, el estado general.
2. **El modelo clasifica y elige (objetivo de FS-10).** Devuelve `tipo` (`ficha`, `consejo_medico`, `otra_persona`, `otro_tema`) y `temas` (qué líneas de la ficha). El código escribe la respuesta.
3. **Redacción libre (opcional, experimental).** El modelo reescribe las frases elegidas. Solo si la evaluación demuestra que no cambia cifras ni añade consejos; si una comprobación falla, se muestran las frases de la capa 2.

| Garantía con las capas 1 y 2 | Cómo se consigue |
|---|---|
| Solo habla del member | Todo el texto lo compone el código con frases de la ficha. El modelo solo puede devolver valores de listas cerradas: el esquema JSON de Ollama lo fuerza y el código lo vuelve a validar |
| No inventa valores | Ninguna cifra sale del modelo |
| No filtra datos privados ni de otras personas | El modelo no los recibe: el índice ya viene filtrado para quien pregunta |
| No oculta nada grave | Si hay indicadores en «Atención» o «Crítico», o alertas abiertas, la respuesta siempre lo dice |
| Rechaza el resto | Frases fijas según el `tipo`: fuera de tema («Solo puedo responder sobre los datos de {nombre}…»), otra persona, o consejo médico («No puedo dar diagnósticos ni tratamientos…») |
| Funciona sin modelo | Capa 1 |

Con un modelo tan pequeño lo que puede fallar es que elija temas poco relevantes o rechace una pregunta válida. No puede inventar nada ni hablar de otra cosa.

## Modelo e infraestructura
- `backend/app/services/llm.py`: cliente de Ollama con `urllib` (sin dependencias nuevas).
  - Variables `RUOK_LLM_URL`, `RUOK_LLM_MODEL` y `RUOK_LLM_TIMEOUT_S`. **Por defecto la URL está vacía: sin modelo**, también en los tests y en `export_mocks.py`, aunque haya un Ollama escuchando.
  - Solo URLs que resuelven a loopback o red privada, y sin proxy (`ProxyHandler({})`).
  - Una generación a la vez, sin bloquear: si está ocupado, resumen automático. Timeout y pausa tras un error.
  - Antes de llamar al modelo se cierra la sesión de BD. La pregunta y la respuesta no se escriben nunca en los logs.
  - Petición a `/api/chat` con formato de esquema JSON, `think: false`, `truncate: false` (sin recorte silencioso del prompt) y temperatura 0. Solo vale una respuesta con `done_reason: "stop"`.
  - El servidor no contacta con Ollama al arrancar y **nunca descarga modelos por su cuenta**.
- Candidatos (tamaño según el registro de Ollama; **la calidad se mide**):

| Modelo | Peso | Nota |
|---|---|---|
| `qwen3:1.7b` | 1,36 GB | Propuesta inicial: bueno clasificando, multilingüe, licencia Apache 2.0 |
| `gemma3:1b` | 0,81 GB | Alternativa si va lento. Su licencia limita los usos médicos: hay que citarlo |
| `granite3.3:2b` | 1,55 GB | Tercera opción: Apache 2.0, más lento |

  Se elige con la evaluación (acierto y latencia), no a ojo.
- **Por qué elegir temas y no redactar:** en una CPU sin GPU, leer una ficha entera y escribir un párrafo serían 15–35 s en la primera pregunta (estimación, sin medir). Eligiendo temas, el modelo lee un índice corto y genera una decena de tokens.
- El modelo se descarga una vez (como `npm ci`: el build puede usar internet, la ejecución no).
- **Docker:** servicio opcional `ollama` en `docker-compose.yml` con perfil `ai` y volumen propio. El puerto no se publica. Sin el perfil, todo funciona como ahora.

## Pantalla
- Página `/assistant` («Asistente»), copiando el esqueleto de `frontend/src/pages/HomeMessages.tsx`: solo hace scroll la lista; `AutoTextarea`, contador y botón.
- De quién se habla:
  - el member, siempre de sí mismo;
  - el personal elige con `MemberStrip` en la misma página o escribiendo el nombre en la pregunta (función pura `mentionedMember`). Si el nombre es ambiguo, no se envía nada;
  - una línea fija lo deja claro antes de enviar: «Se preguntará sobre: {nombre}».
- Chips de preguntas sugeridas, estado de espera con «Cancelar» y, en cada respuesta, cómo se ha hecho: «IA local · modelo», «Resumen automático» o «Fuera de tema».
- Aviso fijo en la página (en móvil el aviso general solo sale en «Más» y en el login): respuestas calculadas a bordo con los datos registrados, pueden contener errores, no son un diagnóstico ni un dispositivo médico. Vocabulario del entorno, nunca «astronauta» fijo.
- La conversación vive solo en la pestaña. Llamada directa (sin outbox), como `createUser` en `frontend/src/api/useUsers.ts`. Mock con el resumen automático generado por `backend/scripts/export_mocks.py`.

## Tests, evaluación y criterios de aceptación
- **Unitarios** (funciones puras): ficha, resumen por palabras clave, guarda de URL local.
- **API con el modelo simulado** (`monkeypatch.setattr(llm, "_post_json", ...)`):
  - modelo parado o respuesta inválida → `kind: summary`, nunca un error;
  - valores fuera de las listas cerradas → se descartan;
  - como commander, o como medic sin permiso, el cuerpo enviado al modelo no contiene ningún dato conductual privado;
  - el texto de una alerta escrito por un usuario nunca llega al modelo;
  - member sobre otro → 403; responder, psych y family → 403;
  - no se guarda nada (mismo número de filas en todas las tablas).
- Filas nuevas en `tests/test_contract.py` y `tests/test_permissions.py`. CI en verde sin servidor de modelos.
- `backend/scripts/assistant_eval.py` (fuera de la CI, como `forecast_study.py`): unas 130 preguntas con respuesta conocida, en castellano, catalán e inglés: datos del member, datos que faltan o son privados, fuera de tema, inyección, consejo médico y otras personas.
  - Umbrales: rechaza ≥ 95 % de lo fuera de tema, acepta ≥ 90 % de lo que es del tema y elige los temas correctos ≥ 85 %.
  - Latencia: mediana ≤ 8 s y p95 ≤ 15 s en la máquina de la demo.

## Orden de implementación
Contrato → capa 1 (ya se puede entregar, sin modelo) → capa 2 (cliente del modelo) → front y mocks → evaluación y elección de modelo → Docker → docs (`api-contract`, `auth-and-roles`, `architecture`, `sources`, `status`).

## Límites conocidos
- Las respuestas son frases de la ficha, no prosa libre (la prosa es la capa 3, opcional).
- Una pregunta, una respuesta: sin memoria de conversación.
- Un solo member por pregunta: nada de comparar tripulantes.
- Respuestas siempre en castellano, aunque se entiendan preguntas en otros idiomas.
