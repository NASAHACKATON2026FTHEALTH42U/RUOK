/** Textos en inglés del área «alerts» (FE-38): clave = texto en español tal cual aparece en el código. */
export const alerts: Record<string, string> = {
  // alertFormat.ts: categorías, severidades, estados, eventos y actores
  Síntoma: 'Symptom',
  'Malestar físico': 'Physical discomfort',
  'Necesito hablar': 'I need to talk',
  Emergencia: 'Emergency',
  'Sin contacto': 'No contact',
  'Indicador fuera de rango': 'Indicator out of range',
  Atención: 'Warning',
  Urgente: 'Urgent',
  Abierta: 'Open',
  Escalada: 'Escalated',
  Recibida: 'Acknowledged',
  Resuelta: 'Resolved',
  Creada: 'Created',
  Actualizada: 'Updated',
  'En cola del enlace': 'Queued on the link',
  Entregada: 'Delivered',
  'Recibida por el equipo': 'Acknowledged by the team',
  Mensaje: 'Message',
  sistema: 'system',
  member: 'member',
  'equipo de respuesta': 'response team',

  // sos.ts: categorías y urgencias del aviso, nombres de rol por defecto
  'Tengo un síntoma': 'I have a symptom',
  'Dolor, mareo, fiebre…': 'Pain, dizziness, fever…',
  'No me encuentro bien': "I don't feel well",
  'Canal confidencial': 'Confidential channel',
  'Necesito ayuda ya': 'I need help now',
  'Puede esperar': 'Can wait',
  autocuidado: 'self-care',
  equipo: 'team',
  'control externo': 'external control',
  enfermería: 'nursing',
  cuidador: 'caregiver',
  médico: 'doctor',
  familia: 'family',

  // caseFeedback.ts
  emergencia: 'emergency',
  crítico: 'critical',
  atención: 'warning',
  normal: 'normal',
  'sin datos': 'no data',
  'Nos alegra ver que estás mejor': "We're glad to see you're better",
  '{system} ha pasado de {from} a {to}. {Who} sigue revisando tu caso y cerrará el aviso cuando lo confirme.':
    '{system} has gone from {from} to {to}. {Who} is still reviewing your case and will close the alert once confirmed.',
  'Estamos revisando tu caso': "We're reviewing your case",
  '{Who} ha visto tu aviso y lo está revisando. Sigue las recomendaciones; si empeoras, pulsa SOS.':
    '{Who} has seen your alert and is reviewing it. Follow the recommendations; if you get worse, press SOS.',
  'Tu aviso ha llegado a {who}. Sigue las recomendaciones y vuelve a medirte; si empeoras, pulsa SOS.':
    'Your alert has reached {who}. Follow the recommendations and measure again; if you get worse, press SOS.',
  'Este sistema': 'This system',

  // ground.ts: banner del enlace
  'Datos a las {time} ({ago})': 'Data as of {time} ({ago})',
  'Enlace caído desde las {since}. Estado actual DESCONOCIDO; lo que ves es el último conocido. {asOf}.':
    'Link down since {since}. Current state UNKNOWN; you are seeing the last known state. {asOf}.',
  'Estás viendo el estado de hace {delay} (retardo del enlace). {asOf}.':
    'You are seeing the state from {delay} ago (link delay). {asOf}.',
  'Enlace en línea. {asOf}.': 'Link online. {asOf}.',

  // Alerts.tsx y EnvironmentAlerts.tsx
  Alertas: 'Alerts',
  'Las alertas que te ha entregado el enlace están en la':
    'The alerts the link has delivered to you are in the',
  consola: 'console',
  'Elige primero a quién quieres ver en': 'First choose who you want to see in',
  Automática: 'Automatic',
  Manual: 'Manual',
  'a {role}': 'to {role}',
  'No se han podido cargar las alertas.': 'Could not load the alerts.',
  Reintentar: 'Retry',
  'No se pudo actualizar: puede haber cambios que no se ven.':
    'Could not refresh: there may be changes you cannot see.',
  'No hay alertas.': 'No alerts.',
  'No hay alertas. En una emergencia, pulsa SOS; para lo demás, «Enviar aviso a control».':
    'No alerts. In an emergency, press SOS; for anything else, “Send alert to control”.',
  Abiertas: 'Open',
  'No hay alertas abiertas.': 'No open alerts.',
  'Alertas abiertas': 'Open alerts',
  'Resueltas ({n})': 'Resolved ({n})',
  Registro: 'Log',
  'Alertas resueltas': 'Resolved alerts',
  'Notificaciones ({n})': 'Notifications ({n})',
  Notificaciones: 'Notifications',
  Notificación: 'Notification',
  Importante: 'Important',
  Aviso: 'Warning',
  Información: 'Information',
  'De {name}': 'From {name}',
  'Detalle del aviso': 'Alert details',
  'No se han podido cargar las alertas de {crew}.': 'Could not load the alerts for {crew}.',
  'Alertas abiertas de {crew} a bordo · {n}. Toca una para ver su detalle.':
    'Open alerts for {crew} on board · {n}. Tap one to see its details.',
  'No hay alertas en {crew}.': 'No alerts in {crew}.',
  'Alertas abiertas de {crew}': 'Open alerts for {crew}',
  'Alertas resueltas de {crew}': 'Resolved alerts for {crew}',

  // AlertDetail.tsx
  'Protocolo completado': 'Protocol completed',
  '«{title}»': '“{title}”',
  'Guardado en el dispositivo: los puntos y el aviso llegarán al sincronizar.':
    'Saved on the device: the points and the notice will arrive when it syncs.',
  'Sin conexión con el servidor de a bordo: no se ha podido. Avisa de viva voz.':
    'No connection to the onboard server: it could not be done. Tell someone in person.',
  'El servidor lo ha rechazado: {error}': 'The server rejected it: {error}',
  'sin sesión': 'not signed in',
  'Alerta conductual activa. El detalle es confidencial (solo el canal de apoyo psicológico), salvo emergencia o si el member decide compartirlo.':
    'Active behavioural alert. The details are confidential (psychological support channel only), unless there is an emergency or the member chooses to share them.',
  'Destino:': 'Recipient:',
  '(nivel {n}) · creada {ago}': '(level {n}) · created {ago}',
  'Entregada a {role} a las {time}.': 'Delivered to {role} at {time}.',
  'Contactando con {role}…': 'Contacting {role}…',
  'Llegará a {role} en': 'It will reach {role} in',
  'Debería haber llegado (ETA {eta}); pendiente de confirmación del enlace.':
    'It should have arrived (ETA {eta}); awaiting confirmation from the link.',
  'Protocolo autónomo (mientras llega la respuesta)':
    'Autonomous protocol (while the response arrives)',
  'Escuchar protocolo': 'Listen to protocol',
  Hecho: 'Done',
  'Al marcar todos los pasos de un protocolo, suma puntos y queda anotado en la alerta.':
    'Ticking every step of a protocol earns points and is recorded on the alert.',
  'No hay pasos guardados para este sistema. Sigue las indicaciones de tu panel.':
    'There are no saved steps for this system. Follow the guidance on your dashboard.',
  'Escalar a': 'Escalate to',
  '(siguiente nivel)': '(next level)',
  Escalar: 'Escalate',
  'Marcar como recibida': 'Mark as acknowledged',
  Resolver: 'Resolve',
  Respuesta: 'Reply',
  'Responder (llega a bordo con el retardo del enlace)':
    'Reply (arrives on board with the link delay)',
  Enviar: 'Send',
  'Línea de tiempo': 'Timeline',
  'retardo {n} min': 'delay {n} min',

  // LiveAlertToast.tsx
  'Mensaje de control': 'Message from control',
  Entendido: 'Got it',
  Alerta: 'Alert',
  'Alerta escalada': 'Alert escalated',
  'Nueva alerta para ti': 'New alert for you',
  'Tu alerta ha cambiado': 'Your alert has changed',
  'Nueva alerta': 'New alert',
  Ver: 'View',

  // SosButton.tsx, SosDialog.tsx y SosEmergency.tsx
  'SOS: pedir ayuda de emergencia': 'SOS: request emergency help',
  'Enviar aviso a control': 'Send alert to control',
  'No se ha podido guardar en el dispositivo: {error}': 'Could not save on the device: {error}',
  'No enviado': 'Not sent',
  Cerrar: 'Close',
  Primero: 'First',
  'elige entorno y {member}': 'choose an environment and {member}',
  'Si es una emergencia, avisa ya de viva voz a {crew}.':
    'If it is an emergency, tell {crew} in person right now.',
  '¿Qué pasa?': "What's wrong?",
  'Confidencial: solo lo verá {who}.': 'Confidential: only {who} will see it.',
  'el equipo de apoyo psicológico': 'the psychological support team',
  '¿Cuánto urge?': 'How urgent is it?',
  '¿A quién avisar?': 'Who should be alerted?',
  'Mensaje (opcional)': 'Message (optional)',
  'Enviando…': 'Sending…',
  'Enviar aviso': 'Send alert',
  'Enviado a': 'Sent to',
  'Le llega al momento.': 'It reaches them instantly.',
  'Por el retardo de comunicación, le llegará en unos':
    'Because of the communication delay, it will reach them in about',
  '{n} min': '{n} min',
  '(hacia las {time}, hora del servidor)': '(around {time}, server time)',
  'Mientras tanto, sigue las indicaciones de tu panel.':
    'In the meantime, follow the guidance on your dashboard.',
  'No enviado. Avisa a {crew} de viva voz.': 'Not sent. Tell {crew} in person.',
  'No hay conexión con el servidor de a bordo. La petición está guardada en este dispositivo y se enviará sola en cuanto vuelva la conexión.':
    'There is no connection to the onboard server. The request is saved on this device and will be sent automatically as soon as the connection is back.',
  'Mientras tanto': 'In the meantime',
  'Alerta de ayuda enviada': 'Help alert sent',
  'Este dispositivo no sabe quién eres: inicia sesión para pedir ayuda desde aquí':
    "This device doesn't know who you are: sign in to request help from here",
  'Se enviará la alerta de ayuda en': 'The help alert will be sent in',
  'Se enviará la alerta de ayuda en {n} segundos si no la cancelas.':
    'The help alert will be sent in {n} seconds unless you cancel it.',
  Cancelar: 'Cancel',
  'Enviar ya': 'Send now',
  'Enviando la alerta de ayuda…': 'Sending the help alert…',
  'No se ha podido guardar la alerta en este dispositivo ({error}). Avisa ya de viva voz a {crew}.':
    'Could not save the alert on this device ({error}). Tell {crew} in person right now.',

  // Ground.tsx
  'Consola de {ground}': 'Console: {ground}',
  'Tu usuario no tiene entorno asignado.': 'Your user has no environment assigned.',
  'No se ha podido cargar la consola.': 'Could not load the console.',
  'entregada {ago}': 'delivered {ago}',
  'Sin conexión con el servidor: estado DESCONOCIDO, último conocido de las {time}.':
    'No connection to the server: state UNKNOWN, last known as of {time}.',
  '1 mensaje en cola': '1 message queued',
  '{n} mensajes en cola': '{n} messages queued',
  Desconocido: 'Unknown',
  'Último dato {ago}': 'Last data received {ago}',
  'Último dato nunca': 'No data received yet',
  'último conocido: {status}': 'last known: {status}',
  '{n} alertas abiertas': '{n} open alerts',
  '1 alerta abierta': '1 open alert',
  'No ha llegado ninguna alerta por el enlace.': 'No alerts have arrived over the link.',
  'Las que estén en cola aparecerán al entregarse.':
    'Queued ones will appear once they are delivered.',
  'Alertas entregadas': 'Delivered alerts',
  '{n} abiertas': '{n} open',
  'Alertas entregadas abiertas': 'Open delivered alerts',
  'Alertas entregadas resueltas': 'Resolved delivered alerts',
  'Detalle de la alerta': 'Alert details',
}
