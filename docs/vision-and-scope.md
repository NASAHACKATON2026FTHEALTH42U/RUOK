# Visión y alcance

## El reto
La NASA pide una **herramienta visual** que ayude a los astronautas a **evaluar su propia salud** durante una misión y que les dé **orientación** sobre tratamientos y mejoras. Tiene que responder a cinco preguntas:
- qué se puede medir en el espacio;
- por qué hace falta cada examen;
- cómo afectan los peligros del vuelo espacial a cada indicador;
- cuándo un resultado requiere la atención de la tripulación o de los flight surgeons de tierra;
- qué acciones previenen una situación crítica.

El Human Research Program (HRP) identifica **5 peligros**:

| Peligro | Efectos sobre la salud | Cómo lo cubre RUOK |
|---|---|---|
| Radiación | Cáncer, sistema nervioso central, cataratas | Dosis acumulada (dosímetro) y halo de radiación en la figura |
| Aislamiento y confinamiento | Ánimo, sueño, cohesión del equipo, rendimiento cognitivo | [Módulo conductual](behavioral-health.md) |
| Distancia a la Tierra | Retardo de comunicaciones, autonomía médica | Escalado según el retardo y guía autónoma ([alertas](alerts-and-escalation.md)) |
| Campos de gravedad | Pérdida ósea y muscular, fluidos, SANS (síndrome neuro-ocular), cardiovascular | Indicadores y umbrales ajustados por gravedad ([entornos](environments.md)) |
| Entorno cerrado hostil | Sistema inmune, CO₂, microbiología | Temperatura, síntomas e indicadores inmunes |

## Idea central
> La misma plataforma, el mismo motor de reglas y la misma interfaz sirven en Marte (con 4–24 minutos de retardo, 14 en la demo, y sin médico), en la Luna, en la ISS y en una residencia de mayores en la Tierra. Lo que cambia es el **perfil de entorno**.

## Diferenciadores
1. **Cuerpo humano clicable.** Cada sistema (cardio, musculoesquelético, inmune, metabólico, neuro-conductual, ojos) se colorea según su estado; la radiación se muestra como un halo. Al hacer clic se ven su función, los riesgos y las acciones recomendadas.
2. **Gamificación y rutina cooperativa.** Misiones diarias, rachas, insignias y puntos de tripulación (no compiten entre ellos).
3. **Entornos intercambiables.** El espacio y la Tierra (hospital, geriatría) muestran el impacto dual de la herramienta.
4. **Local-first y seguro ante fallos.** No se pierden datos, un estado sin datos recientes es "desconocido" (nunca verde) y existe el check-in "R U OK?" cuando alguien deja de responder.

## Alcance del MVP
1. Selector de entorno, que cambia el tema, los umbrales, el escalado, las tareas y el vocabulario.
2. Dashboard con cuerpo SVG clicable y semáforo por sistema e indicador, más un panel de detalle por sistema.
3. Registro guiado de mediciones con instrucciones paso a paso:
   - frecuencia cardiaca, tensión, SpO₂, glucosa y temperatura;
   - sueño, ánimo, ejercicio, hidratación y peso;
   - dosis de radiación.
4. Gráficas de 7 y 30 días con las bandas de umbral sombreadas.
5. Motor de evaluación: umbrales con ajustes por entorno, tendencias, línea base personal, frescura de datos, recomendaciones y escalado.
6. Alertas automáticas y botón **SOS** manual (y avisos a control con más detalle), con un enlace simulado con la Tierra que aplica el retardo del entorno.
7. Heartbeat y check-in "R U OK?", con alerta de "sin contacto".
8. Funcionamiento sin conexión: outbox en el dispositivo y sincronización idempotente.
9. Módulo de aislamiento: check-in diario, intervenciones, "Necesito hablar" y privacidad.
10. Gamificación: misiones diarias, puntos, rachas e insignias.
11. Consola `/ground` (flight surgeon o enfermería) con el estado "as-of".
12. Datos sintéticos de 30 días y escenarios de demo deterministas.
13. **Login local y roles**: member, medic, commander, responder, psych y admin, con acceso por vistas ([auth-and-roles.md](auth-and-roles.md)).
14. **Multi-dispositivo en red local:** cada usuario en su móvil, **centro de control** (`/control`) con todo el flujo de datos en vivo (SSE) y gestión, y QR para unirse ([control-center-and-devices.md](control-center-and-devices.md)).

**P2 (si da tiempo):**
- mensajes a casa con retardo;
- kudos y misiones de tripulación;
- meditación guiada con paisajes sonoros (sustituye a la galería Earth view);
- rejilla de Amsler (SANS) *(sin issue: solo si sobra tiempo)*.

## Fuera de alcance (roadmap del pitch)
- Wearables reales y streaming continuo de constantes.
- Frecuencia cardiaca por cámara (rPPG) y análisis de imagen (ecografía).
- Asistente con IA (LLM local a bordo): diseño cerrado en [assistant.md](assistant.md) (issue FS-10).
- Replicación entre los dispositivos de la tripulación.
- SSO / 2FA, cifrado extremo a extremo y app nativa. *(El login local con roles **sí** entra en el MVP: [auth-and-roles.md](auth-and-roles.md).)*
- Certificación como dispositivo médico.
