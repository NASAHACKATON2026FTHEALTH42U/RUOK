/** Textos en inglés del área «behavioral» (FE-38): clave = texto en español tal cual aparece en el código. */
export const behavioral: Record<string, string> = {
  // Voz guía (VoiceControls, voice.ts)
  'La voz guía está generada con IA (ElevenLabs).': 'The guide voice is AI-generated (ElevenLabs).',
  'Voz guía': 'Voice guide',
  Escuchar: 'Listen',
  'Escuchar instrucciones': 'Listen to instructions',
  Parar: 'Stop',
  'Parar la voz': 'Stop the voice',

  // Intervenciones (InterventionCard, InterventionPlayer)
  Empezar: 'Start',
  Cerrar: 'Close',
  Terminar: 'Finish',
  Hecho: 'Done',
  'Bien hecho. Puedes repetirla cuando lo necesites.':
    'Well done. You can repeat it whenever you need to.',
  'Ciclo {n} de {of}': 'Cycle {n} of {of}',
  'Quedan {n} segundos': '{n} seconds left',
  Seguir: 'Resume',
  Pausa: 'Pause',
  Siguiente: 'Next',
  'Pasa solo en 3 s si no pulsas': 'Moves on automatically in 3 s unless you tap',

  // Meditación (Meditation, soundscapes.ts)
  Meditación: 'Meditation',
  'Elige un paisaje sonoro y, si quieres, una meditación guiada. Puedes cambiar el sonido cuando quieras.':
    'Choose a soundscape and, if you like, a guided meditation. You can change the sound at any time.',
  'Paisaje sonoro': 'Soundscape',
  'Paisajes sonoros': 'Soundscapes',
  Océano: 'Ocean',
  'Olas lentas en la orilla': 'Slow waves on the shore',
  Lluvia: 'Rain',
  'Lluvia suave y constante': 'Soft, steady rain',
  Viento: 'Wind',
  'Una brisa que va y viene': 'A breeze that comes and goes',
  Bosque: 'Forest',
  'Hojas y pájaros a lo lejos': 'Leaves and distant birds',
  Hoguera: 'Campfire',
  'Un fuego que crepita': 'A crackling fire',
  Cuenco: 'Singing bowl',
  'Un tono cálido y sostenido': 'A warm, sustained tone',
  Sonando: 'Playing',
  Volumen: 'Volume',
  Temporizador: 'Timer',
  'Sin límite': 'No limit',
  'Este navegador no puede reproducir sonido.': 'This browser cannot play sound.',
  'Sonando: {name} · quedan {left}': 'Playing: {name} · {left} left',
  'Sonando: {name}': 'Playing: {name}',
  'Toca un paisaje para escucharlo.': 'Tap a soundscape to play it.',
  'Meditaciones guiadas': 'Guided meditations',
  'No se han podido cargar las meditaciones.': 'The meditations could not be loaded.',
  Reintentar: 'Retry',
  'Si vas a dormir, marca «Sueño» en Actividad: el sistema esperará más antes de preguntarte «R U OK?».':
    'If you are going to sleep, select “Sleep” in Activity: the system will wait longer before asking you “R U OK?”.',

  // Mensaje a casa (HomeMessages, homeMessages.ts)
  'Mensaje a casa': 'Message home',
  'no se ha podido preparar el resumen (sin conexión con el servidor)':
    'the summary could not be prepared (no connection to the server)',
  'No se sabe cómo está el enlace. Puedes escribir: el mensaje saldrá cuando se pueda.':
    'The link status is unknown. You can still write: the message will be sent when possible.',
  'Ahora no hay enlace con casa. Lo que escribas se queda en cola y sale en cuanto vuelva.':
    'There is no link with home right now. Anything you write is queued and sent as soon as it returns.',
  'Cada mensaje tarda {delay} en llegar, y la respuesta otro tanto en volver.':
    'Each message takes {delay} to arrive, and replies take just as long to come back.',
  'El enlace va en directo: los mensajes llegan al momento.':
    'The link is live: messages arrive instantly.',
  'Conversación con casa': 'Conversation with home',
  Conversación: 'Conversation',
  'Enlace con casa: {state}': 'Link with home: {state}',
  'Cargando la conversación…': 'Loading the conversation…',
  'No se ha podido cargar la conversación.': 'The conversation could not be loaded.',
  'Sin conexión con el servidor de a bordo: la conversación puede estar desfasada.':
    'No connection to the onboard server: the conversation may be out of date.',
  'Aún no has escrito a casa. Cuéntales cómo va el día.':
    'You have not written home yet. Tell them how your day is going.',
  Mensajes: 'Messages',
  'Tu mensaje': 'Your message',
  'Añadir un resumen': 'Add a summary',
  'Resumen de hoy': "Today's summary",
  'Resumen de la semana': "This week's summary",
  'Escribe a casa…': 'Write home…',
  'No se ha podido guardar: {error}': 'Could not save: {error}',
  'Enviando…': 'Sending…',
  Enviar: 'Send',
  Tú: 'You',
  Casa: 'Home',
  'Viaje del mensaje': 'Message journey',
  'Guardado en este dispositivo · saldrá al volver la conexión':
    'Saved on this device · will be sent when the connection returns',
  'No enviado: el servidor lo ha rechazado': 'Not sent: the server rejected it',
  'En cola · sin enlace': 'Queued · no link',
  'En tránsito · llega en {delay}': 'In transit · arrives in {delay}',
  'En tránsito · llegando': 'In transit · arriving',
  'Entregado en casa{at}': 'Delivered home{at}',
  'Recibido{at}': 'Received{at}',
  'Paso {n} de {of}': 'Step {n} of {of}',
  Inhala: 'Breathe in',
  Exhala: 'Breathe out',
  Mantén: 'Hold',
  Después: 'Next',
}
