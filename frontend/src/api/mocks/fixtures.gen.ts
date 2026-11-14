// GENERADO por `npm run gen:mocks` (backend/scripts/export_mocks.py). NO EDITAR A MANO.
// Respuestas de la API con sus tipos: si el contrato cambia, `npm run build` falla aquí.
/* eslint-disable */
import type { Schema } from '../client'

/** Operaciones del contrato (método, ruta sin /api/v1). Cada una necesita un mock. */
export const CONTRACT_OPERATIONS = [
  [
    "GET",
    "/auth/demo-users"
  ],
  [
    "GET",
    "/auth/me"
  ],
  [
    "GET",
    "/control/overview"
  ],
  [
    "GET",
    "/devices"
  ],
  [
    "GET",
    "/environments"
  ],
  [
    "GET",
    "/environments/{env_id}"
  ],
  [
    "GET",
    "/environments/{env_id}/alerts"
  ],
  [
    "GET",
    "/environments/{env_id}/leaderboard"
  ],
  [
    "GET",
    "/environments/{env_id}/members"
  ],
  [
    "GET",
    "/events"
  ],
  [
    "GET",
    "/events/stream"
  ],
  [
    "GET",
    "/health"
  ],
  [
    "GET",
    "/indicators"
  ],
  [
    "GET",
    "/indicators/{indicator_id}"
  ],
  [
    "GET",
    "/interventions"
  ],
  [
    "GET",
    "/link"
  ],
  [
    "GET",
    "/link/messages"
  ],
  [
    "GET",
    "/members/{member_id}"
  ],
  [
    "GET",
    "/members/{member_id}/alerts"
  ],
  [
    "GET",
    "/members/{member_id}/assessment"
  ],
  [
    "GET",
    "/members/{member_id}/game"
  ],
  [
    "GET",
    "/members/{member_id}/measurements"
  ],
  [
    "GET",
    "/members/{member_id}/tasks"
  ],
  [
    "GET",
    "/system/network-info"
  ],
  [
    "GET",
    "/systems"
  ],
  [
    "GET",
    "/users"
  ],
  [
    "PATCH",
    "/members/{member_id}/privacy"
  ],
  [
    "POST",
    "/alerts/{alert_id}/ack"
  ],
  [
    "POST",
    "/alerts/{alert_id}/escalate"
  ],
  [
    "POST",
    "/alerts/{alert_id}/messages"
  ],
  [
    "POST",
    "/alerts/{alert_id}/resolve"
  ],
  [
    "POST",
    "/auth/login"
  ],
  [
    "POST",
    "/auth/pin"
  ],
  [
    "POST",
    "/control/liveness/pause"
  ],
  [
    "POST",
    "/demo/fast-forward"
  ],
  [
    "POST",
    "/demo/link"
  ],
  [
    "POST",
    "/demo/reset"
  ],
  [
    "POST",
    "/demo/scenarios/{name}"
  ],
  [
    "POST",
    "/members/{member_id}/alerts"
  ],
  [
    "POST",
    "/members/{member_id}/heartbeat"
  ],
  [
    "POST",
    "/members/{member_id}/measurements"
  ],
  [
    "POST",
    "/members/{member_id}/ruok"
  ],
  [
    "POST",
    "/members/{member_id}/tasks/{task_id}/complete"
  ],
  [
    "POST",
    "/users"
  ]
] as const

export const health: Schema<'HealthResponse'> = {
  "status": "ok",
  "server_time": "2026-11-14T16:29:14.498037Z"
}

export const environments: Schema<'Environment'>[] = [
  {
    "id": "iss",
    "name": "Estación Espacial Internacional",
    "kind": "space",
    "gravity_g": 0.0,
    "comm_delay_s": 0,
    "radiation_level": "medium",
    "escalation_ladder": [
      "self",
      "crew",
      "ground"
    ],
    "liveness": {
      "stale_after_s": 300,
      "lost_after_s": 900,
      "eva_stale_after_s": 30,
      "ruok_timeout_s": 120
    },
    "vocabulary": {
      "member": "astronauta",
      "crew": "tripulación",
      "ground": "flight surgeon",
      "medic": "oficial médico",
      "commander": "comandante",
      "psych": "psicólogo BHP"
    },
    "theme": {
      "primary": "#4d9fff",
      "background": "iss.jpg"
    },
    "threshold_overrides": {},
    "indicators": [
      "heart_rate",
      "bp_systolic",
      "bp_diastolic",
      "spo2",
      "temperature",
      "sleep_hours",
      "mood",
      "exercise_min",
      "radiation_dose"
    ],
    "routine": [
      {
        "task_type": "measure_bp",
        "times_per_day": 1,
        "points": 10
      },
      {
        "task_type": "resistive_exercise",
        "times_per_day": 1,
        "points": 20
      },
      {
        "task_type": "checkin",
        "times_per_day": 1,
        "points": 10
      }
    ],
    "mission": {
      "start": "2026-10-01",
      "end": "2027-09-30"
    }
  },
  {
    "id": "moon",
    "name": "Base lunar Artemis",
    "kind": "space",
    "gravity_g": 0.16,
    "comm_delay_s": 1,
    "radiation_level": "high",
    "escalation_ladder": [
      "self",
      "crew",
      "ground"
    ],
    "liveness": {
      "stale_after_s": 300,
      "lost_after_s": 900,
      "eva_stale_after_s": 30,
      "ruok_timeout_s": 120
    },
    "vocabulary": {
      "member": "astronauta",
      "crew": "tripulación",
      "ground": "flight surgeon",
      "medic": "oficial médico",
      "commander": "comandante",
      "psych": "psicólogo BHP"
    },
    "theme": {
      "primary": "#c8ccd6",
      "background": "moon.jpg"
    },
    "threshold_overrides": {},
    "indicators": [
      "heart_rate",
      "bp_systolic",
      "bp_diastolic",
      "spo2",
      "temperature",
      "sleep_hours",
      "mood",
      "exercise_min",
      "radiation_dose"
    ],
    "routine": [
      {
        "task_type": "measure_bp",
        "times_per_day": 1,
        "points": 10
      },
      {
        "task_type": "resistive_exercise",
        "times_per_day": 1,
        "points": 20
      },
      {
        "task_type": "checkin",
        "times_per_day": 1,
        "points": 10
      }
    ],
    "mission": {
      "start": "2026-10-01",
      "end": "2027-09-30"
    }
  },
  {
    "id": "mars",
    "name": "Base marciana",
    "kind": "space",
    "gravity_g": 0.38,
    "comm_delay_s": 840,
    "radiation_level": "high",
    "escalation_ladder": [
      "self",
      "crew",
      "ground"
    ],
    "liveness": {
      "stale_after_s": 300,
      "lost_after_s": 900,
      "eva_stale_after_s": 30,
      "ruok_timeout_s": 120
    },
    "vocabulary": {
      "member": "astronauta",
      "crew": "tripulación",
      "ground": "flight surgeon",
      "medic": "oficial médico",
      "commander": "comandante",
      "psych": "psicólogo BHP"
    },
    "theme": {
      "primary": "#c1440e",
      "background": "mars.jpg"
    },
    "threshold_overrides": {
      "bp_systolic": {
        "normal": null,
        "warning": [
          130.0,
          140.0
        ],
        "critical_low": null,
        "critical_high": null
      }
    },
    "indicators": [
      "heart_rate",
      "bp_systolic",
      "bp_diastolic",
      "spo2",
      "temperature",
      "sleep_hours",
      "mood",
      "exercise_min",
      "radiation_dose"
    ],
    "routine": [
      {
        "task_type": "measure_bp",
        "times_per_day": 1,
        "points": 10
      },
      {
        "task_type": "resistive_exercise",
        "times_per_day": 1,
        "points": 20
      },
      {
        "task_type": "checkin",
        "times_per_day": 1,
        "points": 10
      }
    ],
    "mission": {
      "start": "2026-10-01",
      "end": "2027-09-30"
    }
  },
  {
    "id": "earth",
    "name": "Analógico terrestre",
    "kind": "earth",
    "gravity_g": 1.0,
    "comm_delay_s": 0,
    "radiation_level": "low",
    "escalation_ladder": [
      "self",
      "crew",
      "ground"
    ],
    "liveness": {
      "stale_after_s": 300,
      "lost_after_s": 900,
      "eva_stale_after_s": 30,
      "ruok_timeout_s": 120
    },
    "vocabulary": {
      "member": "participante",
      "crew": "equipo",
      "ground": "médico"
    },
    "theme": {
      "primary": "#2bb3c9",
      "background": null
    },
    "threshold_overrides": {},
    "indicators": [
      "heart_rate",
      "bp_systolic",
      "bp_diastolic",
      "spo2",
      "temperature",
      "sleep_hours",
      "mood"
    ],
    "routine": [
      {
        "task_type": "checkin",
        "times_per_day": 1,
        "points": 10
      }
    ],
    "mission": null
  },
  {
    "id": "hospital",
    "name": "Planta de hospital",
    "kind": "earth",
    "gravity_g": 1.0,
    "comm_delay_s": 0,
    "radiation_level": "none",
    "escalation_ladder": [
      "self",
      "nurse",
      "doctor"
    ],
    "liveness": {
      "stale_after_s": 300,
      "lost_after_s": 900,
      "eva_stale_after_s": 30,
      "ruok_timeout_s": 120
    },
    "vocabulary": {
      "member": "paciente",
      "crew": "planta",
      "ground": "médico",
      "medic": "enfermería"
    },
    "theme": {
      "primary": "#0b5a96",
      "background": null
    },
    "threshold_overrides": {},
    "indicators": [
      "heart_rate",
      "bp_systolic",
      "bp_diastolic",
      "spo2",
      "temperature",
      "sleep_hours",
      "mood"
    ],
    "routine": [
      {
        "task_type": "checkin",
        "times_per_day": 1,
        "points": 10
      }
    ],
    "mission": null
  },
  {
    "id": "geriatric",
    "name": "Residencia geriátrica",
    "kind": "earth",
    "gravity_g": 1.0,
    "comm_delay_s": 0,
    "radiation_level": "none",
    "escalation_ladder": [
      "self",
      "caregiver",
      "doctor",
      "family"
    ],
    "liveness": {
      "stale_after_s": 300,
      "lost_after_s": 900,
      "eva_stale_after_s": 30,
      "ruok_timeout_s": 120
    },
    "vocabulary": {
      "member": "residente",
      "crew": "residencia",
      "ground": "médico",
      "medic": "cuidador"
    },
    "theme": {
      "primary": "#6a429e",
      "background": null
    },
    "threshold_overrides": {},
    "indicators": [
      "heart_rate",
      "bp_systolic",
      "bp_diastolic",
      "spo2",
      "temperature",
      "sleep_hours",
      "mood",
      "hydration_ml",
      "weight_kg"
    ],
    "routine": [
      {
        "task_type": "checkin",
        "times_per_day": 1,
        "points": 10
      },
      {
        "task_type": "walk",
        "times_per_day": 1,
        "points": 15
      },
      {
        "task_type": "hydration",
        "times_per_day": 3,
        "points": 5
      }
    ],
    "mission": null
  }
]

export const indicators: Schema<'Indicator'>[] = [
  {
    "id": "heart_rate",
    "name": "Frecuencia cardiaca",
    "unit": "lpm",
    "system_id": "cardiovascular",
    "ranges": {
      "normal": [
        50.0,
        100.0
      ],
      "warning": [
        101.0,
        120.0
      ],
      "critical_low": 40.0,
      "critical_high": 130.0
    },
    "max_age_s": 86400,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 20.0,
      "max": 250.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "Siéntate 5 min en reposo",
      "Mide durante 60 s"
    ],
    "why_it_matters": "La microgravedad redistribuye los fluidos y altera el ritmo cardiaco.",
    "hazards": [
      "gravity"
    ]
  },
  {
    "id": "bp_systolic",
    "name": "Tensión sistólica",
    "unit": "mmHg",
    "system_id": "cardiovascular",
    "ranges": {
      "normal": [
        90.0,
        129.0
      ],
      "warning": [
        130.0,
        159.0
      ],
      "critical_low": 80.0,
      "critical_high": 160.0
    },
    "max_age_s": 172800,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 50.0,
      "max": 250.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "Siéntate 5 min en reposo",
      "Brazo a la altura del corazón"
    ],
    "why_it_matters": "Los cambios de gravedad afectan a la regulación de la tensión.",
    "hazards": [
      "gravity"
    ]
  },
  {
    "id": "bp_diastolic",
    "name": "Tensión diastólica",
    "unit": "mmHg",
    "system_id": "cardiovascular",
    "ranges": {
      "normal": [
        60.0,
        84.0
      ],
      "warning": [
        85.0,
        99.0
      ],
      "critical_low": 50.0,
      "critical_high": 100.0
    },
    "max_age_s": 172800,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 30.0,
      "max": 150.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "Se toma junto con la sistólica"
    ],
    "why_it_matters": "Completa la lectura de la tensión arterial.",
    "hazards": [
      "gravity"
    ]
  },
  {
    "id": "spo2",
    "name": "Saturación de oxígeno",
    "unit": "%",
    "system_id": "cardiovascular",
    "ranges": {
      "normal": [
        95.0,
        100.0
      ],
      "warning": [
        91.0,
        94.0
      ],
      "critical_low": 90.0,
      "critical_high": null
    },
    "max_age_s": 86400,
    "higher_is_worse": false,
    "input": {
      "type": "number",
      "min": 50.0,
      "max": 100.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "Pulsioxímetro en el dedo índice, 30 s"
    ],
    "why_it_matters": "El aire de un hábitat cerrado puede fallar; la SpO₂ lo detecta pronto.",
    "hazards": [
      "hostile_environment"
    ]
  },
  {
    "id": "mood",
    "name": "Ánimo",
    "unit": "1-5",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        3.0,
        5.0
      ],
      "warning": [
        2.0,
        2.9
      ],
      "critical_low": 1.5,
      "critical_high": null
    },
    "max_age_s": 129600,
    "higher_is_worse": false,
    "input": {
      "type": "scale_1_5",
      "min": 1.0,
      "max": 5.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "¿Cómo te sientes hoy? 1 = muy mal, 5 = muy bien"
    ],
    "why_it_matters": "El aislamiento y el confinamiento afectan al ánimo y al rendimiento.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "temperature",
    "name": "Temperatura",
    "unit": "°C",
    "system_id": "immune",
    "ranges": {
      "normal": [
        36.0,
        37.4
      ],
      "warning": [
        37.5,
        38.4
      ],
      "critical_low": 35.0,
      "critical_high": 38.5
    },
    "max_age_s": 86400,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 33.0,
      "max": 43.0,
      "step": 0.1
    },
    "measurement_instructions": [
      "Termómetro bajo la lengua, 1 min"
    ],
    "why_it_matters": "La fiebre puede indicar una infección; el sistema inmune cambia en el espacio.",
    "hazards": [
      "hostile_environment"
    ]
  },
  {
    "id": "glucose",
    "name": "Glucosa",
    "unit": "mg/dL",
    "system_id": "metabolic",
    "ranges": {
      "normal": [
        70.0,
        140.0
      ],
      "warning": [
        141.0,
        180.0
      ],
      "critical_low": 60.0,
      "critical_high": 250.0
    },
    "max_age_s": 86400,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 20.0,
      "max": 600.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "Glucómetro: gota de sangre del dedo"
    ],
    "why_it_matters": "La nutrición en misión es limitada y la glucosa refleja el estado metabólico.",
    "hazards": [
      "distance"
    ]
  },
  {
    "id": "exercise_min",
    "name": "Ejercicio diario",
    "unit": "min",
    "system_id": "musculoskeletal",
    "ranges": {
      "normal": [
        120.0,
        300.0
      ],
      "warning": [
        60.0,
        119.0
      ],
      "critical_low": 30.0,
      "critical_high": null
    },
    "max_age_s": 86400,
    "higher_is_worse": false,
    "input": {
      "type": "duration",
      "min": 0.0,
      "max": 600.0,
      "step": 5.0
    },
    "measurement_instructions": [
      "Minutos de ejercicio resistivo y aeróbico de hoy"
    ],
    "why_it_matters": "Sin gravedad se pierde hueso y músculo; el ejercicio es la contramedida.",
    "hazards": [
      "gravity"
    ]
  },
  {
    "id": "sleep_hours",
    "name": "Horas de sueño",
    "unit": "h",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        7.0,
        10.0
      ],
      "warning": [
        5.0,
        6.9
      ],
      "critical_low": 4.0,
      "critical_high": null
    },
    "max_age_s": 129600,
    "higher_is_worse": false,
    "input": {
      "type": "duration",
      "min": 0.0,
      "max": 16.0,
      "step": 0.5
    },
    "measurement_instructions": [
      "Horas dormidas la última noche"
    ],
    "why_it_matters": "El ciclo luz/oscuridad alterado y el ruido afectan al sueño.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "vision_changes",
    "name": "Cambios en la visión",
    "unit": "1-5",
    "system_id": "eyes",
    "ranges": {
      "normal": [
        1.0,
        1.9
      ],
      "warning": [
        2.0,
        3.4
      ],
      "critical_low": null,
      "critical_high": 3.5
    },
    "max_age_s": 604800,
    "higher_is_worse": true,
    "input": {
      "type": "scale_1_5",
      "min": 1.0,
      "max": 5.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "1 = sin cambios, 5 = visión muy borrosa o distorsionada"
    ],
    "why_it_matters": "El SANS (síndrome neuro-ocular) aparece en misiones largas en microgravedad.",
    "hazards": [
      "gravity"
    ]
  },
  {
    "id": "radiation_dose",
    "name": "Dosis acumulada",
    "unit": "mSv",
    "system_id": "radiation",
    "ranges": {
      "normal": [
        0.0,
        250.0
      ],
      "warning": [
        251.0,
        500.0
      ],
      "critical_low": null,
      "critical_high": 600.0
    },
    "max_age_s": 604800,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 0.0,
      "max": 2000.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "Lectura del dosímetro personal"
    ],
    "why_it_matters": "Fuera de la magnetosfera la radiación aumenta el riesgo de cáncer.",
    "hazards": [
      "radiation"
    ]
  },
  {
    "id": "hydration_ml",
    "name": "Hidratación",
    "unit": "ml",
    "system_id": "metabolic",
    "ranges": {
      "normal": [
        1500.0,
        4000.0
      ],
      "warning": [
        801.0,
        1499.0
      ],
      "critical_low": 800.0,
      "critical_high": null
    },
    "max_age_s": 86400,
    "higher_is_worse": false,
    "input": {
      "type": "number",
      "min": 0.0,
      "max": 6000.0,
      "step": 100.0
    },
    "measurement_instructions": [
      "Suma el agua y las bebidas que has tomado hoy, en ml"
    ],
    "why_it_matters": "La deshidratación afecta a la tensión, a los riñones y a la concentración.",
    "hazards": [
      "hostile_environment"
    ]
  },
  {
    "id": "weight_kg",
    "name": "Peso",
    "unit": "kg",
    "system_id": "metabolic",
    "ranges": {
      "normal": [
        45.0,
        110.0
      ],
      "warning": null,
      "critical_low": 40.0,
      "critical_high": 150.0
    },
    "max_age_s": 604800,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 20.0,
      "max": 250.0,
      "step": 0.1
    },
    "measurement_instructions": [
      "En ayunas, después de ir al baño y con poca ropa"
    ],
    "why_it_matters": "Una pérdida de peso sostenida indica falta de nutrición o pérdida muscular.",
    "hazards": [
      "distance"
    ]
  },
  {
    "id": "stress",
    "name": "Estrés",
    "unit": "1-5",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        1.0,
        3.0
      ],
      "warning": [
        3.1,
        4.4
      ],
      "critical_low": null,
      "critical_high": 4.5
    },
    "max_age_s": 129600,
    "higher_is_worse": true,
    "input": {
      "type": "scale_1_5",
      "min": 1.0,
      "max": 5.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "¿Cuánto estrés sientes hoy? 1 = nada, 5 = muchísimo"
    ],
    "why_it_matters": "El estrés sostenido en confinamiento afecta al sueño, al ánimo y al sistema inmune.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "energy",
    "name": "Energía",
    "unit": "1-5",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        3.0,
        5.0
      ],
      "warning": [
        2.0,
        2.9
      ],
      "critical_low": 1.5,
      "critical_high": null
    },
    "max_age_s": 129600,
    "higher_is_worse": false,
    "input": {
      "type": "scale_1_5",
      "min": 1.0,
      "max": 5.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "¿Cuánta energía tienes hoy? 1 = ninguna, 5 = mucha"
    ],
    "why_it_matters": "La fatiga persistente es una señal temprana de mal sueño o de sobrecarga.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "loneliness",
    "name": "Soledad",
    "unit": "1-5",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        1.0,
        3.0
      ],
      "warning": [
        3.1,
        4.4
      ],
      "critical_low": null,
      "critical_high": 4.5
    },
    "max_age_s": 129600,
    "higher_is_worse": true,
    "input": {
      "type": "scale_1_5",
      "min": 1.0,
      "max": 5.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "¿Te sientes solo/a hoy? 1 = nada, 5 = muchísimo"
    ],
    "why_it_matters": "La soledad es un riesgo de salud en el aislamiento y en la vejez.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "sleep_quality",
    "name": "Calidad del sueño",
    "unit": "1-5",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        3.0,
        5.0
      ],
      "warning": [
        2.0,
        2.9
      ],
      "critical_low": 1.5,
      "critical_high": null
    },
    "max_age_s": 129600,
    "higher_is_worse": false,
    "input": {
      "type": "scale_1_5",
      "min": 1.0,
      "max": 5.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "¿Cómo has dormido? 1 = muy mal, 5 = muy bien"
    ],
    "why_it_matters": "Dormir mal reduce la atención y aumenta el riesgo de errores.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "crew_relation",
    "name": "Relación con el equipo",
    "unit": "1-5",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        3.0,
        5.0
      ],
      "warning": [
        2.0,
        2.9
      ],
      "critical_low": 1.5,
      "critical_high": null
    },
    "max_age_s": 129600,
    "higher_is_worse": false,
    "input": {
      "type": "scale_1_5",
      "min": 1.0,
      "max": 5.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "¿Cómo va la relación con tu equipo? 1 = muy mal, 5 = muy bien"
    ],
    "why_it_matters": "Los conflictos en un grupo aislado afectan al ánimo y a la seguridad.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "pvt_mean_rt_ms",
    "name": "PVT: tiempo de reacción medio",
    "unit": "ms",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        100.0,
        350.0
      ],
      "warning": [
        351.0,
        499.0
      ],
      "critical_low": null,
      "critical_high": 500.0
    },
    "max_age_s": 259200,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 100.0,
      "max": 2000.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "Lo calcula el test PVT: pulsa en cuanto aparezca el estímulo"
    ],
    "why_it_matters": "Un tiempo de reacción más lento es un marcador objetivo de fatiga.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "pvt_lapses",
    "name": "PVT: lapsos",
    "unit": "lapsos",
    "system_id": "neuro_behavioral",
    "ranges": {
      "normal": [
        0.0,
        2.0
      ],
      "warning": [
        3.0,
        5.0
      ],
      "critical_low": null,
      "critical_high": 6.0
    },
    "max_age_s": 259200,
    "higher_is_worse": true,
    "input": {
      "type": "number",
      "min": 0.0,
      "max": 100.0,
      "step": 1.0
    },
    "measurement_instructions": [
      "Lo calcula el test PVT: respuestas de más de 500 ms"
    ],
    "why_it_matters": "Los lapsos de atención aumentan con la falta de sueño y la fatiga.",
    "hazards": [
      "isolation"
    ]
  }
]

export const systems: Schema<'BodySystem'>[] = [
  {
    "id": "cardiovascular",
    "name": "Cardiovascular",
    "svg_region": "heart",
    "indicators": [
      "heart_rate",
      "bp_systolic",
      "bp_diastolic",
      "spo2"
    ],
    "function": "Bombea la sangre y lleva oxígeno a todo el cuerpo.",
    "space_effects": "Redistribución de fluidos hacia la cabeza y desacondicionamiento cardiaco.",
    "hazards": [
      "gravity",
      "radiation"
    ]
  },
  {
    "id": "musculoskeletal",
    "name": "Musculoesquelético",
    "svg_region": "bones",
    "indicators": [
      "exercise_min"
    ],
    "function": "Huesos y músculos: sostén y movimiento.",
    "space_effects": "Sin gravedad se pierde un 1–1,5 % de densidad ósea al mes y masa muscular.",
    "hazards": [
      "gravity"
    ]
  },
  {
    "id": "immune",
    "name": "Inmune",
    "svg_region": "immune",
    "indicators": [
      "temperature"
    ],
    "function": "Defiende al cuerpo de infecciones.",
    "space_effects": "El estrés y el confinamiento alteran la respuesta inmune.",
    "hazards": [
      "hostile_environment",
      "isolation"
    ]
  },
  {
    "id": "metabolic",
    "name": "Metabólico y nutrición",
    "svg_region": "metabolic",
    "indicators": [
      "glucose",
      "hydration_ml",
      "weight_kg"
    ],
    "function": "Convierte los alimentos en energía.",
    "space_effects": "Dieta limitada y cambios hormonales afectan al metabolismo.",
    "hazards": [
      "distance"
    ]
  },
  {
    "id": "neuro_behavioral",
    "name": "Neuro-conductual",
    "svg_region": "brain",
    "indicators": [
      "mood",
      "sleep_hours",
      "stress",
      "energy",
      "loneliness",
      "sleep_quality",
      "crew_relation",
      "pvt_mean_rt_ms",
      "pvt_lapses"
    ],
    "function": "Ánimo, sueño, cognición y relación con la tripulación.",
    "space_effects": "Aislamiento, confinamiento y alteración del sueño afectan al ánimo.",
    "hazards": [
      "isolation"
    ]
  },
  {
    "id": "eyes",
    "name": "Ojos (SANS)",
    "svg_region": "eyes",
    "indicators": [
      "vision_changes"
    ],
    "function": "Visión.",
    "space_effects": "La presión de los fluidos hacia la cabeza puede deformar el globo ocular (SANS).",
    "hazards": [
      "gravity"
    ]
  },
  {
    "id": "radiation",
    "name": "Radiación (todo el cuerpo)",
    "svg_region": "halo",
    "indicators": [
      "radiation_dose"
    ],
    "function": "Exposición acumulada a la radiación espacial.",
    "space_effects": "Fuera de la magnetosfera terrestre la dosis aumenta mucho.",
    "hazards": [
      "radiation"
    ]
  }
]

export const interventions: Schema<'Intervention'>[] = [
  {
    "id": "int_box_breathing",
    "title": "Respiración en caja",
    "category": "stress",
    "system_id": "neuro_behavioral",
    "duration_min": 4,
    "steps": [
      "Inhala 4 s",
      "Mantén 4 s",
      "Exhala 4 s",
      "Mantén 4 s",
      "Repite 4 ciclos"
    ],
    "offline": true
  }
]

export const membersByEnv: Record<string, Schema<'MemberSummary'>[]> = {
  "iss": [
    {
      "id": 3,
      "env_id": "iss",
      "name": "Dra. Lindqvist",
      "position": "flight_engineer",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T10:00:00Z",
      "liveness": "active",
      "overall_status": "normal",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T10:00:00Z"
    }
  ],
  "moon": [],
  "mars": [
    {
      "id": 1,
      "env_id": "mars",
      "name": "Cmdr. Vega",
      "position": "commander",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T10:00:00Z",
      "liveness": "active",
      "overall_status": "warning",
      "open_alerts": 1,
      "last_measurement_at": "2026-11-14T10:00:00Z"
    },
    {
      "id": 2,
      "env_id": "mars",
      "name": "Ing. Okafor",
      "position": "engineer",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T09:48:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T09:48:00Z"
    }
  ],
  "earth": [],
  "hospital": [],
  "geriatric": []
}

export const assessmentByEnv: Record<string, Schema<'Assessment'>> = {
  "iss": {
    "member_id": 1,
    "env_id": "iss",
    "generated_at": "2026-11-14T16:29:14.515456Z",
    "overall_status": "critical",
    "liveness": "active",
    "last_seen_at": "2026-11-14T10:00:00Z",
    "systems": [
      {
        "system_id": "cardiovascular",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "bp_systolic",
            "last_value": 142.0,
            "unit": "mmHg",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": 118.0,
            "range": {
              "normal": [
                90.0,
                129.0
              ],
              "warning": [
                130.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_bp_repeat",
            "text": "Repite la medición en reposo en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sigue el protocolo de tensión alta; si persiste, se avisará a tierra.",
          "protocol_id": "proto_bp_high"
        }
      },
      {
        "system_id": "neuro_behavioral",
        "status": "unknown",
        "indicators": [
          {
            "indicator_id": "mood",
            "last_value": null,
            "unit": "1-5",
            "taken_at": null,
            "status": "unknown",
            "trend": "insufficient_data",
            "baseline": null,
            "range": {
              "normal": [
                3.0,
                5.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_checkin",
            "text": "Haz tu check-in diario",
            "priority": 2,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin datos recientes: haz el check-in.",
          "protocol_id": null
        }
      },
      {
        "system_id": "musculoskeletal",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "exercise_min",
            "last_value": 135.0,
            "unit": "min",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                120.0,
                300.0
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "immune",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "temperature",
            "last_value": 36.7,
            "unit": "°C",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                36.0,
                37.4
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "metabolic",
        "status": "critical",
        "indicators": [
          {
            "indicator_id": "glucose",
            "last_value": 58.0,
            "unit": "mg/dL",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "critical",
            "trend": "falling",
            "baseline": null,
            "range": {
              "normal": [
                70.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_metabolic",
            "text": "Toma 15 g de hidratos rápidos y repite en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 1,
          "target_role": "crew",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Avisa al oficial médico de a bordo.",
          "protocol_id": null
        }
      },
      {
        "system_id": "eyes",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "vision_changes",
            "last_value": 1.0,
            "unit": "1-5",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                1.0,
                1.9
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "radiation",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "radiation_dose",
            "last_value": 310.0,
            "unit": "mSv",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": null,
            "range": {
              "normal": [
                0.0,
                250.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_radiation",
            "text": "Reduce el tiempo fuera del refugio hasta nueva revisión",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      }
    ],
    "behavioral": {
      "status": "unknown",
      "details_visible": true
    },
    "provisional": false
  },
  "moon": {
    "member_id": 1,
    "env_id": "moon",
    "generated_at": "2026-11-14T16:29:14.516985Z",
    "overall_status": "critical",
    "liveness": "active",
    "last_seen_at": "2026-11-14T10:00:00Z",
    "systems": [
      {
        "system_id": "cardiovascular",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "bp_systolic",
            "last_value": 142.0,
            "unit": "mmHg",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": 118.0,
            "range": {
              "normal": [
                90.0,
                129.0
              ],
              "warning": [
                130.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_bp_repeat",
            "text": "Repite la medición en reposo en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 1,
          "message": "Sigue el protocolo de tensión alta; si persiste, se avisará a tierra.",
          "protocol_id": "proto_bp_high"
        }
      },
      {
        "system_id": "neuro_behavioral",
        "status": "unknown",
        "indicators": [
          {
            "indicator_id": "mood",
            "last_value": null,
            "unit": "1-5",
            "taken_at": null,
            "status": "unknown",
            "trend": "insufficient_data",
            "baseline": null,
            "range": {
              "normal": [
                3.0,
                5.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_checkin",
            "text": "Haz tu check-in diario",
            "priority": 2,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin datos recientes: haz el check-in.",
          "protocol_id": null
        }
      },
      {
        "system_id": "musculoskeletal",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "exercise_min",
            "last_value": 135.0,
            "unit": "min",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                120.0,
                300.0
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 1,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "immune",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "temperature",
            "last_value": 36.7,
            "unit": "°C",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                36.0,
                37.4
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 1,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "metabolic",
        "status": "critical",
        "indicators": [
          {
            "indicator_id": "glucose",
            "last_value": 58.0,
            "unit": "mg/dL",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "critical",
            "trend": "falling",
            "baseline": null,
            "range": {
              "normal": [
                70.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_metabolic",
            "text": "Toma 15 g de hidratos rápidos y repite en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 1,
          "target_role": "crew",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Avisa al oficial médico de a bordo.",
          "protocol_id": null
        }
      },
      {
        "system_id": "eyes",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "vision_changes",
            "last_value": 1.0,
            "unit": "1-5",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                1.0,
                1.9
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 1,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "radiation",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "radiation_dose",
            "last_value": 310.0,
            "unit": "mSv",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": null,
            "range": {
              "normal": [
                0.0,
                250.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_radiation",
            "text": "Reduce el tiempo fuera del refugio hasta nueva revisión",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 1,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      }
    ],
    "behavioral": {
      "status": "unknown",
      "details_visible": true
    },
    "provisional": false
  },
  "mars": {
    "member_id": 1,
    "env_id": "mars",
    "generated_at": "2026-11-14T16:29:14.518472Z",
    "overall_status": "critical",
    "liveness": "active",
    "last_seen_at": "2026-11-14T10:00:00Z",
    "systems": [
      {
        "system_id": "cardiovascular",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "bp_systolic",
            "last_value": 142.0,
            "unit": "mmHg",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": 118.0,
            "range": {
              "normal": [
                90.0,
                129.0
              ],
              "warning": [
                130.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_bp_repeat",
            "text": "Repite la medición en reposo en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "autonomous",
          "delay_s": 840,
          "message": "Sigue el protocolo de tensión alta; si persiste, se avisará a tierra.",
          "protocol_id": "proto_bp_high"
        }
      },
      {
        "system_id": "neuro_behavioral",
        "status": "unknown",
        "indicators": [
          {
            "indicator_id": "mood",
            "last_value": null,
            "unit": "1-5",
            "taken_at": null,
            "status": "unknown",
            "trend": "insufficient_data",
            "baseline": null,
            "range": {
              "normal": [
                3.0,
                5.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_checkin",
            "text": "Haz tu check-in diario",
            "priority": 2,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin datos recientes: haz el check-in.",
          "protocol_id": null
        }
      },
      {
        "system_id": "musculoskeletal",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "exercise_min",
            "last_value": 135.0,
            "unit": "min",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                120.0,
                300.0
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 840,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "immune",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "temperature",
            "last_value": 36.7,
            "unit": "°C",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                36.0,
                37.4
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 840,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "metabolic",
        "status": "critical",
        "indicators": [
          {
            "indicator_id": "glucose",
            "last_value": 58.0,
            "unit": "mg/dL",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "critical",
            "trend": "falling",
            "baseline": null,
            "range": {
              "normal": [
                70.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_metabolic",
            "text": "Toma 15 g de hidratos rápidos y repite en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 1,
          "target_role": "crew",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Avisa al oficial médico de a bordo.",
          "protocol_id": null
        }
      },
      {
        "system_id": "eyes",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "vision_changes",
            "last_value": 1.0,
            "unit": "1-5",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                1.0,
                1.9
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 840,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "radiation",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "radiation_dose",
            "last_value": 310.0,
            "unit": "mSv",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": null,
            "range": {
              "normal": [
                0.0,
                250.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_radiation",
            "text": "Reduce el tiempo fuera del refugio hasta nueva revisión",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 840,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      }
    ],
    "behavioral": {
      "status": "unknown",
      "details_visible": true
    },
    "provisional": false
  },
  "earth": {
    "member_id": 1,
    "env_id": "earth",
    "generated_at": "2026-11-14T16:29:14.519912Z",
    "overall_status": "critical",
    "liveness": "active",
    "last_seen_at": "2026-11-14T10:00:00Z",
    "systems": [
      {
        "system_id": "cardiovascular",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "bp_systolic",
            "last_value": 142.0,
            "unit": "mmHg",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": 118.0,
            "range": {
              "normal": [
                90.0,
                129.0
              ],
              "warning": [
                130.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_bp_repeat",
            "text": "Repite la medición en reposo en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sigue el protocolo de tensión alta; si persiste, se avisará a tierra.",
          "protocol_id": "proto_bp_high"
        }
      },
      {
        "system_id": "neuro_behavioral",
        "status": "unknown",
        "indicators": [
          {
            "indicator_id": "mood",
            "last_value": null,
            "unit": "1-5",
            "taken_at": null,
            "status": "unknown",
            "trend": "insufficient_data",
            "baseline": null,
            "range": {
              "normal": [
                3.0,
                5.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_checkin",
            "text": "Haz tu check-in diario",
            "priority": 2,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin datos recientes: haz el check-in.",
          "protocol_id": null
        }
      },
      {
        "system_id": "musculoskeletal",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "exercise_min",
            "last_value": 135.0,
            "unit": "min",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                120.0,
                300.0
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "immune",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "temperature",
            "last_value": 36.7,
            "unit": "°C",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                36.0,
                37.4
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "metabolic",
        "status": "critical",
        "indicators": [
          {
            "indicator_id": "glucose",
            "last_value": 58.0,
            "unit": "mg/dL",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "critical",
            "trend": "falling",
            "baseline": null,
            "range": {
              "normal": [
                70.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_metabolic",
            "text": "Toma 15 g de hidratos rápidos y repite en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 1,
          "target_role": "crew",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Avisa al oficial médico de a bordo.",
          "protocol_id": null
        }
      },
      {
        "system_id": "eyes",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "vision_changes",
            "last_value": 1.0,
            "unit": "1-5",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                1.0,
                1.9
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "radiation",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "radiation_dose",
            "last_value": 310.0,
            "unit": "mSv",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": null,
            "range": {
              "normal": [
                0.0,
                250.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_radiation",
            "text": "Reduce el tiempo fuera del refugio hasta nueva revisión",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      }
    ],
    "behavioral": {
      "status": "unknown",
      "details_visible": true
    },
    "provisional": false
  },
  "hospital": {
    "member_id": 1,
    "env_id": "hospital",
    "generated_at": "2026-11-14T16:29:14.521911Z",
    "overall_status": "critical",
    "liveness": "active",
    "last_seen_at": "2026-11-14T10:00:00Z",
    "systems": [
      {
        "system_id": "cardiovascular",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "bp_systolic",
            "last_value": 142.0,
            "unit": "mmHg",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": 118.0,
            "range": {
              "normal": [
                90.0,
                129.0
              ],
              "warning": [
                130.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_bp_repeat",
            "text": "Repite la medición en reposo en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sigue el protocolo de tensión alta; si persiste, se avisará a tierra.",
          "protocol_id": "proto_bp_high"
        }
      },
      {
        "system_id": "neuro_behavioral",
        "status": "unknown",
        "indicators": [
          {
            "indicator_id": "mood",
            "last_value": null,
            "unit": "1-5",
            "taken_at": null,
            "status": "unknown",
            "trend": "insufficient_data",
            "baseline": null,
            "range": {
              "normal": [
                3.0,
                5.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_checkin",
            "text": "Haz tu check-in diario",
            "priority": 2,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin datos recientes: haz el check-in.",
          "protocol_id": null
        }
      },
      {
        "system_id": "musculoskeletal",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "exercise_min",
            "last_value": 135.0,
            "unit": "min",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                120.0,
                300.0
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "immune",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "temperature",
            "last_value": 36.7,
            "unit": "°C",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                36.0,
                37.4
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "metabolic",
        "status": "critical",
        "indicators": [
          {
            "indicator_id": "glucose",
            "last_value": 58.0,
            "unit": "mg/dL",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "critical",
            "trend": "falling",
            "baseline": null,
            "range": {
              "normal": [
                70.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_metabolic",
            "text": "Toma 15 g de hidratos rápidos y repite en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 1,
          "target_role": "crew",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Avisa al oficial médico de a bordo.",
          "protocol_id": null
        }
      },
      {
        "system_id": "eyes",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "vision_changes",
            "last_value": 1.0,
            "unit": "1-5",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                1.0,
                1.9
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "radiation",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "radiation_dose",
            "last_value": 310.0,
            "unit": "mSv",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": null,
            "range": {
              "normal": [
                0.0,
                250.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_radiation",
            "text": "Reduce el tiempo fuera del refugio hasta nueva revisión",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      }
    ],
    "behavioral": {
      "status": "unknown",
      "details_visible": true
    },
    "provisional": false
  },
  "geriatric": {
    "member_id": 1,
    "env_id": "geriatric",
    "generated_at": "2026-11-14T16:29:14.523726Z",
    "overall_status": "critical",
    "liveness": "active",
    "last_seen_at": "2026-11-14T10:00:00Z",
    "systems": [
      {
        "system_id": "cardiovascular",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "bp_systolic",
            "last_value": 142.0,
            "unit": "mmHg",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": 118.0,
            "range": {
              "normal": [
                90.0,
                129.0
              ],
              "warning": [
                130.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_bp_repeat",
            "text": "Repite la medición en reposo en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sigue el protocolo de tensión alta; si persiste, se avisará a tierra.",
          "protocol_id": "proto_bp_high"
        }
      },
      {
        "system_id": "neuro_behavioral",
        "status": "unknown",
        "indicators": [
          {
            "indicator_id": "mood",
            "last_value": null,
            "unit": "1-5",
            "taken_at": null,
            "status": "unknown",
            "trend": "insufficient_data",
            "baseline": null,
            "range": {
              "normal": [
                3.0,
                5.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_checkin",
            "text": "Haz tu check-in diario",
            "priority": 2,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin datos recientes: haz el check-in.",
          "protocol_id": null
        }
      },
      {
        "system_id": "musculoskeletal",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "exercise_min",
            "last_value": 135.0,
            "unit": "min",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                120.0,
                300.0
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "immune",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "temperature",
            "last_value": 36.7,
            "unit": "°C",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                36.0,
                37.4
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "metabolic",
        "status": "critical",
        "indicators": [
          {
            "indicator_id": "glucose",
            "last_value": 58.0,
            "unit": "mg/dL",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "critical",
            "trend": "falling",
            "baseline": null,
            "range": {
              "normal": [
                70.0,
                140.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_metabolic",
            "text": "Toma 15 g de hidratos rápidos y repite en 15 min",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 1,
          "target_role": "crew",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Avisa al oficial médico de a bordo.",
          "protocol_id": null
        }
      },
      {
        "system_id": "eyes",
        "status": "normal",
        "indicators": [
          {
            "indicator_id": "vision_changes",
            "last_value": 1.0,
            "unit": "1-5",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "normal",
            "trend": "stable",
            "baseline": null,
            "range": {
              "normal": [
                1.0,
                1.9
              ]
            }
          }
        ],
        "recommendations": [],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      },
      {
        "system_id": "radiation",
        "status": "warning",
        "indicators": [
          {
            "indicator_id": "radiation_dose",
            "last_value": 310.0,
            "unit": "mSv",
            "taken_at": "2026-11-14T10:00:00Z",
            "status": "warning",
            "trend": "rising",
            "baseline": null,
            "range": {
              "normal": [
                0.0,
                250.0
              ]
            }
          }
        ],
        "recommendations": [
          {
            "id": "rec_radiation",
            "text": "Reduce el tiempo fuera del refugio hasta nueva revisión",
            "priority": 1,
            "intervention_id": null
          }
        ],
        "escalation": {
          "level": 0,
          "target_role": "self",
          "mode": "realtime",
          "delay_s": 0,
          "message": "Sin acciones necesarias.",
          "protocol_id": null
        }
      }
    ],
    "behavioral": {
      "status": "unknown",
      "details_visible": true
    },
    "provisional": false
  }
}

export const measurements: Schema<'Measurement'>[] = [
  {
    "id": "0b7e5c1a-3f2d-4e8b-9a6c-1d2e3f4a5b6c",
    "indicator_id": "bp_systolic",
    "value": 142.0,
    "taken_at": "2026-11-14T10:00:00Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-14T16:29:14.490810Z"
  }
]

export const alerts: Schema<'Alert'>[] = [
  {
    "id": "6f1c2a9e-0b5d-4c1e-9f3a-2d8e7b6a5c41",
    "member_id": 1,
    "env_id": "mars",
    "origin": "manual",
    "authenticated": true,
    "created_by_user_id": 7,
    "category": "psychological",
    "severity": "warning",
    "system_id": null,
    "indicator_ids": [],
    "message": "Necesito hablar",
    "level": 2,
    "target_role": "ground",
    "delivery_mode": "delayed",
    "delay_s": 840,
    "eta": "2026-11-14T10:14:00Z",
    "delivered_at": null,
    "status": "escalated",
    "created_at": "2026-11-14T10:00:00Z",
    "updated_at": "2026-11-14T10:00:00Z",
    "events": [
      {
        "type": "created",
        "actor": "member",
        "at": "2026-11-14T10:00:00Z",
        "payload": {}
      },
      {
        "type": "queued",
        "actor": "system",
        "at": "2026-11-14T10:00:00Z",
        "payload": {
          "eta_s": 840
        }
      }
    ]
  }
]

export const groundByEnv: Record<string, Schema<'GroundView'>> = {
  "iss": {
    "env_id": "iss",
    "as_of": "2026-11-14T16:29:14.540641Z",
    "link": {
      "env_id": "iss",
      "state": "online",
      "delay_s": 0,
      "queued": 0,
      "since": "2026-11-14T10:00:00Z"
    },
    "members": [
      {
        "id": 3,
        "env_id": "iss",
        "name": "Dra. Lindqvist",
        "position": "flight_engineer",
        "share_behavioral_details": false,
        "last_seen_at": "2026-11-14T10:00:00Z",
        "liveness": "active",
        "overall_status": "normal",
        "open_alerts": 0,
        "last_measurement_at": "2026-11-14T10:00:00Z"
      }
    ],
    "alerts": []
  },
  "moon": {
    "env_id": "moon",
    "as_of": "2026-11-14T16:29:13.542954Z",
    "link": {
      "env_id": "moon",
      "state": "online",
      "delay_s": 1,
      "queued": 0,
      "since": "2026-11-14T10:00:00Z"
    },
    "members": [],
    "alerts": []
  },
  "mars": {
    "env_id": "mars",
    "as_of": "2026-11-14T16:15:14.544367Z",
    "link": {
      "env_id": "mars",
      "state": "delayed",
      "delay_s": 840,
      "queued": 1,
      "since": "2026-11-14T10:00:00Z"
    },
    "members": [
      {
        "id": 1,
        "env_id": "mars",
        "name": "Cmdr. Vega",
        "position": "commander",
        "share_behavioral_details": false,
        "last_seen_at": "2026-11-14T10:00:00Z",
        "liveness": "active",
        "overall_status": "warning",
        "open_alerts": 1,
        "last_measurement_at": "2026-11-14T10:00:00Z"
      },
      {
        "id": 2,
        "env_id": "mars",
        "name": "Ing. Okafor",
        "position": "engineer",
        "share_behavioral_details": false,
        "last_seen_at": "2026-11-14T09:48:00Z",
        "liveness": "stale",
        "overall_status": "unknown",
        "open_alerts": 0,
        "last_measurement_at": "2026-11-14T09:48:00Z"
      }
    ],
    "alerts": []
  },
  "earth": {
    "env_id": "earth",
    "as_of": "2026-11-14T16:29:14.545873Z",
    "link": {
      "env_id": "earth",
      "state": "online",
      "delay_s": 0,
      "queued": 0,
      "since": "2026-11-14T10:00:00Z"
    },
    "members": [],
    "alerts": []
  },
  "hospital": {
    "env_id": "hospital",
    "as_of": "2026-11-14T16:29:14.547176Z",
    "link": {
      "env_id": "hospital",
      "state": "online",
      "delay_s": 0,
      "queued": 0,
      "since": "2026-11-14T10:00:00Z"
    },
    "members": [],
    "alerts": []
  },
  "geriatric": {
    "env_id": "geriatric",
    "as_of": "2026-11-14T16:29:14.548556Z",
    "link": {
      "env_id": "geriatric",
      "state": "online",
      "delay_s": 0,
      "queued": 0,
      "since": "2026-11-14T10:00:00Z"
    },
    "members": [],
    "alerts": []
  }
}

export const tasks: Schema<'Task'>[] = [
  {
    "id": "t_2026-11-14_1_measure_bp",
    "task_type": "measure_bp",
    "title": "Mide tu tensión",
    "points": 10,
    "due": "morning",
    "completed": true,
    "indicator_id": "bp_systolic"
  },
  {
    "id": "t_2026-11-14_1_resistive_exercise",
    "task_type": "resistive_exercise",
    "title": "Ejercicio resistivo (ARED)",
    "points": 20,
    "due": "afternoon",
    "completed": false,
    "indicator_id": null
  },
  {
    "id": "t_2026-11-14_1_checkin",
    "task_type": "checkin",
    "title": "Check-in diario R U OK?",
    "points": 10,
    "due": "any",
    "completed": false,
    "indicator_id": "mood"
  }
]

export const game: Schema<'GameState'> = {
  "points": 340,
  "streak_days": 5,
  "badges": [
    {
      "id": "early_bird",
      "name": "Madrugador",
      "earned_at": "2026-11-14T10:00:00Z"
    }
  ],
  "crew_points": 1820
}

export const leaderboardByEnv: Record<string, Schema<'Leaderboard'>> = {
  "iss": {
    "env_id": "iss",
    "crew_points": 1820,
    "members": [
      {
        "member_id": 1,
        "name": "Cmdr. Vega",
        "points": 340,
        "streak_days": 5
      },
      {
        "member_id": 2,
        "name": "Ing. Okafor",
        "points": 290,
        "streak_days": 3
      }
    ]
  },
  "moon": {
    "env_id": "moon",
    "crew_points": 1820,
    "members": [
      {
        "member_id": 1,
        "name": "Cmdr. Vega",
        "points": 340,
        "streak_days": 5
      },
      {
        "member_id": 2,
        "name": "Ing. Okafor",
        "points": 290,
        "streak_days": 3
      }
    ]
  },
  "mars": {
    "env_id": "mars",
    "crew_points": 1820,
    "members": [
      {
        "member_id": 1,
        "name": "Cmdr. Vega",
        "points": 340,
        "streak_days": 5
      },
      {
        "member_id": 2,
        "name": "Ing. Okafor",
        "points": 290,
        "streak_days": 3
      }
    ]
  },
  "earth": {
    "env_id": "earth",
    "crew_points": 1820,
    "members": [
      {
        "member_id": 1,
        "name": "Cmdr. Vega",
        "points": 340,
        "streak_days": 5
      },
      {
        "member_id": 2,
        "name": "Ing. Okafor",
        "points": 290,
        "streak_days": 3
      }
    ]
  },
  "hospital": {
    "env_id": "hospital",
    "crew_points": 1820,
    "members": [
      {
        "member_id": 1,
        "name": "Cmdr. Vega",
        "points": 340,
        "streak_days": 5
      },
      {
        "member_id": 2,
        "name": "Ing. Okafor",
        "points": 290,
        "streak_days": 3
      }
    ]
  },
  "geriatric": {
    "env_id": "geriatric",
    "crew_points": 1820,
    "members": [
      {
        "member_id": 1,
        "name": "Cmdr. Vega",
        "points": 340,
        "streak_days": 5
      },
      {
        "member_id": 2,
        "name": "Ing. Okafor",
        "points": 290,
        "streak_days": 3
      }
    ]
  }
}

export const linkByEnv: Record<string, Schema<'LinkStatus'>> = {
  "iss": {
    "env_id": "iss",
    "state": "online",
    "delay_s": 0,
    "queued": 0,
    "since": "2026-11-14T10:00:00Z"
  },
  "moon": {
    "env_id": "moon",
    "state": "online",
    "delay_s": 1,
    "queued": 0,
    "since": "2026-11-14T10:00:00Z"
  },
  "mars": {
    "env_id": "mars",
    "state": "delayed",
    "delay_s": 840,
    "queued": 1,
    "since": "2026-11-14T10:00:00Z"
  },
  "earth": {
    "env_id": "earth",
    "state": "online",
    "delay_s": 0,
    "queued": 0,
    "since": "2026-11-14T10:00:00Z"
  },
  "hospital": {
    "env_id": "hospital",
    "state": "online",
    "delay_s": 0,
    "queued": 0,
    "since": "2026-11-14T10:00:00Z"
  },
  "geriatric": {
    "env_id": "geriatric",
    "state": "online",
    "delay_s": 0,
    "queued": 0,
    "since": "2026-11-14T10:00:00Z"
  }
}

export const events: Schema<'Event'>[] = [
  {
    "id": 1,
    "type": "measurement.created",
    "at": "2026-11-14T10:00:00Z",
    "env_id": "mars",
    "member_id": 1,
    "user_id": 7,
    "device_id": "a3f9c2d1-7b6e-4f5a-8c9d-0e1f2a3b4c5d",
    "ref_id": "0b7e5c1a-3f2d-4e8b-9a6c-1d2e3f4a5b6c",
    "summary": "Cmdr. Vega: tensión 142 mmHg",
    "payload": {}
  },
  {
    "id": 2,
    "type": "alert.created",
    "at": "2026-11-14T10:00:00Z",
    "env_id": "mars",
    "member_id": 1,
    "user_id": 7,
    "device_id": "a3f9c2d1-7b6e-4f5a-8c9d-0e1f2a3b4c5d",
    "ref_id": "6f1c2a9e-0b5d-4c1e-9f3a-2d8e7b6a5c41",
    "summary": "Petición de ayuda de Cmdr. Vega",
    "payload": {}
  },
  {
    "id": 3,
    "type": "link.queued",
    "at": "2026-11-14T10:00:00Z",
    "env_id": "mars",
    "member_id": null,
    "user_id": null,
    "device_id": null,
    "ref_id": "6f1c2a9e-0b5d-4c1e-9f3a-2d8e7b6a5c41",
    "summary": "Alerta en cola hacia tierra (ETA 14 min)",
    "payload": {}
  }
]

export const devices: Schema<'Device'>[] = [
  {
    "id": "a3f9c2d1-7b6e-4f5a-8c9d-0e1f2a3b4c5d",
    "user_id": 7,
    "kind": "mobile",
    "label": "movil-vega",
    "ip": "192.168.8.21",
    "user_agent": null,
    "first_seen_at": "2026-11-14T10:00:00Z",
    "last_seen_at": "2026-11-14T10:00:00Z",
    "pending_outbox": 0,
    "last_sync_at": "2026-11-14T10:00:00Z"
  }
]

export const controlOverview: Schema<'ControlOverview'> = {
  "generated_at": "2026-11-14T16:29:14.625232Z",
  "environments": [
    {
      "environment": {
        "id": "iss",
        "name": "Estación Espacial Internacional",
        "kind": "space"
      },
      "link": {
        "env_id": "iss",
        "state": "online",
        "delay_s": 0,
        "queued": 0,
        "since": "2026-11-14T10:00:00Z"
      },
      "members": [
        {
          "id": 3,
          "env_id": "iss",
          "name": "Dra. Lindqvist",
          "position": "flight_engineer",
          "share_behavioral_details": false,
          "last_seen_at": "2026-11-14T10:00:00Z",
          "liveness": "active",
          "overall_status": "normal",
          "open_alerts": 0,
          "last_measurement_at": "2026-11-14T10:00:00Z"
        }
      ],
      "open_alerts": {
        "warning": 0,
        "critical": 0,
        "emergency": 0
      },
      "liveness_paused": false
    },
    {
      "environment": {
        "id": "moon",
        "name": "Base lunar Artemis",
        "kind": "space"
      },
      "link": {
        "env_id": "moon",
        "state": "online",
        "delay_s": 1,
        "queued": 0,
        "since": "2026-11-14T10:00:00Z"
      },
      "members": [],
      "open_alerts": {
        "warning": 0,
        "critical": 0,
        "emergency": 0
      },
      "liveness_paused": false
    },
    {
      "environment": {
        "id": "mars",
        "name": "Base marciana",
        "kind": "space"
      },
      "link": {
        "env_id": "mars",
        "state": "delayed",
        "delay_s": 840,
        "queued": 1,
        "since": "2026-11-14T10:00:00Z"
      },
      "members": [
        {
          "id": 1,
          "env_id": "mars",
          "name": "Cmdr. Vega",
          "position": "commander",
          "share_behavioral_details": false,
          "last_seen_at": "2026-11-14T10:00:00Z",
          "liveness": "active",
          "overall_status": "warning",
          "open_alerts": 1,
          "last_measurement_at": "2026-11-14T10:00:00Z"
        },
        {
          "id": 2,
          "env_id": "mars",
          "name": "Ing. Okafor",
          "position": "engineer",
          "share_behavioral_details": false,
          "last_seen_at": "2026-11-14T09:48:00Z",
          "liveness": "stale",
          "overall_status": "unknown",
          "open_alerts": 0,
          "last_measurement_at": "2026-11-14T09:48:00Z"
        }
      ],
      "open_alerts": {
        "warning": 1,
        "critical": 0,
        "emergency": 0
      },
      "liveness_paused": false
    },
    {
      "environment": {
        "id": "earth",
        "name": "Analógico terrestre",
        "kind": "earth"
      },
      "link": {
        "env_id": "earth",
        "state": "online",
        "delay_s": 0,
        "queued": 0,
        "since": "2026-11-14T10:00:00Z"
      },
      "members": [],
      "open_alerts": {
        "warning": 0,
        "critical": 0,
        "emergency": 0
      },
      "liveness_paused": false
    },
    {
      "environment": {
        "id": "hospital",
        "name": "Planta de hospital",
        "kind": "earth"
      },
      "link": {
        "env_id": "hospital",
        "state": "online",
        "delay_s": 0,
        "queued": 0,
        "since": "2026-11-14T10:00:00Z"
      },
      "members": [],
      "open_alerts": {
        "warning": 0,
        "critical": 0,
        "emergency": 0
      },
      "liveness_paused": false
    },
    {
      "environment": {
        "id": "geriatric",
        "name": "Residencia geriátrica",
        "kind": "earth"
      },
      "link": {
        "env_id": "geriatric",
        "state": "online",
        "delay_s": 0,
        "queued": 0,
        "since": "2026-11-14T10:00:00Z"
      },
      "members": [],
      "open_alerts": {
        "warning": 0,
        "critical": 0,
        "emergency": 0
      },
      "liveness_paused": false
    }
  ],
  "metrics": {
    "measurements_last_hour": 12,
    "open_alerts": 1,
    "active_devices": 1,
    "avg_alert_response_s": 95.0
  }
}

export const networkInfo: Schema<'NetworkInfo'> = {
  "lan_urls": [
    "http://192.168.8.10:8000"
  ],
  "hostname": "ruok-onboard"
}

export const users: Schema<'User'>[] = [
  {
    "id": 7,
    "username": "vega",
    "display_name": "Cmdr. Vega",
    "role": "member",
    "env_id": "mars",
    "member_id": 1,
    "role_label": "astronauta"
  },
  {
    "id": 8,
    "username": "medic-mars",
    "display_name": "Dr. Haddad",
    "role": "medic",
    "env_id": "mars",
    "member_id": null,
    "role_label": "oficial médico"
  },
  {
    "id": 9,
    "username": "surgeon-mars",
    "display_name": "Dra. Ruiz",
    "role": "responder",
    "env_id": "mars",
    "member_id": null,
    "role_label": "flight surgeon"
  },
  {
    "id": 1,
    "username": "admin",
    "display_name": "Operador",
    "role": "admin",
    "env_id": null,
    "member_id": null,
    "role_label": "operador"
  }
]

export const demoUsers: Schema<'DemoUser'>[] = [
  {
    "username": "vega",
    "display_name": "Cmdr. Vega",
    "role": "member",
    "env_id": "mars",
    "role_label": "astronauta"
  },
  {
    "username": "medic-mars",
    "display_name": "Dr. Haddad",
    "role": "medic",
    "env_id": "mars",
    "role_label": "oficial médico"
  },
  {
    "username": "surgeon-mars",
    "display_name": "Dra. Ruiz",
    "role": "responder",
    "env_id": "mars",
    "role_label": "flight surgeon"
  },
  {
    "username": "admin",
    "display_name": "Operador",
    "role": "admin",
    "env_id": null,
    "role_label": "operador"
  }
]

export const tokenTemplate: Schema<'TokenResponse'> = {
  "access_token": "stub-token-7",
  "token_type": "bearer",
  "expires_at": "2026-11-15T04:29:14.637572Z",
  "user": {
    "id": 7,
    "username": "vega",
    "display_name": "Cmdr. Vega",
    "role": "member",
    "env_id": "mars",
    "member_id": 1,
    "role_label": "astronauta"
  }
}

export const heartbeatResult: Schema<'HeartbeatResult'> = {
  "liveness": "active",
  "checkin_required": false
}
