/** Textos en inglés del área «shell» (FE-38): clave = texto en español tal cual aparece en el código. */
export const shell: Record<string, string> = {
  // ── Navegación (navigation.ts) ──
  Panel: 'Dashboard',
  Medir: 'Measure',
  Misiones: 'Missions',
  Alertas: 'Alerts',
  'Check-in diario': 'Daily check-in',
  'Test de vigilancia': 'Vigilance test',
  Historial: 'History',
  Meditación: 'Meditation',
  'Mensaje a casa': 'Message home',
  'Consola de {ground}': 'Console: {ground}',
  'Centro de control': 'Control center',
  Simulación: 'Simulation',
  Usuarios: 'Users',
  Dispositivos: 'Devices',
  Registro: 'Log',
  Entornos: 'Environments',
  Ajustes: 'Settings',
  Más: 'More',

  // ── Layout, cabecera y aviso médico ──
  'R U OK?: inicio': 'R U OK?: home',
  'Menú principal': 'Main menu',
  Secciones: 'Sections',
  Estado: 'Status',
  Principal: 'Main',
  'Prototipo de autoevaluación.': 'Self-assessment prototype.',
  'No es un dispositivo médico': 'Not a medical device',
  'ni sustituye el criterio de un profesional sanitario.':
    'and does not replace the judgment of a healthcare professional.',
  'Dispositivo: {name}': 'Device: {name}',
  'pestaña {id}': 'tab {id}',
  'Sol {n}': 'Sol {n}',
  'Día {n}': 'Day {n}',
  'R U OK? Salud en misión': 'R U OK? Mission health',
  'Salud en misión': 'Mission health',
  'Más abajo': 'More below',
  'Estado general': 'Overall status',
  'Página en construcción ({issue}).': 'Page under construction ({issue}).',
  'Página en construcción.': 'Page under construction.',

  // ── Semáforo (status.ts) ──
  Normal: 'Normal',
  Atención: 'Warning',
  Crítico: 'Critical',
  'Sin datos': 'No data',
  'Sin datos recientes': 'No recent data',
  'Sin contacto': 'No contact',

  // ── Enlace simulado (link.ts, LinkStatusChip) ──
  Desconocido: 'Unknown',
  'estado desconocido': 'unknown status',
  ' · {n} en cola': ' · {n} queued',
  'En línea': 'Online',
  'en línea': 'online',
  'con retardo · {delay}': 'delayed · {delay}',
  'Sin enlace': 'No link',
  'sin enlace (LOS) desde las {time}': 'no link (LOS) since {time}',
  'Enlace con {other}: {detail}': 'Link with {other}: {detail}',
  Enlace: 'Link',
  ': con {other}, {detail}': ': with {other}, {detail}',

  // ── Servidor y modo demo ──
  'Modo demo (sin servidor)': 'Demo mode (no server)',
  'Servidor conectado': 'Server connected',
  'Servidor sin conexión': 'Server offline',
  'Conectando…': 'Connecting…',
  'sin conexión': 'offline',
  'Sin conexión': 'Offline',
  'Sin conexión con el servidor de a bordo': 'No connection to the onboard server',
  'Sin conexión con el servidor de a bordo.': 'No connection to the onboard server.',
  'DATOS DE EJEMPLO · modo demo sin servidor': 'SAMPLE DATA · demo mode without server',
  'SERVIDOR SIN CONEXIÓN · mostrando datos de ejemplo (solo lectura; lo que registres se guarda para enviarlo)':
    'SERVER OFFLINE · showing sample data (read-only; anything you log is saved to send later)',
  'Salir del modo demo': 'Leave demo mode',

  // ── Ámbito y estado vacío ──
  Ámbito: 'Scope',
  Entorno: 'Environment',
  'Cargando…': 'Loading…',
  'Elige un entorno…': 'Choose an environment…',
  'Todo {crew}': 'All {crew}',
  'No hay nadie seleccionado. Elige a quién quieres ver en el selector de {member} (arriba de la barra lateral; en el móvil, en «Más») o mira el estado de todos en':
    'Nobody is selected. Choose who you want to see in the {member} selector (top of the sidebar; on mobile, under “More”) or check everyone’s status in',
  'No hay nadie seleccionado. Elige el entorno y {member} arriba de la barra lateral (en el móvil, en «Más»).':
    'Nobody is selected. Choose the environment and {member} at the top of the sidebar (on mobile, under “More”).',
  'Desde tierra, el estado de {crew} está en la': 'From the ground, the {crew} status is in the',
  consola: 'console',
  'No hay nadie seleccionado.': 'Nobody is selected.',

  // ── Vocabulario neutro sin entorno (store/environment.ts) ──
  persona: 'person',
  equipo: 'team',
  'control externo': 'external control',

  // ── Sincronización y outbox ──
  'Sincronizando…': 'Syncing…',
  '{n} pendientes · inicia sesión para enviar': '{n} pending · log in to send',
  '1 pendiente de sincronizar': '1 pending sync',
  '{n} pendientes de sincronizar': '{n} pending sync',
  'Ver lo rechazado y reintentarlo': 'See what was rejected and retry it',
  'Guardado en este dispositivo. Pulsa para reintentar el envío ahora.':
    'Saved on this device. Tap to retry sending now.',
  '1 rechazada · ver': '1 rejected · view',
  '{n} rechazadas · ver': '{n} rejected · view',
  'Envíos rechazados': 'Rejected submissions',
  Cerrar: 'Close',
  'El servidor no los aceptó y siguen guardados en este dispositivo. Puedes reintentarlos (por si ya se ha resuelto, p. ej. tras iniciar sesión) o descartarlos.':
    'The server did not accept them and they are still saved on this device. You can retry them (in case the problem is fixed, e.g. after logging in) or discard them.',
  'No queda nada rechazado.': 'Nothing rejected left.',
  Descartar: 'Discard',
  Reintentar: 'Retry',
  'Datos no válidos para el servidor': 'Invalid data for the server',
  'El servidor lo ha rechazado': 'The server rejected it',
  'Tipo de entrada sin envío implementado: {kind}': 'No sender implemented for entry type: {kind}',
  'Sesión caducada (401)': 'Session expired (401)',
  'Este navegador no permite guardar datos en el dispositivo (¿modo privado?) y no hay conexión con el servidor: no se ha podido guardar. Avisa de viva voz si es urgente.':
    'This browser cannot store data on the device (private mode?) and there is no connection to the server: it could not be saved. Tell someone in person if it is urgent.',
  // Tipos de envío (PendingSyncChip)
  Mediciones: 'Measurements',
  'Tarea completada': 'Task completed',
  'Protocolo completado': 'Protocol completed',
  'Alerta o SOS': 'Alert or SOS',
  'Respuesta a «R U OK?»': 'Answer to “R U OK?”',
  'Ajuste de privacidad': 'Privacy setting',
  Kudos: 'Kudos',
  'Apuntarse a una misión': 'Mission sign-up',

  // ── Avisos (Toaster) ──
  'Sonido activado': 'Sound on',
  'Activar sonido': 'Turn on sound',
  'Cerrar aviso': 'Close notice',

  // ── Sesión y login ──
  Salir: 'Log out',
  'Administración del sistema': 'System administration',
  'Usuario o contraseña incorrectos.': 'Wrong username or password.',
  'Demasiados intentos. Espera unos minutos.': 'Too many attempts. Wait a few minutes.',
  'Hola de nuevo,': 'Welcome back,',
  'Inicia sesión en el sistema de a bordo.': 'Log in to the onboard system.',
  'Tu sesión ha caducado. Vuelve a entrar: lo que tengas pendiente en este dispositivo se enviará después, no se ha perdido nada.':
    'Your session has expired. Log in again: anything pending on this device will be sent afterwards, nothing has been lost.',
  Acceso: 'Sign in',
  Usuario: 'Username',
  Contraseña: 'Password',
  'Si es una emergencia, pulsa SOS: funciona sin sesión.':
    'If it is an emergency, press SOS: it works without logging in.',
  'Entrando…': 'Logging in…',
  Entrar: 'Log in',
  'Usuarios demo ({n})': 'Demo users ({n})',
  'Usuarios de la demo': 'Demo users',
  // Grupos de rol de la lista de demo (Login)
  'atención sanitaria': 'healthcare',
  mando: 'command',
  'apoyo psicológico': 'psychological support',
  familia: 'family',
  global: 'global',

  // ── Liveness: actividad y «R U OK?» ──
  'Actividad de riesgo': 'High-risk activity',
  Sueño: 'Sleep',
  Riesgo: 'Risk',
  'Salida al exterior (EVA)': 'Spacewalk (EVA)',
  'Sin señal {t}: «R U OK?». Sin respuesta: alerta.':
    'No signal for {t}: “R U OK?”. No answer: alert.',
  'Sin señal: «R U OK?». Sin respuesta: alerta.': 'No signal: “R U OK?”. No answer: alert.',
  'Si tu dispositivo pasa {t} sin dar señal, te preguntamos «R U OK?». Si no respondes, salta una alerta.':
    'If your device goes {t} without a signal, we ask “R U OK?”. If you don’t answer, an alert goes off.',
  'Si tu dispositivo deja de dar señal, te preguntamos «R U OK?». Si no respondes, salta una alerta.':
    'If your device stops sending a signal, we ask “R U OK?”. If you don’t answer, an alert goes off.',
  '{who}: «R U OK?» a los {stale} sin señal y alerta a los {lost}.':
    '{who}: “R U OK?” after {stale} without a signal, alert after {lost}.',
  '{who}: los avisos llegan mucho antes.': '{who}: warnings come much sooner.',
  '{what}: se vigila más de cerca. La pregunta llega a los {stale} sin señal y la alerta, a los {lost}.':
    '{what}: monitored more closely. The question comes after {stale} without a signal and the alert after {lost}.',
  '{what}: se vigila más de cerca y los avisos llegan mucho antes.':
    '{what}: monitored more closely and warnings come much sooner.',
  'Sueño: se espera ×{factor} ({t}) para no despertarte.':
    'Sleep: waits ×{factor} ({t}) to avoid waking you.',
  'Sueño: se espera más para no despertarte.': 'Sleep: waits longer to avoid waking you.',
  'Para dormir: se espera ×{factor} ({t} sin señal) antes de preguntar, para no despertarte.':
    'Sleep: waits ×{factor} ({t} without a signal) before asking, to avoid waking you.',
  'Para dormir: se espera más antes de preguntar, para no despertarte.':
    'Sleep: waits longer before asking, to avoid waking you.',
  'Actividad actual': 'Current activity',
  Actividad: 'Activity',
  'Ajusta los avisos': 'Tunes alerts',
  'Sin conexión con el servidor. Vuelve a intentarlo.': 'No connection to the server. Try again.',
  'No se ha podido enviar: {error}': 'Could not send: {error}',
  'Ayuda pedida': 'Help requested',
  'Se ha creado una alerta y se está avisando. Si puedes, cuenta qué pasa.':
    'An alert has been created and people are being notified. If you can, tell us what is happening.',
  'Añadir detalles': 'Add details',
  'Hace un rato que no recibimos señal tuya. ¿Estás bien?':
    'We haven’t had a signal from you for a while. Are you OK?',
  'Enviando…': 'Sending…',
  'Estoy bien': 'I’m OK',
  'Necesito ayuda': 'I need help',

  // ── Entornos (format.ts, EnvironmentCard, EnvironmentSelect, MemberList) ──
  Espacio: 'Space',
  Tierra: 'Earth',
  '0 g · microgravedad': '0 g · microgravity',
  'Sin retardo': 'No delay',
  '≈{s} s · tiempo real': '≈{s} s · real time',
  '{s} s · diferido': '{s} s · delayed',
  '{min} min · diferido': '{min} min · delayed',
  Actual: 'Current',
  Gravedad: 'Gravity',
  Retardo: 'Delay',
  'Entrar en {name}': 'Enter {name}',
  'Elige el entorno': 'Choose the environment',
  'Cada entorno cambia los umbrales, el escalado de alertas, los textos y los colores.':
    'Each environment changes the thresholds, alert escalation, texts and colors.',
  'No se han podido cargar los entornos. Comprueba la conexión con el servidor.':
    'The environments could not be loaded. Check the connection to the server.',
  'No se ha podido cargar la lista.': 'The list could not be loaded.',
  'No hay nadie dado de alta en este entorno.': 'Nobody is registered in this environment.',

  // ── Tiempo relativo (lib/time.ts) ──
  'hace menos de 1 min': 'less than 1 min ago',
  'hace {min} min': '{min} min ago',
  'hace {h} h {min} min': '{h} h {min} min ago',
  'hace {h} h': '{h} h ago',
  'hace {d} d': '{d} d ago',

  // ── Más, 404 ──
  'Estado del dispositivo': 'Device status',
  Conexión: 'Connection',
  Sesión: 'Session',
  'Página no encontrada': 'Page not found',
  'Volver al inicio': 'Back to home',

  // ── Ajustes (Settings.tsx) ──
  Idioma: 'Language',
  'Cambia los textos de la app y de los catálogos del servidor. Los datos y mensajes ya guardados se quedan en su idioma.':
    'Changes the texts of the app and of the server catalogs. Data and messages already saved stay in their language.',
  'Voz guía': 'Voice guide',
  'Leer en voz alta los pasos guiados, las preguntas y los protocolos':
    'Read guided steps, questions and protocols aloud',
  'Estos ajustes se guardan en este dispositivo.': 'These settings are saved on this device.',
}
