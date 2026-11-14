# Guion de demo (~3 min)

**Preparación (5 min antes):**
- `POST /demo/reset`;
- wifi apagado;
- dos pestañas abiertas: la app del astronauta y `/ground` a pantalla partida.

| # | Tiempo | Qué se muestra | Qué se dice |
|---|---|---|---|
| 1 | 0:00 | Slide con el problema | Los 5 peligros del HRP. En Marte no hay médico en tiempo real: hay 14 minutos de silencio. |
| 2 | 0:20 | **ISS**: dashboard en verde, clic en el corazón | La figura explica cada sistema, cómo le afecta el espacio y qué medir. |
| 3 | 0:45 | Cambio a **Marte** (tema, retardo de 14 min). Escenario `mars_sleep_bp` | El mismo motor con otro perfil. Mal sueño y tensión alta: el cardio pasa a ámbar y el neuro-conductual a rojo. |
| 4 | 1:05 | Alerta con **protocolo autónomo** y cuenta atrás de la ETA. En `/ground` aún no aparece | El escalado depende del retardo. Mientras tanto, el astronauta sabe qué hacer. |
| 5 | 1:25 | Enlace en **LOS**, se pulsa **SOS**, la alerta queda "en cola". Se vuelve al enlace y se hace fast-forward: llega a `/ground` | Store-and-forward: no se pierde nada. |
| 6 | 1:50 | **EVA sin contacto**: la figura pasa a gris, aparece "R U OK?", nadie responde y salta la alerta a la tripulación | Sin datos no es "todo bien". Esto salva vidas. |
| 7 | 2:15 | Check-in diario y misión completada: puntos, racha e insignia (opcional: un juez hace el **PVT**) | Rutina y aislamiento, con gamificación cooperativa. |
| 8 | 2:35 | Cambio a **residencia geriátrica** | Mismo producto en la Tierra: residentes, cuidadores, soledad y caídas. |
| 9 | 2:50 | Slide de roadmap y disclaimer | Wearables, rPPG, IA a bordo. Todo esto funciona **sin internet**: el wifi lleva apagado toda la demo. |

## Plan B
1. Si el back cae, el front cambia a mocks (conmutador) y la demo sigue igual.
2. Si el portátil falla, se pone el vídeo grabado de la demo (`presentation/demo.mp4`).
3. Hay un segundo portátil con el build local ya arrancado.

## Criterios del jurado y dónde se cubren
| Criterio | Paso |
|---|---|
| Impacto | 8 (Tierra) y 3–6 (espacio) |
| Creatividad | 3–6 (perfiles, retardo, liveness) |
| Validez | 2 (contenido HRP con fuentes) |
| Relevancia | Responde a las 5 preguntas del enunciado ([vision-and-scope.md](vision-and-scope.md)) |
| Presentación | Historia en directo y "wifi apagado" |
