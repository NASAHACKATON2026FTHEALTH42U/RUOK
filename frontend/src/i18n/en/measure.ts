/** Textos en inglés del área «measure» (FE-38): clave = texto en español tal cual aparece en el código. */
export const measure: Record<string, string> = {
  // Medir (pages/Measure.tsx)
  'Nueva medición': 'New measurement',
  '{system} no se mide en {env}.': '{system} is not measured in this environment ({env}).',
  'Este indicador': 'This indicator',
  'este entorno': 'this environment',
  'Ningún indicador de este sistema está activo en la configuración del entorno.':
    "None of this system's indicators are active in the environment configuration.",
  'Elegir qué medir': 'Choose what to measure',
  '¿Qué quieres medir?': 'What do you want to measure?',
  'Check-in diario «R U OK?»:': 'Daily “R U OK?” check-in:',
  'Rellena al menos un valor.': 'Fill in at least one value.',
  'Medición enviada': 'Measurement sent',
  '1 valor guardado · estado general: {status}': '1 value saved · overall status: {status}',
  '{n} valores guardados · estado general: {status}': '{n} values saved · overall status: {status}',
  'Ver el panel': 'View dashboard',
  'Guardada en el dispositivo': 'Saved on this device',
  'Sin conexión con el servidor': 'No connection to the server',
  'La medición se enviará sola al volver la conexión, sin duplicarse.':
    'The measurement will be sent automatically when the connection returns, without duplicates.',
  'No se ha podido guardar en el dispositivo: {error}': 'Could not save on this device: {error}',
  'Nota (opcional)': 'Note (optional)',
  'Elegir otra cosa': 'Choose something else',
  'Pasos de la medición': 'Measurement steps',
  'Paso {n}: {name} (con valor)': 'Step {n}: {name} (has a value)',
  'Paso {n}: {name}': 'Step {n}: {name}',
  Resumen: 'Summary',
  'Repasa y guarda': 'Review and save',
  'Paso {n} de {total}': 'Step {n} of {total}',
  'Valor no válido': 'Invalid value',
  'Sin valor': 'No value',
  Atrás: 'Back',
  Omitir: 'Skip',
  'Guardando…': 'Saving…',
  'Ver resumen': 'View summary',
  Siguiente: 'Next',
  'Guardar medición': 'Save measurement',

  // Un paso de la medición y teclado numérico (components/measure)
  'Cómo medir': 'How to measure',
  'Escuchar cómo medir: {name}': 'Listen to how to measure: {name}',
  Horas: 'Hours',
  Minutos: 'Minutes',
  'Teclado numérico': 'Numeric keypad',
  'Teclado numérico: horas': 'Numeric keypad: hours',
  'Teclado numérico: minutos': 'Numeric keypad: minutes',
  'Borrar el último dígito': 'Delete last digit',
  Vaciar: 'Clear',
  'Coma decimal': 'Decimal separator',

  // Validación (components/measure/measureForm.ts)
  'Escribe un número': 'Enter a number',
  'Los minutos van de 0 a 59': 'Minutes must be between 0 and 59',
  'Mínimo {n} {unit}': 'Minimum {n} {unit}',
  'Máximo {n} {unit}': 'Maximum {n} {unit}',
  'Usa pasos de {n}': 'Use steps of {n}',
  'Redondea a pasos de {n} {unit}': 'Round to steps of {n} {unit}',

  // Check-in diario (pages/CheckIn.tsx, FaceScale)
  'No se pudo cargar el check-in. Comprueba la conexión con el servidor.':
    'Could not load the check-in. Check the connection to the server.',
  'Responde a todas las preguntas.': 'Answer all the questions.',
  'Para cuidarte hoy': 'Take care of yourself today',
  'Ver el historial': 'View history',
  'Check-in guardado en el dispositivo': 'Check-in saved on this device',
  'No hay conexión con el servidor. Tus respuestas están guardadas aquí y':
    'There is no connection to the server. Your answers are saved here and',
  'se enviarán solas': 'will be sent automatically',
  'cuando vuelva la conexión, sin duplicarse.': 'when the connection returns, without duplicates.',
  'Verás los pendientes en la cabecera. Hasta entonces, el panel y el historial pueden no reflejarlas.':
    'You will see pending items in the header. Until then, the dashboard and history may not reflect them.',
  'Check-in guardado': 'Check-in saved',
  'Gracias. Tus respuestas de hoy ya están registradas.':
    'Thank you. Your answers for today have been recorded.',
  'Evaluación actualizada:': 'Assessment updated:',
  'Estado general: {status}': 'Overall status: {status}',
  '¿Cómo estás hoy? {n} preguntas rápidas.': 'How are you today? {n} quick questions.',
  'Progreso del check-in': 'Check-in progress',
  Enviar: 'Send',
  'Paso {n}: {name} (respondida: {value})': 'Step {n}: {name} (answered: {value})',
  'Último paso: revisar y enviar': 'Last step: review and send',
  'Pregunta {n} de {total}': 'Question {n} of {total}',
  'Check-in diario': 'Daily check-in',
  'Revisar y enviar': 'Review and send',
  'Pregunta {n} de {total}: {name}': 'Question {n} of {total}: {name}',
  '{name}: {value}. Cambiar': '{name}: {value}. Change',
  '{name}: sin responder. Cambiar': '{name}: not answered. Change',
  'Sin responder': 'Not answered',
  '¿Algo más? (opcional)': 'Anything else? (optional)',
  'Tus respuestas son privadas: fuera de tu perfil solo se ve un semáforo agregado, salvo que decidas compartirlas o haya una emergencia.':
    'Your answers are private: outside your profile only an aggregated traffic light is shown, unless you choose to share them or there is an emergency.',
  Anterior: 'Previous',
  'Enviar check-in': 'Send check-in',
  'Responde {done} / {total}': 'Answered {done} / {total}',
  '{n} de 5': '{n} of 5',

  // Test de vigilancia (pages/Pvt.tsx, PvtRunner, pvt.ts). Las 4 frases de voiceTexts.json van en
  // una sola línea cada una: scripts/voice/generate_voice.py lee clave y valor de la misma línea.
  'Test de vigilancia (PVT)': 'Vigilance test (PVT)',
  'Escuchar instrucciones': 'Listen to instructions',
  // prettier-ignore
  'Mide tu tiempo de reacción, un marcador objetivo de fatiga.': 'Measure your reaction time, an objective marker of fatigue.',
  // prettier-ignore
  'La pantalla espera un rato al azar, entre 2 y 10 segundos.': 'The screen waits for a random time, between 2 and 10 seconds.',
  // prettier-ignore
  'Cuando cambie de color y diga «¡Pulsa!», toca la pantalla lo antes posible, o pulsa la barra espaciadora.': 'When it changes color and says «Tap!», tap the screen as fast as you can, or press the space bar.',
  // prettier-ignore
  'No pulses antes de tiempo: cuenta como falso inicio.': 'Do not tap too early: it counts as a false start.',
  'Una respuesta de más de {ms} ms es un «lapso» de atención.':
    'A response slower than {ms} ms is an attention «lapse».',
  'Test completo': 'Full test',
  'Versión demo': 'Demo version',
  'Tiempo de reacción medio': 'Mean reaction time',
  Lapsos: 'Lapses',
  'Test guardado': 'Test saved',
  'Test guardado en el dispositivo': 'Test saved on this device',
  'Resultado del test': 'Test result',
  '{n} respuestas válidas · {f} falsos inicios': '{n} valid responses · {f} false starts',
  'No hay conexión con el servidor. El resultado está guardado aquí y':
    'There is no connection to the server. The result is saved here and',
  'se enviará solo': 'will be sent automatically',
  'No se ha registrado ninguna respuesta válida, así que no se guarda nada. Repite el test.':
    'No valid response was recorded, so nothing is saved. Repeat the test.',
  'Repetir el test': 'Repeat the test',
  '{label} ({short}) · {n} respuestas · {f} falsos inicios':
    '{label} ({short}) · {n} responses · {f} false starts',
  'Test de vigilancia': 'Vigilance test',
  'Quedan {n} segundos': '{n} seconds left',
  Cancelar: 'Cancel',
  'Espera… pulsa en cuanto cambie la pantalla': 'Wait… tap as soon as the screen changes',
  '¡Pulsa!': 'Tap!',
  'Lapso (más de 500 ms)': 'Lapse (over 500 ms)',
  'Demasiado rápido: falso inicio': 'Too fast: false start',
  Bien: 'Good',
  'Demasiado pronto': 'Too early',
  'Falso inicio: espera a que cambie la pantalla': 'False start: wait for the screen to change',
}
