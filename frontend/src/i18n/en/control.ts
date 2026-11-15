/** Textos en inglés del área «control» (FE-38): clave = texto en español tal cual aparece en el código. */
export const control: Record<string, string> = {
  // Comunes del centro de control
  Reintentar: 'Retry',
  Cerrar: 'Close',
  'Cargando…': 'Loading…',
  'Elige…': 'Choose…',
  'Enviando…': 'Sending…',
  Enviado: 'Sent',
  'el entorno': 'the environment',
  'sin conexión con el servidor': 'no connection to the server',
  'No se ha podido enviar: {error}': 'Could not send: {error}',
  'Sin entorno': 'No environment',
  'todo {crew}': 'the whole {crew}',
  'todo {crew} ({n})': 'the whole {crew} ({n})',
  Todo: 'All',
  Todos: 'All',

  // Centro de control (panorama)
  'Centro de control': 'Control center',
  'Panorama en tiempo real, sin el retardo del enlace':
    'Real-time overview, without the link delay',
  'actualizado {ago}': 'updated {ago}',
  'no se pudo actualizar': 'could not refresh',
  'Elige un entorno para ver su panorama.': 'Choose an environment to see its overview.',
  Métricas: 'Metrics',
  'Mediciones (última hora)': 'Measurements (last hour)',
  'Alertas abiertas': 'Open alerts',
  'Respuesta media': 'Avg. response',
  'Dispositivos activos': 'Active devices',
  'No se ha podido cargar el panorama.': 'Could not load the overview.',
  '{n} en cola': '{n} queued',
  'Sin alertas abiertas': 'No open alerts',
  'vigilancia de contacto en pausa': 'contact monitoring paused',
  'Sin {crew}.': 'Nobody in the {crew}.',
  'medido {ago}': 'measured {ago}',
  'sin mediciones': 'no measurements',
  'Eventos en vivo': 'Live events',
  'Tipo de evento': 'Event type',
  'Sin eventos.': 'No events.',

  // Grupos del feed (feed.ts)
  Mediciones: 'Measurements',
  Contacto: 'Contact',
  Alertas: 'Alerts',
  Enlace: 'Link',
  Sincronización: 'Sync',
  Accesos: 'Logins',
  Misiones: 'Missions',
  Dispositivos: 'Devices',
  Usuarios: 'Users',
  Notificaciones: 'Notifications',

  // Registro (log.ts y ControlLog)
  Registro: 'Log',
  'Incidencias resueltas y eventos importantes de {env}.':
    'Resolved incidents and important events in {env}.',
  'Qué mostrar': 'What to show',
  '{n} eventos': '{n} events',
  'No se ha podido cargar el registro.': 'Could not load the log.',
  'Nada que mostrar todavía.': 'Nothing to show yet.',
  Resuelta: 'Resolved',
  'Incidencias resueltas': 'Resolved incidents',
  'Usuarios y accesos': 'Users and logins',
  'Misiones y logros': 'Missions and achievements',
  'Contacto y enlace': 'Contact and link',
  'Alerta creada': 'Alert created',
  'Alerta escalada': 'Alert escalated',
  'Alerta recibida': 'Alert acknowledged',
  'Incidencia resuelta': 'Incident resolved',
  Notificación: 'Notification',
  'Usuario creado': 'User created',
  'Inicio de sesión': 'Login',
  'Acceso fallido': 'Failed login',
  'Misión cumplida': 'Mission completed',
  'Dispositivo conectado': 'Device connected',

  // Dispositivos
  'Móviles y tablets de {env}: conexión, pendientes y sincronización.':
    'Phones and tablets in {env}: connection, pending items and sync.',
  'Dispositivos del entorno': 'Environment devices',
  'No se han podido cargar.': 'Could not load them.',
  'Ningún dispositivo de este entorno todavía. Conecta uno con el QR e inicia sesión.':
    'No devices in this environment yet. Connect one with the QR code and log in.',
  Dispositivo: 'Device',
  Visto: 'Last seen',
  Pendientes: 'Pending',
  Sincronizado: 'Last sync',
  nunca: 'never',
  Móvil: 'Phone',
  Ordenador: 'Computer',
  Proyector: 'Projector',

  // QR de conexión
  'QR de conexión': 'Connection QR code',
  'Conectar un móvil': 'Connect a phone',
  'No se ha podido obtener la dirección del servidor.': 'Could not get the server address.',
  'El servidor no tiene dirección en la red local.':
    'The server has no address on the local network.',
  'Código QR para abrir {url}': 'QR code to open {url}',
  'Escanéalo con la cámara del móvil, conectado a la misma wifi que este servidor.':
    'Scan it with the phone camera, on the same Wi-Fi as this server.',
  Dirección: 'Address',
  'Servidor: {host}': 'Server: {host}',

  // Usuarios
  'Cuentas de {env}: alta y activación.': 'Accounts in {env}: creation and activation.',
  'Elige un entorno para gestionar sus usuarios.': 'Choose an environment to manage its users.',
  'Usuarios de {env}': 'Users in {env}',
  '{n} cuentas': '{n} accounts',
  'No se han podido cargar los usuarios.': 'Could not load the users.',
  Nombre: 'Name',
  Rol: 'Role',
  Estado: 'Status',
  Activo: 'Active',
  Desactivado: 'Disabled',
  Activar: 'Activate',
  Desactivar: 'Deactivate',
  'Activar a {user}': 'Activate {user}',
  'Desactivar a {user}': 'Deactivate {user}',
  'Crear a {user}': 'Create {user}',
  'Nuevo usuario': 'New user',
  'Nuevo usuario en {env}': 'New user in {env}',
  'Minúsculas, números, punto, guion o guion bajo (2 a 32)':
    'Lowercase letters, digits, dot, hyphen or underscore (2 to 32)',
  'Contraseña (mín. 8)': 'Password (min. 8)',
  'Crear usuario': 'Create user',

  // Simulación
  Simulación: 'Simulation',
  'Provoca situaciones en {env}: llegan al momento a los móviles y tablets conectados.':
    'Trigger situations in {env}: they reach connected phones and tablets instantly.',
  'Provoca situaciones en {env} para {member}: llegan al momento a los móviles y tablets conectados.':
    'Trigger situations in {env} for {member}: they reach connected phones and tablets instantly.',
  'Elige un entorno para simular.': 'Choose an environment to simulate.',
  'Alerta o notificación': 'Alert or notification',
  'Provocar una medición': 'Trigger a measurement',

  // Alerta o notificación del operador
  'Nueva alerta o notificación': 'New alert or notification',
  Tipo: 'Type',
  Alerta: 'Alert',
  Para: 'To',
  'Se cambia en el selector de {member} de la barra lateral.':
    'Change it with the {member} selector in the sidebar.',
  Categoría: 'Category',
  Destino: 'Recipient',
  'Nivel {i}: {role}': 'Level {i}: {role}',
  'Título (opcional)': 'Title (optional)',
  'Aviso de control': 'Notice from control',
  Nivel: 'Level',
  Información: 'Information',
  Aviso: 'Warning',
  Importante: 'Important',
  'Mensaje (opcional)': 'Message (optional)',
  Mensaje: 'Message',
  'Qué pasa (lo verá en el detalle de la alerta)':
    "What is happening (shown in the alert's details)",
  'Lo verá al momento en su móvil': 'They will see it on their phone right away',
  'Enviar alerta': 'Send alert',
  'Enviar notificación': 'Send notification',
  'Alerta enviada': 'Alert sent',
  'Notificación enviada': 'Notification sent',
  'Alerta enviada a {who}': 'Alert sent to {who}',
  'Notificación enviada a {who}': 'Notification sent to {who}',
  'Sin conexión: la alerta para {who} se enviará sola al volver':
    'Offline: the alert for {who} will be sent automatically when the connection is back',
  'A {who}': 'To {who}',
  'A {who}: «{text}»': 'To {who}: “{text}”',
  'Salta al momento en los dispositivos con su sesión abierta.':
    'It pops up instantly on the devices where they are logged in.',

  // Provocar una medición
  De: 'From',
  'elige un {member} en el selector de la barra lateral':
    'select the {member} in the sidebar selector',
  Indicador: 'Indicator',
  Valor: 'Value',
  'Valor de ejemplo': 'Sample value',
  Crítico: 'Critical',
  'Normal en {env}: {low}–{high} {unit}': 'Normal in {env}: {low}–{high} {unit}',
  'Los valores de ejemplo salen de los rangos del entorno.':
    "Sample values come from the environment's ranges.",
  'Enviar medición': 'Send measurement',
  'Simulada desde el centro de control': 'Simulated from the control center',
  'Sin conexión: se enviará sola al volver':
    'Offline: it will be sent automatically when the connection is back',
  '{indicator} de {who}: {value} {unit}': '{indicator} for {who}: {value} {unit}',
  'Medición enviada': 'Measurement sent',
  'El panel se actualiza al momento; si sale de rango, salta la alerta.':
    'The dashboard updates instantly; if it is out of range, the alert fires.',

  // Escenarios (simulate.ts)
  Escenarios: 'Scenarios',
  'No hay escenarios guionizados para esta selección. Provoca la situación con una medición, una alerta o el estado del enlace.':
    'No scripted scenarios for this selection. Trigger the situation with a measurement, an alert or the link status.',
  Lanzar: 'Run',
  'Escenario «{name}» cargado': 'Scenario “{name}” loaded',
  'Mal sueño y tensión al alza': 'Poor sleep and rising blood pressure',
  'Cinco días durmiendo cada vez menos y con la tensión sistólica subiendo.':
    'Five days of less and less sleep, with systolic blood pressure going up.',
  'EVA sin contacto': 'EVA, no contact',
  'Sale de EVA y deja de dar señales hace 3 min: «R U OK?» y alerta de sin contacto.':
    'Goes out on EVA and sends no signal for 3 min: “R U OK?” and a no-contact alert.',
  'Riesgo de caída': 'Fall risk',
  'Bebe poco, duerme mal, pierde peso y tiene la tensión baja.':
    'Drinks little, sleeps badly, is losing weight and has low blood pressure.',

  // Enlace
  'Enlace con {ground}': 'Link to the {ground}',
  'Ahora:': 'Now:',
  '{n} mensajes en cola': '{n} messages queued',
  'Estado del enlace con {ground}': 'Status of the link to the {ground}',
  'Enlace → {state}': 'Link → {state}',
  'En línea': 'Online',
  'Con retardo': 'Delayed',
  'Sin enlace (LOS)': 'No link (LOS)',
  'Lo que va a {ground} espera en la cola mientras no hay enlace y llega con el retardo del entorno.':
    "Anything sent to the {ground} waits in the queue while there is no link, and arrives with the environment's delay.",

  // Vigilancia de contacto
  'Vigilancia de contacto': 'Contact monitoring',
  'Vigilancia en pausa': 'Monitoring paused',
  'Vigilancia reanudada': 'Monitoring resumed',
  'Pausar los «R U OK?» y las alertas de sin contacto':
    'Pause the “R U OK?” checks and the no-contact alerts',
  'Útil durante la presentación. El contacto se sigue calculando y mostrando igual.':
    'Useful during the presentation. Contact is still calculated and shown as usual.',

  // Reloj y datos de la demo
  'Reloj y datos de la demo': 'Demo clock and data',
  'Adelantar el reloj': 'Fast-forward the clock',
  'Reloj adelantado {d}': 'Clock moved forward {d}',
  'Afecta a todo el servidor: datos que caducan, tareas del día y falta de contacto.':
    "Affects the whole server: data expiry, the day's tasks and lack of contact.",
  'Datos de la demo reiniciados': 'Demo data reset',
  '¿Reiniciar TODOS los datos de la demo (todos los entornos) con el seed inicial?':
    'Reset ALL demo data (every environment) to the initial seed?',
  'Reiniciar los datos de la demo': 'Reset the demo data',

  // Parámetros del entorno
  'Parámetros del entorno': 'Environment parameters',
  'Elige un entorno para ver su configuración.': 'Choose an environment to see its settings.',
  Gravedad: 'Gravity',
  Retardo: 'Delay',
  Radiación: 'Radiation',
  Misión: 'Mission',
  Escalera: 'Escalation ladder',
  Vocabulario: 'Vocabulary',
  'Indicadores activos:': 'Active indicators:',
  'Umbrales ajustados al entorno:': 'Thresholds adjusted for the environment:',
  'Rutina:': 'Routine:',
  'Solo lectura: los perfiles se editan en backend/app/data/environments.json.':
    'Read-only: profiles are edited in backend/app/data/environments.json.',
}
