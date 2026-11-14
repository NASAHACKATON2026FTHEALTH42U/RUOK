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
  "server_time": "2026-11-14T17:16:01.841748Z"
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
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "active",
      "overall_status": "normal",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:26:07.358968Z"
    },
    {
      "id": 6,
      "env_id": "iss",
      "name": "Cmdte. Moreau",
      "position": "commander",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:02:32.828547Z"
    },
    {
      "id": 7,
      "env_id": "iss",
      "name": "Esp. Rao",
      "position": "scientist",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T15:56:38.751314Z"
    }
  ],
  "moon": [
    {
      "id": 8,
      "env_id": "moon",
      "name": "Cmdr. Ito",
      "position": "commander",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:22:49.203535Z"
    },
    {
      "id": 9,
      "env_id": "moon",
      "name": "Ing. Silva",
      "position": "engineer",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T15:48:06.841820Z"
    },
    {
      "id": 10,
      "env_id": "moon",
      "name": "Dra. Weber",
      "position": "geologist",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:59:26.383471Z"
    }
  ],
  "mars": [
    {
      "id": 1,
      "env_id": "mars",
      "name": "Cmdr. Vega",
      "position": "commander",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "active",
      "overall_status": "warning",
      "open_alerts": 1,
      "last_measurement_at": "2026-11-14T16:49:30.350583Z"
    },
    {
      "id": 2,
      "env_id": "mars",
      "name": "Ing. Okafor",
      "position": "engineer",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:38:44.115693Z"
    },
    {
      "id": 4,
      "env_id": "mars",
      "name": "Dra. Haddad",
      "position": "medical_officer",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:11:02.360034Z"
    },
    {
      "id": 5,
      "env_id": "mars",
      "name": "Esp. Tanaka",
      "position": "scientist",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T15:55:00.634194Z"
    }
  ],
  "earth": [
    {
      "id": 11,
      "env_id": "earth",
      "name": "Ana Ruiz",
      "position": "participant",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T17:05:17.059793Z"
    },
    {
      "id": 12,
      "env_id": "earth",
      "name": "Leo Park",
      "position": "participant",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:46:12.728452Z"
    },
    {
      "id": 13,
      "env_id": "earth",
      "name": "Marta Gil",
      "position": "participant",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:34:49.251217Z"
    }
  ],
  "hospital": [
    {
      "id": 14,
      "env_id": "hospital",
      "name": "Joan Puig",
      "position": "patient",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:40:15.212296Z"
    },
    {
      "id": 15,
      "env_id": "hospital",
      "name": "Laura Sanz",
      "position": "patient",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:11:44.511251Z"
    },
    {
      "id": 16,
      "env_id": "hospital",
      "name": "Pedro Díaz",
      "position": "patient",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T15:54:09.500902Z"
    }
  ],
  "geriatric": [
    {
      "id": 17,
      "env_id": "geriatric",
      "name": "Rosa Martí",
      "position": "resident",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:18:13.903601Z"
    },
    {
      "id": 18,
      "env_id": "geriatric",
      "name": "Josep Vidal",
      "position": "resident",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:51:29.210944Z"
    },
    {
      "id": 19,
      "env_id": "geriatric",
      "name": "Carmen López",
      "position": "resident",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T15:17:13.417633Z"
    },
    {
      "id": 20,
      "env_id": "geriatric",
      "name": "Antonio Ferrer",
      "position": "resident",
      "share_behavioral_details": false,
      "last_seen_at": "2026-11-14T17:16:00Z",
      "liveness": "stale",
      "overall_status": "unknown",
      "open_alerts": 0,
      "last_measurement_at": "2026-11-14T16:09:07.371617Z"
    }
  ]
}

export const assessmentByEnv: Record<string, Schema<'Assessment'>> = {
  "iss": {
    "member_id": 1,
    "env_id": "iss",
    "generated_at": "2026-11-14T17:16:01.888019Z",
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
    "generated_at": "2026-11-14T17:16:01.893192Z",
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
    "generated_at": "2026-11-14T17:16:01.898109Z",
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
    "generated_at": "2026-11-14T17:16:01.902897Z",
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
    "generated_at": "2026-11-14T17:16:01.907802Z",
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
    "generated_at": "2026-11-14T17:16:01.912550Z",
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
    "id": "008b36e8-6b98-53e1-980f-65cf2c288f03",
    "indicator_id": "spo2",
    "value": 99.0,
    "taken_at": "2026-10-16T11:24:50.655403Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-16T11:25:30.655403Z"
  },
  {
    "id": "d3356888-4cda-5ab4-b743-a351ee0ab2e4",
    "indicator_id": "exercise_min",
    "value": 225.0,
    "taken_at": "2026-10-16T11:57:00.969069Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-16T11:57:49.969069Z"
  },
  {
    "id": "2ee3ccbc-bd07-5317-97d9-b93bd5e79350",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-16T12:34:09.683152Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-16T12:34:18.683152Z"
  },
  {
    "id": "e3544847-c19e-53ce-a0fd-f0175bf21a8d",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-10-16T12:37:15.575321Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-16T12:37:58.575321Z"
  },
  {
    "id": "6a9b584a-6e6e-5073-810b-6defa1344512",
    "indicator_id": "bp_systolic",
    "value": 104.0,
    "taken_at": "2026-10-16T14:33:00.363064Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-16T14:34:14.363064Z"
  },
  {
    "id": "129d71ba-2949-5744-b9cc-3e0282adffc7",
    "indicator_id": "sleep_hours",
    "value": 8.0,
    "taken_at": "2026-10-16T14:55:03.242063Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-16T14:56:14.242063Z"
  },
  {
    "id": "fa0eb64a-9d13-5a21-b0ad-11761ddf44ad",
    "indicator_id": "bp_diastolic",
    "value": 74.0,
    "taken_at": "2026-10-16T16:27:11.275192Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-16T16:27:18.275192Z"
  },
  {
    "id": "ba27f517-3425-5ab3-9abc-586ec3596c8f",
    "indicator_id": "heart_rate",
    "value": 80.0,
    "taken_at": "2026-10-16T16:50:14.913705Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-16T16:51:25.913705Z"
  },
  {
    "id": "066aec54-c283-54f2-8f7a-6ef927168a5a",
    "indicator_id": "exercise_min",
    "value": 200.0,
    "taken_at": "2026-10-17T11:35:04.436756Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-17T11:36:23.436756Z"
  },
  {
    "id": "4ce35266-176a-5000-9952-b262b7d45263",
    "indicator_id": "temperature",
    "value": 36.6,
    "taken_at": "2026-10-17T11:51:17.294913Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-17T11:52:32.294913Z"
  },
  {
    "id": "4a90b68d-d52e-59d0-a7d5-5ad78b3595fd",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-17T12:17:46.950058Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-17T12:18:35.950058Z"
  },
  {
    "id": "212434b4-79b8-5e28-b439-308c60fb73a8",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-17T13:08:36.227455Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-17T13:09:40.227455Z"
  },
  {
    "id": "f7e3e624-5998-5dfd-a27f-d0570405831f",
    "indicator_id": "bp_systolic",
    "value": 106.0,
    "taken_at": "2026-10-17T14:22:04.503855Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-17T14:22:42.503855Z"
  },
  {
    "id": "500cadaf-4338-518a-8887-3a831f36b00a",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-17T14:59:41.838044Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-17T15:00:47.838044Z"
  },
  {
    "id": "1c214c38-7b87-54bb-a014-8b4ae1c99bda",
    "indicator_id": "bp_diastolic",
    "value": 72.0,
    "taken_at": "2026-10-17T16:08:52.298618Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-17T16:09:51.298618Z"
  },
  {
    "id": "01d16998-ee56-58ec-979d-7bd29fe2309b",
    "indicator_id": "heart_rate",
    "value": 82.0,
    "taken_at": "2026-10-17T16:31:56.353943Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-17T16:32:07.353943Z"
  },
  {
    "id": "bb38e0ce-c310-577d-bad6-0fa4221a669f",
    "indicator_id": "radiation_dose",
    "value": 51.0,
    "taken_at": "2026-10-17T16:36:22.319577Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mSv",
    "received_at": "2026-10-17T16:37:52.319577Z"
  },
  {
    "id": "5f16bacf-6567-5d17-b115-f360d799f3d6",
    "indicator_id": "exercise_min",
    "value": 205.0,
    "taken_at": "2026-10-18T11:46:44.718004Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-18T11:48:12.718004Z"
  },
  {
    "id": "5ae46685-c747-5b69-bce8-e112743ed19a",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-18T12:05:45.813754Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-18T12:06:25.813754Z"
  },
  {
    "id": "7d9d8965-1525-533e-9c41-b4adb1fdb7e9",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-10-18T12:37:26.397192Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-18T12:37:58.397192Z"
  },
  {
    "id": "e095c3c1-bea2-510d-a2eb-05996e87e3e7",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-18T12:47:33.101068Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-18T12:48:19.101068Z"
  },
  {
    "id": "68071ee7-30e7-5060-92bd-70170990933e",
    "indicator_id": "bp_systolic",
    "value": 99.0,
    "taken_at": "2026-10-18T14:52:07.971942Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-18T14:52:29.971942Z"
  },
  {
    "id": "3e21a661-abf3-5453-af0d-396f103a9ac1",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-18T14:59:46.253124Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-18T15:00:28.253124Z"
  },
  {
    "id": "5979ae2e-6e95-5ce5-8999-7f78adf873fc",
    "indicator_id": "bp_diastolic",
    "value": 77.0,
    "taken_at": "2026-10-18T16:23:51.883708Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-18T16:24:06.883708Z"
  },
  {
    "id": "ddba1f30-c594-576f-b67d-cd6b3e50a951",
    "indicator_id": "heart_rate",
    "value": 84.0,
    "taken_at": "2026-10-18T17:08:59.522835Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-18T17:09:40.522835Z"
  },
  {
    "id": "0f963842-cdf5-52e2-9aab-8d85e0260f97",
    "indicator_id": "spo2",
    "value": 99.0,
    "taken_at": "2026-10-19T11:37:04.207716Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-19T11:38:08.207716Z"
  },
  {
    "id": "642d5640-eb87-5fce-aa92-4ecb510559d3",
    "indicator_id": "temperature",
    "value": 36.4,
    "taken_at": "2026-10-19T11:55:03.265614Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-19T11:56:16.265614Z"
  },
  {
    "id": "9d10e394-1afe-5909-883a-4aacad1cb613",
    "indicator_id": "exercise_min",
    "value": 240.0,
    "taken_at": "2026-10-19T12:11:15.001482Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-19T12:11:46.001482Z"
  },
  {
    "id": "d7415868-1c84-58a6-acea-5c661d61d3cb",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-19T12:33:06.923221Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-19T12:34:11.923221Z"
  },
  {
    "id": "bd8328af-b6a2-5e24-ba75-31370ecbac1b",
    "indicator_id": "sleep_hours",
    "value": 9.0,
    "taken_at": "2026-10-19T14:39:54.165043Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-19T14:41:00.165043Z"
  },
  {
    "id": "cac017b8-b3ab-5990-878f-177b3d48cf68",
    "indicator_id": "bp_systolic",
    "value": 106.0,
    "taken_at": "2026-10-19T14:55:21.542679Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-19T14:56:18.542679Z"
  },
  {
    "id": "a2639039-4102-5684-a11e-cff8c21fad1d",
    "indicator_id": "bp_diastolic",
    "value": 72.0,
    "taken_at": "2026-10-19T16:10:59.854120Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-19T16:11:42.854120Z"
  },
  {
    "id": "f7f1da4a-321d-5c02-b923-ee723964228a",
    "indicator_id": "heart_rate",
    "value": 75.0,
    "taken_at": "2026-10-19T16:21:21.277196Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-19T16:22:32.277196Z"
  },
  {
    "id": "49be7461-3d45-56a7-9099-37a204acc12e",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-20T11:27:27.073984Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-20T11:27:45.073984Z"
  },
  {
    "id": "f2875ab7-852d-5263-b7b4-ebb94019e3b2",
    "indicator_id": "exercise_min",
    "value": 210.0,
    "taken_at": "2026-10-20T11:35:52.237368Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-20T11:36:16.237368Z"
  },
  {
    "id": "21fff843-59fe-517c-aa36-f15c756bc44f",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-10-20T12:09:29.529828Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-20T12:10:58.529828Z"
  },
  {
    "id": "28e62a70-00f3-54fc-99ef-739257d1b051",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-20T13:02:53.147885Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-20T13:03:13.147885Z"
  },
  {
    "id": "83a81113-f3d7-57c7-8cdc-c32c7437bdfe",
    "indicator_id": "bp_systolic",
    "value": 106.0,
    "taken_at": "2026-10-20T14:09:47.644250Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-20T14:10:03.644250Z"
  },
  {
    "id": "9d0ece06-c1f3-5d13-95ce-bdfb015232ca",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-20T15:05:29.210820Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-20T15:06:15.210820Z"
  },
  {
    "id": "d6b719c6-c335-5814-b5d0-12ee11fa4618",
    "indicator_id": "bp_diastolic",
    "value": 71.0,
    "taken_at": "2026-10-20T15:44:06.808977Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-20T15:45:07.808977Z"
  },
  {
    "id": "fec866b3-85a1-50d1-b1a6-3af1575819c5",
    "indicator_id": "heart_rate",
    "value": 77.0,
    "taken_at": "2026-10-20T16:28:12.634185Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-20T16:29:05.634185Z"
  },
  {
    "id": "23966b43-34ec-5bcb-a800-ca5c0a5da4f2",
    "indicator_id": "spo2",
    "value": 97.0,
    "taken_at": "2026-10-21T11:34:02.974361Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-21T11:34:14.974361Z"
  },
  {
    "id": "2c193682-1b0a-5e57-8462-abf66ad9285f",
    "indicator_id": "exercise_min",
    "value": 220.0,
    "taken_at": "2026-10-21T12:17:02.052753Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-21T12:18:15.052753Z"
  },
  {
    "id": "8831039f-0bf6-5be3-90a2-1c6c4a6f3a04",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-21T12:30:20.729754Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-21T12:30:41.729754Z"
  },
  {
    "id": "b17d6e67-ccf7-56aa-b901-a3ef26d9d3d8",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-10-21T12:35:20.291061Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-21T12:35:32.291061Z"
  },
  {
    "id": "cb95e37e-9b4f-5060-9ab3-bf004ed52415",
    "indicator_id": "bp_systolic",
    "value": 103.0,
    "taken_at": "2026-10-21T14:28:12.498142Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-21T14:28:43.498142Z"
  },
  {
    "id": "8216e2ea-b06b-51b1-a133-a3511fb29fa3",
    "indicator_id": "sleep_hours",
    "value": 8.0,
    "taken_at": "2026-10-21T14:59:52.973335Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-21T15:01:06.973335Z"
  },
  {
    "id": "6cf09371-718d-5573-ac8f-ab217bb46cdc",
    "indicator_id": "bp_diastolic",
    "value": 73.0,
    "taken_at": "2026-10-21T15:45:29.011009Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-21T15:45:50.011009Z"
  },
  {
    "id": "8d6784a6-e220-5b31-85ae-8c0434e82952",
    "indicator_id": "heart_rate",
    "value": 83.0,
    "taken_at": "2026-10-21T16:32:36.523422Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-21T16:32:52.523422Z"
  },
  {
    "id": "06bc701b-e561-5ce9-bebb-757788e84df0",
    "indicator_id": "exercise_min",
    "value": 220.0,
    "taken_at": "2026-10-22T11:36:31.792167Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-22T11:37:29.792167Z"
  },
  {
    "id": "a96cba76-e4b6-5fc3-9938-89ed0dcb9a21",
    "indicator_id": "spo2",
    "value": 97.0,
    "taken_at": "2026-10-22T11:47:23.014642Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-22T11:48:13.014642Z"
  },
  {
    "id": "08f5c676-8c4e-5b9f-b44d-38987b381fc9",
    "indicator_id": "temperature",
    "value": 36.7,
    "taken_at": "2026-10-22T12:29:06.525514Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-22T12:29:09.525514Z"
  },
  {
    "id": "51f19993-f820-5e80-b359-3c1030f11ffd",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-22T13:19:45.468634Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-22T13:21:10.468634Z"
  },
  {
    "id": "19fd364b-48b3-54bd-8091-280ef75a7d13",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-22T14:36:17.275756Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-22T14:37:42.275756Z"
  },
  {
    "id": "b0d158f3-23c3-5a17-a3ce-f9567e44b98d",
    "indicator_id": "bp_systolic",
    "value": 98.0,
    "taken_at": "2026-10-22T14:48:26.366259Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-22T14:48:34.366259Z"
  },
  {
    "id": "f25e3642-2617-5406-bd31-2397f088d186",
    "indicator_id": "bp_diastolic",
    "value": 68.0,
    "taken_at": "2026-10-22T15:32:26.141411Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-22T15:33:31.141411Z"
  },
  {
    "id": "7bf983c3-107c-51c9-9a64-4502c4d77b85",
    "indicator_id": "heart_rate",
    "value": 75.0,
    "taken_at": "2026-10-22T17:03:55.938861Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-22T17:05:21.938861Z"
  },
  {
    "id": "298441d5-7f07-5c38-8024-4a8f91926968",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-23T12:02:53.187394Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-23T12:03:47.187394Z"
  },
  {
    "id": "dd6af69c-4858-59fa-aa85-883d9dd2d4b1",
    "indicator_id": "exercise_min",
    "value": 230.0,
    "taken_at": "2026-10-23T12:24:09.748553Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-23T12:24:54.748553Z"
  },
  {
    "id": "f42f95a8-93fa-5a7d-b3d0-0cbe9aaf83fa",
    "indicator_id": "temperature",
    "value": 36.4,
    "taken_at": "2026-10-23T12:35:39.647300Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-23T12:36:19.647300Z"
  },
  {
    "id": "c2f76fa8-9038-5da4-930d-771e17bab103",
    "indicator_id": "mood",
    "value": 3.0,
    "taken_at": "2026-10-23T13:18:26.639840Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-23T13:19:51.639840Z"
  },
  {
    "id": "93f37a48-4168-5131-b454-4ea9250e30bc",
    "indicator_id": "bp_systolic",
    "value": 110.0,
    "taken_at": "2026-10-23T14:32:03.122988Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-23T14:32:25.122988Z"
  },
  {
    "id": "4486006f-beb7-5eb0-8f1a-b9a93d931029",
    "indicator_id": "sleep_hours",
    "value": 9.0,
    "taken_at": "2026-10-23T15:00:06.162725Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-23T15:01:24.162725Z"
  },
  {
    "id": "5b84ade9-541b-5b62-a174-0b56e2bb3206",
    "indicator_id": "heart_rate",
    "value": 87.0,
    "taken_at": "2026-10-23T16:16:21.428323Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-23T16:17:11.428323Z"
  },
  {
    "id": "b16301a9-5204-5a64-9959-8dc7f1bb76c3",
    "indicator_id": "bp_diastolic",
    "value": 71.0,
    "taken_at": "2026-10-23T16:29:53.264329Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-23T16:30:35.264329Z"
  },
  {
    "id": "c7761f25-4902-5598-83a3-a9c4855c8de9",
    "indicator_id": "exercise_min",
    "value": 230.0,
    "taken_at": "2026-10-24T12:17:29.702718Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-24T12:18:28.702718Z"
  },
  {
    "id": "3d940f77-7ae9-58ef-9c91-a498e929f9a8",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-24T12:18:10.707661Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-24T12:19:27.707661Z"
  },
  {
    "id": "3ee3ff6d-f132-5eae-af21-00d2603be651",
    "indicator_id": "temperature",
    "value": 36.4,
    "taken_at": "2026-10-24T12:22:37.286800Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-24T12:22:40.286800Z"
  },
  {
    "id": "e1f0b6d9-fc39-5b45-89ef-939c3795680a",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-24T13:23:12.975815Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-24T13:24:36.975815Z"
  },
  {
    "id": "067d9ddf-5949-5ded-90ff-c0ec39913f90",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-24T14:32:32.657421Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-24T14:32:37.657421Z"
  },
  {
    "id": "abd59d24-616b-5dad-96f4-a5fbfbc3c506",
    "indicator_id": "bp_systolic",
    "value": 104.0,
    "taken_at": "2026-10-24T14:57:16.742823Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-24T14:57:35.742823Z"
  },
  {
    "id": "7a654e0d-c125-5910-ba82-edfaadf431ab",
    "indicator_id": "bp_diastolic",
    "value": 69.0,
    "taken_at": "2026-10-24T15:41:59.288638Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-24T15:42:12.288638Z"
  },
  {
    "id": "1661cece-5e22-5604-9c07-6901654564d0",
    "indicator_id": "radiation_dose",
    "value": 56.0,
    "taken_at": "2026-10-24T16:22:19.402279Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mSv",
    "received_at": "2026-10-24T16:22:42.402279Z"
  },
  {
    "id": "0bcf8c47-4afd-5a0c-be46-6359952604eb",
    "indicator_id": "heart_rate",
    "value": 88.0,
    "taken_at": "2026-10-24T16:33:16.415767Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-24T16:33:26.415767Z"
  },
  {
    "id": "8586e138-fbab-552e-9bf8-f0ae5f4bdffe",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-25T11:56:12.745080Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-25T11:57:30.745080Z"
  },
  {
    "id": "b259bbee-5779-5e61-bf04-5e075b6eb024",
    "indicator_id": "temperature",
    "value": 36.3,
    "taken_at": "2026-10-25T12:12:09.296390Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-25T12:13:15.296390Z"
  },
  {
    "id": "2fbf5b6b-3b6d-5bb8-8a0c-1bfac3f0dd84",
    "indicator_id": "exercise_min",
    "value": 225.0,
    "taken_at": "2026-10-25T12:15:07.944282Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-25T12:15:42.944282Z"
  },
  {
    "id": "fbc6b214-1300-5db6-9404-2500ff1d13b2",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-25T12:32:24.306255Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-25T12:33:38.306255Z"
  },
  {
    "id": "5c12b44d-58f2-5b88-ad6a-c256140a773c",
    "indicator_id": "bp_systolic",
    "value": 109.0,
    "taken_at": "2026-10-25T14:25:49.129767Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-25T14:26:24.129767Z"
  },
  {
    "id": "7918b5b4-b452-5a36-b1a8-b241d30cea20",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-25T15:02:53.657649Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-25T15:04:09.657649Z"
  },
  {
    "id": "4fd0bcd9-d17d-596e-ab46-6c50ae931ad1",
    "indicator_id": "bp_diastolic",
    "value": 69.0,
    "taken_at": "2026-10-25T15:42:40.513361Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-25T15:42:55.513361Z"
  },
  {
    "id": "aaf030cb-315a-5413-a7d3-56818719d7ae",
    "indicator_id": "heart_rate",
    "value": 78.0,
    "taken_at": "2026-10-25T16:43:20.285933Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-25T16:43:35.285933Z"
  },
  {
    "id": "7982bfbc-ad74-5e81-b6a0-ac39ea5d86eb",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-26T11:33:12.180897Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-26T11:33:36.180897Z"
  },
  {
    "id": "fef4ca18-fe13-51c0-bdcd-888ad9074151",
    "indicator_id": "exercise_min",
    "value": 210.0,
    "taken_at": "2026-10-26T11:45:18.040940Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-26T11:45:21.040940Z"
  },
  {
    "id": "61dcd1fc-8bea-594c-924f-b5c051b254f9",
    "indicator_id": "temperature",
    "value": 36.3,
    "taken_at": "2026-10-26T11:59:10.058391Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-26T12:00:06.058391Z"
  },
  {
    "id": "2ff37b7b-99d1-586c-879e-9f7b0d5f5a8b",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-26T13:21:42.258816Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-26T13:21:56.258816Z"
  },
  {
    "id": "ed468896-fa81-5b7e-a37d-df08e9470bb5",
    "indicator_id": "bp_systolic",
    "value": 115.0,
    "taken_at": "2026-10-26T14:14:45.290297Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-26T14:15:08.290297Z"
  },
  {
    "id": "3b0105e1-a103-52ff-9414-20006858268e",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-26T14:41:24.923717Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-26T14:42:07.923717Z"
  },
  {
    "id": "efd96d75-d332-5f9b-978e-622ec8e9c305",
    "indicator_id": "heart_rate",
    "value": 86.0,
    "taken_at": "2026-10-26T16:10:45.035604Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-26T16:11:26.035604Z"
  },
  {
    "id": "8f213497-2d97-5a98-99e8-727035f464ad",
    "indicator_id": "bp_diastolic",
    "value": 74.0,
    "taken_at": "2026-10-26T16:31:23.327730Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-26T16:31:42.327730Z"
  },
  {
    "id": "5c21b5e0-746b-5a06-9c10-7abc0f0b5350",
    "indicator_id": "exercise_min",
    "value": 225.0,
    "taken_at": "2026-10-27T11:49:02.705569Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-27T11:50:16.705569Z"
  },
  {
    "id": "7dd9a3df-eeab-5546-8736-8990806c453a",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-27T12:02:25.487164Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-27T12:03:14.487164Z"
  },
  {
    "id": "cec774cc-9018-5f60-889d-567416687ca9",
    "indicator_id": "temperature",
    "value": 36.7,
    "taken_at": "2026-10-27T12:16:55.451476Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-27T12:17:16.451476Z"
  },
  {
    "id": "ed6ab8e5-aa22-512f-a7aa-778cbf4a6041",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-27T12:37:44.397689Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-27T12:38:56.397689Z"
  },
  {
    "id": "895ce59e-a9cf-53a9-9cda-eec58cfa04ca",
    "indicator_id": "bp_systolic",
    "value": 105.0,
    "taken_at": "2026-10-27T14:16:41.387514Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-27T14:18:00.387514Z"
  },
  {
    "id": "b011b2fd-8415-5b7a-a86d-22dff64c23b4",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-27T14:49:40.578690Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-27T14:50:08.578690Z"
  },
  {
    "id": "913cdc48-6843-52f2-adf1-e32e7763c7a4",
    "indicator_id": "heart_rate",
    "value": 85.0,
    "taken_at": "2026-10-27T16:29:38.731540Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-27T16:30:31.731540Z"
  },
  {
    "id": "f56893ef-1481-592d-b36d-158bf6213c3b",
    "indicator_id": "bp_diastolic",
    "value": 70.0,
    "taken_at": "2026-10-27T16:31:05.477787Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-27T16:31:49.477787Z"
  },
  {
    "id": "c9fd8a08-de17-53c2-98a2-a3f405092d92",
    "indicator_id": "temperature",
    "value": 36.6,
    "taken_at": "2026-10-28T12:14:08.041621Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-28T12:14:21.041621Z"
  },
  {
    "id": "0fb564c3-6f84-5894-883e-315f2791e419",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-28T12:14:10.499167Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-28T12:15:35.499167Z"
  },
  {
    "id": "989c69e1-023f-5912-a960-5259c86fd0a0",
    "indicator_id": "exercise_min",
    "value": 245.0,
    "taken_at": "2026-10-28T12:25:00.608014Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-28T12:25:28.608014Z"
  },
  {
    "id": "424f5938-42fe-57d6-bf14-199a35d5cb16",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-28T13:16:14.019719Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-28T13:16:31.019719Z"
  },
  {
    "id": "308b98cf-b739-508e-bf17-97961beca94b",
    "indicator_id": "bp_systolic",
    "value": 105.0,
    "taken_at": "2026-10-28T14:56:33.989551Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-28T14:57:33.989551Z"
  },
  {
    "id": "3298fdcd-fc71-51a1-9905-72f97e495805",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-28T15:05:21.283196Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-28T15:06:27.283196Z"
  },
  {
    "id": "d5c7f5f9-8047-587b-a685-b848f8f8a596",
    "indicator_id": "heart_rate",
    "value": 82.0,
    "taken_at": "2026-10-28T16:14:00.443610Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-28T16:15:20.443610Z"
  },
  {
    "id": "a5036c66-fd5c-52d3-a4db-2ef7c4290988",
    "indicator_id": "bp_diastolic",
    "value": 74.0,
    "taken_at": "2026-10-28T16:29:00.776077Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-28T16:30:28.776077Z"
  },
  {
    "id": "65794c7e-dfc9-5f4f-9d34-0c99784bc623",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-29T11:39:56.950830Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-29T11:40:05.950830Z"
  },
  {
    "id": "a7d479fb-9de8-5bed-ae46-271ae6852fd9",
    "indicator_id": "temperature",
    "value": 36.7,
    "taken_at": "2026-10-29T12:16:02.937316Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-29T12:17:21.937316Z"
  },
  {
    "id": "e5772333-a7a5-517f-bf02-2e795224b456",
    "indicator_id": "exercise_min",
    "value": 235.0,
    "taken_at": "2026-10-29T12:26:57.592569Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-29T12:28:23.592569Z"
  },
  {
    "id": "d63de4b1-b00b-5a97-beb3-fe831b84b126",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-29T13:27:47.520192Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-29T13:29:12.520192Z"
  },
  {
    "id": "2052d3c2-4b65-5db1-9fb1-c605fde488fd",
    "indicator_id": "bp_systolic",
    "value": 106.0,
    "taken_at": "2026-10-29T14:48:11.932249Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-29T14:48:45.932249Z"
  },
  {
    "id": "1a1a0279-20de-580e-8069-e0288e01f916",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-29T14:50:40.716462Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-29T14:51:43.716462Z"
  },
  {
    "id": "ae3c6b67-a652-598e-9322-75d4cf88d78b",
    "indicator_id": "bp_diastolic",
    "value": 70.0,
    "taken_at": "2026-10-29T16:12:24.605392Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-29T16:13:40.605392Z"
  },
  {
    "id": "47ce21e7-5a08-533e-ba59-d6341261ab44",
    "indicator_id": "heart_rate",
    "value": 89.0,
    "taken_at": "2026-10-29T16:18:39.463022Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-29T16:18:57.463022Z"
  },
  {
    "id": "63d8ff96-20ea-5696-9dae-60b8657af2a7",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-10-30T11:35:12.519534Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-30T11:36:22.519534Z"
  },
  {
    "id": "c149ba3a-821f-59e4-a815-181dd96364f1",
    "indicator_id": "exercise_min",
    "value": 235.0,
    "taken_at": "2026-10-30T12:23:02.824047Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-30T12:24:27.824047Z"
  },
  {
    "id": "9725c770-64c5-527e-822d-698fc34a9f02",
    "indicator_id": "temperature",
    "value": 36.7,
    "taken_at": "2026-10-30T12:45:35.209127Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-30T12:45:47.209127Z"
  },
  {
    "id": "b76aaf55-6745-5c3a-b55a-52614d8d8f1b",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-30T13:24:11.974578Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-30T13:25:27.974578Z"
  },
  {
    "id": "be2baf92-2799-59f4-aeaa-b27df21fd40c",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-30T14:36:45.632543Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-30T14:37:38.632543Z"
  },
  {
    "id": "afc075a3-219a-5360-81dc-527c8fd2d72f",
    "indicator_id": "bp_systolic",
    "value": 105.0,
    "taken_at": "2026-10-30T15:03:19.064159Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-30T15:04:16.064159Z"
  },
  {
    "id": "f2b18fe5-0837-5435-96f7-3c3acf4aacb1",
    "indicator_id": "bp_diastolic",
    "value": 76.0,
    "taken_at": "2026-10-30T16:13:47.987643Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-30T16:15:13.987643Z"
  },
  {
    "id": "0d5bd37e-b076-5a90-a1ac-9c6053a1f3a9",
    "indicator_id": "heart_rate",
    "value": 83.0,
    "taken_at": "2026-10-30T16:16:30.586137Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-30T16:17:19.586137Z"
  },
  {
    "id": "c3ae9a4d-e4ec-5a83-867f-0c2174c65b56",
    "indicator_id": "exercise_min",
    "value": 220.0,
    "taken_at": "2026-10-31T11:43:25.442319Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-10-31T11:44:51.442319Z"
  },
  {
    "id": "6862daaf-8924-55ae-80d3-a4bae5fa6750",
    "indicator_id": "spo2",
    "value": 97.0,
    "taken_at": "2026-10-31T12:00:02.003698Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-10-31T12:00:58.003698Z"
  },
  {
    "id": "6105d6ef-11cb-5589-a343-c51e7db37220",
    "indicator_id": "temperature",
    "value": 36.7,
    "taken_at": "2026-10-31T12:21:14.554645Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-10-31T12:22:25.554645Z"
  },
  {
    "id": "de8d56cb-41bd-5fde-bd62-eb0884805d34",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-10-31T12:43:54.094964Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-10-31T12:45:00.094964Z"
  },
  {
    "id": "b37f69d8-b94d-5879-965a-55a69385d057",
    "indicator_id": "bp_systolic",
    "value": 105.0,
    "taken_at": "2026-10-31T14:40:20.663126Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-31T14:41:09.663126Z"
  },
  {
    "id": "4b9765e5-3fdf-5537-ac13-74941c3fe384",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-10-31T14:45:01.021558Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-10-31T14:45:42.021558Z"
  },
  {
    "id": "cc42d565-9260-5a91-bbde-f9ce24c25c02",
    "indicator_id": "bp_diastolic",
    "value": 73.0,
    "taken_at": "2026-10-31T16:19:01.798699Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-10-31T16:20:22.798699Z"
  },
  {
    "id": "79bca99b-fc52-5cfa-9664-7cfd2d371856",
    "indicator_id": "heart_rate",
    "value": 80.0,
    "taken_at": "2026-10-31T16:27:28.335076Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-10-31T16:27:47.335076Z"
  },
  {
    "id": "5ed76d6b-e329-5c68-a786-d508e5955217",
    "indicator_id": "radiation_dose",
    "value": 60.0,
    "taken_at": "2026-10-31T16:45:55.358257Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mSv",
    "received_at": "2026-10-31T16:47:02.358257Z"
  },
  {
    "id": "40a5d35e-065f-50c8-adea-86e66122dd10",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-01T11:59:20.524702Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-01T12:00:21.524702Z"
  },
  {
    "id": "259a2ac7-51e6-5bfa-9e8c-e4990d356307",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-11-01T12:07:50.252268Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-01T12:08:19.252268Z"
  },
  {
    "id": "7680c291-b6eb-58df-b60b-4ab5d650a3e5",
    "indicator_id": "exercise_min",
    "value": 220.0,
    "taken_at": "2026-11-01T12:20:22.447523Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-01T12:21:16.447523Z"
  },
  {
    "id": "e8676edd-b1cf-54b3-87c4-536e167265a0",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-01T12:50:18.468052Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-01T12:50:52.468052Z"
  },
  {
    "id": "e4aa01b6-5232-5fd0-8ced-bd2bb8518f51",
    "indicator_id": "bp_systolic",
    "value": 98.0,
    "taken_at": "2026-11-01T14:17:16.901939Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-01T14:17:57.901939Z"
  },
  {
    "id": "f8dafbc9-3c38-5dec-8291-c8848be1b00f",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-01T15:07:55.655969Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-01T15:08:24.655969Z"
  },
  {
    "id": "d182962a-e6a1-5a10-8ec0-cb53fdbdf0b4",
    "indicator_id": "bp_diastolic",
    "value": 75.0,
    "taken_at": "2026-11-01T15:57:56.648399Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-01T15:58:28.648399Z"
  },
  {
    "id": "0eff4808-1667-59ee-b6ac-722b0cebbc9c",
    "indicator_id": "heart_rate",
    "value": 85.0,
    "taken_at": "2026-11-01T16:13:15.709894Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-01T16:13:24.709894Z"
  },
  {
    "id": "5e487921-a75a-5cfa-babc-914285513bd3",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-11-02T11:52:01.098322Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-02T11:52:56.098322Z"
  },
  {
    "id": "26b2f1b6-fa11-5022-86af-3a3245d029fe",
    "indicator_id": "exercise_min",
    "value": 255.0,
    "taken_at": "2026-11-02T11:59:01.521969Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-02T12:00:13.521969Z"
  },
  {
    "id": "b8b088a1-592c-5a94-9b6d-530ab2b50536",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-02T12:18:17.540970Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-02T12:19:22.540970Z"
  },
  {
    "id": "90aa37d2-7be2-56a7-bd7a-f7c32d4a726f",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-02T12:47:04.587600Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-02T12:47:23.587600Z"
  },
  {
    "id": "5cdbb479-e1a4-51f3-a7f2-6b56ee033856",
    "indicator_id": "bp_systolic",
    "value": 101.0,
    "taken_at": "2026-11-02T14:21:16.018994Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-02T14:22:09.018994Z"
  },
  {
    "id": "30261841-1384-5310-bace-8fe53cee7ad0",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-02T14:57:28.758596Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-02T14:57:52.758596Z"
  },
  {
    "id": "5605b3d9-2277-56d1-9d5f-90d94d3e6c02",
    "indicator_id": "bp_diastolic",
    "value": 72.0,
    "taken_at": "2026-11-02T16:20:45.547423Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-02T16:21:44.547423Z"
  },
  {
    "id": "9780a95e-94f9-5f3d-962f-17d34d1e0351",
    "indicator_id": "heart_rate",
    "value": 82.0,
    "taken_at": "2026-11-02T16:57:12.149076Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-02T16:58:21.149076Z"
  },
  {
    "id": "f01a2400-df5f-5898-9cb0-3963325fd04c",
    "indicator_id": "spo2",
    "value": 97.0,
    "taken_at": "2026-11-03T11:20:20.565108Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-03T11:20:42.565108Z"
  },
  {
    "id": "69102c21-2926-5752-996a-cbd1e537ee2d",
    "indicator_id": "temperature",
    "value": 36.7,
    "taken_at": "2026-11-03T11:52:47.152056Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-03T11:54:05.152056Z"
  },
  {
    "id": "74c90d8d-e850-5e5b-8ddb-ed510b9d6ba3",
    "indicator_id": "exercise_min",
    "value": 210.0,
    "taken_at": "2026-11-03T11:58:02.125600Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-03T11:59:16.125600Z"
  },
  {
    "id": "0b695344-0462-57cd-9aa6-e1c2c5fa79f0",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-03T12:54:24.524570Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-03T12:55:52.524570Z"
  },
  {
    "id": "4cfbd688-29b0-5bfc-ab4a-d57650d9acb0",
    "indicator_id": "bp_systolic",
    "value": 108.0,
    "taken_at": "2026-11-03T14:22:06.212001Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-03T14:22:46.212001Z"
  },
  {
    "id": "d9e62009-8135-5d0e-802b-9deb2ca6163e",
    "indicator_id": "sleep_hours",
    "value": 9.0,
    "taken_at": "2026-11-03T15:19:43.191058Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-03T15:20:35.191058Z"
  },
  {
    "id": "f3eeebc9-d038-5605-9024-11025807b918",
    "indicator_id": "bp_diastolic",
    "value": 69.0,
    "taken_at": "2026-11-03T15:35:36.649848Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-03T15:35:41.649848Z"
  },
  {
    "id": "88dbeaef-7895-5acb-93c5-8be59d797659",
    "indicator_id": "heart_rate",
    "value": 80.0,
    "taken_at": "2026-11-03T16:47:30.605589Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-03T16:48:40.605589Z"
  },
  {
    "id": "67168c0d-14b3-59ba-ab35-7366a5962bb5",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-04T11:21:57.159335Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-04T11:22:49.159335Z"
  },
  {
    "id": "1a8af855-6c18-5b74-9ed9-3366c8eb6f8b",
    "indicator_id": "exercise_min",
    "value": 210.0,
    "taken_at": "2026-11-04T11:56:40.932187Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-04T11:57:55.932187Z"
  },
  {
    "id": "6f44feb9-b06b-5a26-87db-0ffb5fa151be",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-04T12:33:28.306650Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-04T12:33:37.306650Z"
  },
  {
    "id": "af886d83-386a-58ac-958f-83df655e0547",
    "indicator_id": "temperature",
    "value": 36.6,
    "taken_at": "2026-11-04T12:44:01.323305Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-04T12:44:20.323305Z"
  },
  {
    "id": "8c6edd22-cd20-5987-aeaf-98f6bdef160f",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-04T14:46:43.509058Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-04T14:47:26.509058Z"
  },
  {
    "id": "8187cd48-d575-52d2-b897-43b8a9e34d9f",
    "indicator_id": "bp_systolic",
    "value": 101.0,
    "taken_at": "2026-11-04T15:01:18.394796Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-04T15:01:35.394796Z"
  },
  {
    "id": "0fdd3561-397b-5507-b23e-f42b1726aaf1",
    "indicator_id": "bp_diastolic",
    "value": 72.0,
    "taken_at": "2026-11-04T15:42:03.893690Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-04T15:43:17.893690Z"
  },
  {
    "id": "d3e8d981-4e0b-5aba-b906-86945927ade6",
    "indicator_id": "heart_rate",
    "value": 88.0,
    "taken_at": "2026-11-04T16:28:28.674953Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-04T16:28:43.674953Z"
  },
  {
    "id": "d9b689fa-2dbd-5bea-a586-5bf6cbdf9b00",
    "indicator_id": "spo2",
    "value": 99.0,
    "taken_at": "2026-11-05T11:47:42.362435Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-05T11:49:01.362435Z"
  },
  {
    "id": "814cb824-bd09-598d-8654-c29f02c9e502",
    "indicator_id": "exercise_min",
    "value": 220.0,
    "taken_at": "2026-11-05T12:06:37.924621Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-05T12:07:25.924621Z"
  },
  {
    "id": "19250ae4-6822-5796-bc78-fbe3e3928dda",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-11-05T12:36:24.895233Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-05T12:37:17.895233Z"
  },
  {
    "id": "df2f1bc4-4c93-5e2a-ac72-a46279fee774",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-05T12:59:33.761946Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-05T13:00:55.761946Z"
  },
  {
    "id": "16da00f8-9ab5-5897-a9fa-65d431b88d69",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-05T14:24:15.612113Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-05T14:25:42.612113Z"
  },
  {
    "id": "fa56004a-c5c7-5748-900a-edfdf72ee5ce",
    "indicator_id": "bp_systolic",
    "value": 110.0,
    "taken_at": "2026-11-05T14:57:05.266274Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-05T14:58:04.266274Z"
  },
  {
    "id": "ae40729f-11b7-5bee-abbd-7934b45aa066",
    "indicator_id": "bp_diastolic",
    "value": 71.0,
    "taken_at": "2026-11-05T15:42:12.386966Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-05T15:43:03.386966Z"
  },
  {
    "id": "c0a39fef-40ce-5648-8dee-d86ba3ada321",
    "indicator_id": "heart_rate",
    "value": 77.0,
    "taken_at": "2026-11-05T16:54:32.185499Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-05T16:55:07.185499Z"
  },
  {
    "id": "8c50e27c-6c5d-53da-b9fa-2e6897d5ae08",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-06T11:24:33.340862Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-06T11:25:54.340862Z"
  },
  {
    "id": "f2034183-a0cc-5e8b-9467-17fdf18664e9",
    "indicator_id": "exercise_min",
    "value": 225.0,
    "taken_at": "2026-11-06T11:42:00.129412Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-06T11:43:02.129412Z"
  },
  {
    "id": "40ab4660-ce43-5f31-9218-63e3030e2c52",
    "indicator_id": "temperature",
    "value": 36.7,
    "taken_at": "2026-11-06T12:34:06.970317Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-06T12:35:09.970317Z"
  },
  {
    "id": "ee1f8f99-d67b-5960-95e9-b39c3bd28213",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-06T12:40:01.144189Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-06T12:40:38.144189Z"
  },
  {
    "id": "153cb087-1f06-5ae8-acc8-24f52cae0c38",
    "indicator_id": "bp_systolic",
    "value": 108.0,
    "taken_at": "2026-11-06T14:23:20.099013Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-06T14:23:25.099013Z"
  },
  {
    "id": "1d7c8f55-0ea6-5b1e-bff9-bc839e6c3d02",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-06T15:13:38.780331Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-06T15:14:55.780331Z"
  },
  {
    "id": "24fd006c-79c9-5696-acb7-38d1468ffb3c",
    "indicator_id": "bp_diastolic",
    "value": 71.0,
    "taken_at": "2026-11-06T16:04:54.475788Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-06T16:06:22.475788Z"
  },
  {
    "id": "53561943-a9a2-58e3-9e3c-f5806fcbbebf",
    "indicator_id": "heart_rate",
    "value": 82.0,
    "taken_at": "2026-11-06T16:12:19.435153Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-06T16:13:44.435153Z"
  },
  {
    "id": "81ad0946-2366-5ca5-83db-08fdb4c70240",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-07T11:49:22.479362Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-07T11:50:10.479362Z"
  },
  {
    "id": "66e6a739-8520-51d8-bd78-62ddb10171c2",
    "indicator_id": "exercise_min",
    "value": 210.0,
    "taken_at": "2026-11-07T12:25:34.580920Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-07T12:26:45.580920Z"
  },
  {
    "id": "19bfbdb7-ca09-5fb2-b8d4-42e6bdac2356",
    "indicator_id": "temperature",
    "value": 36.4,
    "taken_at": "2026-11-07T12:34:48.988905Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-07T12:35:26.988905Z"
  },
  {
    "id": "49896416-7aba-551f-9e97-bada1f66993b",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-07T13:07:25.886236Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-07T13:08:01.886236Z"
  },
  {
    "id": "e0a3429f-e47c-59ee-b631-0e06b0b61a4d",
    "indicator_id": "bp_systolic",
    "value": 104.0,
    "taken_at": "2026-11-07T14:38:42.419858Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-07T14:39:01.419858Z"
  },
  {
    "id": "ea89251f-a8e1-50b1-bae0-758a96a3fafc",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-07T15:03:52.161068Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-07T15:05:15.161068Z"
  },
  {
    "id": "33129f40-1855-52d9-bf6f-78b4b292117f",
    "indicator_id": "bp_diastolic",
    "value": 73.0,
    "taken_at": "2026-11-07T15:59:36.804914Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-07T16:00:49.804914Z"
  },
  {
    "id": "dcd7ffe4-fb29-5078-bd6f-f3187c5c98e9",
    "indicator_id": "radiation_dose",
    "value": 64.0,
    "taken_at": "2026-11-07T16:29:49.844759Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mSv",
    "received_at": "2026-11-07T16:30:14.844759Z"
  },
  {
    "id": "96139263-9a70-54c0-a231-8cf5e2ab4c66",
    "indicator_id": "heart_rate",
    "value": 80.0,
    "taken_at": "2026-11-07T16:56:23.758545Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-07T16:56:46.758545Z"
  },
  {
    "id": "4eace80b-2597-540d-a3fa-09fd90684810",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-08T12:00:10.611180Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-08T12:01:06.611180Z"
  },
  {
    "id": "2fcf463a-d134-5710-9de5-6e331ab7f01b",
    "indicator_id": "exercise_min",
    "value": 220.0,
    "taken_at": "2026-11-08T12:15:34.626928Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-08T12:16:55.626928Z"
  },
  {
    "id": "09c2c0fb-d995-5818-9965-1d981253ca38",
    "indicator_id": "temperature",
    "value": 36.4,
    "taken_at": "2026-11-08T12:29:59.582874Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-08T12:31:00.582874Z"
  },
  {
    "id": "34bbde99-f4a4-55d3-bf9e-5cde161262af",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-08T12:39:25.682338Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-08T12:40:50.682338Z"
  },
  {
    "id": "854e20a4-025f-5718-a184-5ec041fff371",
    "indicator_id": "bp_systolic",
    "value": 101.0,
    "taken_at": "2026-11-08T14:32:32.259170Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-08T14:33:54.259170Z"
  },
  {
    "id": "ab6d2578-ba8b-5775-b6a4-8afd63cc9e54",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-08T15:02:55.009513Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-08T15:03:34.009513Z"
  },
  {
    "id": "a79fc209-b668-5a79-8e35-80e4ffc7caa4",
    "indicator_id": "bp_diastolic",
    "value": 70.0,
    "taken_at": "2026-11-08T16:00:18.448443Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-08T16:00:20.448443Z"
  },
  {
    "id": "4fd0fd31-c1cc-5455-aa7e-3953b986b745",
    "indicator_id": "heart_rate",
    "value": 85.0,
    "taken_at": "2026-11-08T16:32:11.068703Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-08T16:32:20.068703Z"
  },
  {
    "id": "482024c2-da0c-5771-a0f6-e14f461dc1db",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-09T11:37:58.691748Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-09T11:38:59.691748Z"
  },
  {
    "id": "ec43329a-6be2-50c6-b271-3e20a92b4f0d",
    "indicator_id": "exercise_min",
    "value": 195.0,
    "taken_at": "2026-11-09T11:52:31.171432Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-09T11:53:38.171432Z"
  },
  {
    "id": "ddb8f600-6050-5452-9fdd-c65c0deb3d35",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-09T12:35:35.277011Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-09T12:36:32.277011Z"
  },
  {
    "id": "11381c25-aedb-58de-9528-e3fc7aeed3df",
    "indicator_id": "temperature",
    "value": 36.4,
    "taken_at": "2026-11-09T12:45:11.308323Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-09T12:45:15.308323Z"
  },
  {
    "id": "b2931c0d-29e3-566f-ac42-df6c908a0c0f",
    "indicator_id": "sleep_hours",
    "value": 9.0,
    "taken_at": "2026-11-09T14:49:56.977875Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-09T14:50:46.977875Z"
  },
  {
    "id": "0a01c1a6-4e4b-583b-82a8-139539ec27e1",
    "indicator_id": "bp_systolic",
    "value": 100.0,
    "taken_at": "2026-11-09T15:00:10.180582Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-09T15:00:30.180582Z"
  },
  {
    "id": "ce305f94-a1a5-584c-8944-d920b54a7b48",
    "indicator_id": "bp_diastolic",
    "value": 70.0,
    "taken_at": "2026-11-09T16:20:30.607818Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-09T16:21:42.607818Z"
  },
  {
    "id": "ee461053-c10c-5b9d-af5e-8fcb89b4010d",
    "indicator_id": "heart_rate",
    "value": 82.0,
    "taken_at": "2026-11-09T16:41:11.711964Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-09T16:42:19.711964Z"
  },
  {
    "id": "7c1c6814-08be-59ae-af07-5b3c51486e58",
    "indicator_id": "exercise_min",
    "value": 225.0,
    "taken_at": "2026-11-10T12:00:58.271190Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-10T12:01:36.271190Z"
  },
  {
    "id": "1b32ed65-4e5c-5e6f-854d-bc998fb96191",
    "indicator_id": "temperature",
    "value": 36.3,
    "taken_at": "2026-11-10T12:04:16.086242Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-10T12:05:01.086242Z"
  },
  {
    "id": "0f591ae6-5b22-589e-a87e-57265c69ff6f",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-10T12:10:53.561243Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-10T12:12:19.561243Z"
  },
  {
    "id": "372476b4-2e27-5dd3-ba43-e8154253a806",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-10T13:05:10.407799Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-10T13:05:20.407799Z"
  },
  {
    "id": "5b1c22ba-ce4e-543f-977d-447f7c38a416",
    "indicator_id": "bp_systolic",
    "value": 102.0,
    "taken_at": "2026-11-10T14:30:55.768060Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-10T14:30:58.768060Z"
  },
  {
    "id": "348049e7-931b-559d-99f6-bca4243f3be2",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-10T14:57:35.516610Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-10T14:58:18.516610Z"
  },
  {
    "id": "c64d664e-5f0c-53c2-ba00-02a9ce0036e8",
    "indicator_id": "bp_diastolic",
    "value": 68.0,
    "taken_at": "2026-11-10T16:28:25.351243Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-10T16:29:16.351243Z"
  },
  {
    "id": "3a9a0b19-1342-5a12-8929-8116e966958d",
    "indicator_id": "heart_rate",
    "value": 83.0,
    "taken_at": "2026-11-10T17:02:02.015734Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-10T17:02:37.015734Z"
  },
  {
    "id": "0f69d85f-9ee0-520c-b3cc-3b4635de83e4",
    "indicator_id": "spo2",
    "value": 97.0,
    "taken_at": "2026-11-11T11:19:59.243718Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-11T11:20:40.243718Z"
  },
  {
    "id": "5e192722-6755-57e4-b478-4ac2f808a7a2",
    "indicator_id": "exercise_min",
    "value": 230.0,
    "taken_at": "2026-11-11T11:32:55.409082Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-11T11:34:19.409082Z"
  },
  {
    "id": "d13f14c9-32ff-5c79-99fa-f218f2cfed59",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-11-11T12:39:58.970250Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-11T12:40:10.970250Z"
  },
  {
    "id": "cb38e023-9e6f-5acf-b599-df0b73f689ff",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-11T13:24:43.812159Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-11T13:25:52.812159Z"
  },
  {
    "id": "8f574282-d50f-5cfb-9e03-1bb2e674c32e",
    "indicator_id": "bp_systolic",
    "value": 107.0,
    "taken_at": "2026-11-11T14:53:45.353924Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-11T14:54:10.353924Z"
  },
  {
    "id": "4560e847-86c6-5d08-8742-5f4f2d97978f",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-11T15:09:50.858003Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-11T15:10:39.858003Z"
  },
  {
    "id": "b2ed9868-dc1a-5ffe-918c-31a9a299a825",
    "indicator_id": "bp_diastolic",
    "value": 73.0,
    "taken_at": "2026-11-11T16:19:58.898217Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-11T16:20:26.898217Z"
  },
  {
    "id": "ac4b606d-961c-5453-8434-c16d70b91b8e",
    "indicator_id": "heart_rate",
    "value": 88.0,
    "taken_at": "2026-11-11T16:20:46.592829Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-11T16:21:05.592829Z"
  },
  {
    "id": "d75a990d-aa06-5969-b5fd-0f7ce7a248fe",
    "indicator_id": "temperature",
    "value": 36.6,
    "taken_at": "2026-11-12T11:56:33.462662Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-12T11:57:13.462662Z"
  },
  {
    "id": "91e243a9-e5a5-5230-a4ec-601d3c4dbbe3",
    "indicator_id": "spo2",
    "value": 97.0,
    "taken_at": "2026-11-12T12:03:57.411588Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-12T12:04:23.411588Z"
  },
  {
    "id": "21396ed3-8f0a-5ac5-849b-6a1d3b201912",
    "indicator_id": "exercise_min",
    "value": 220.0,
    "taken_at": "2026-11-12T12:13:02.994436Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-12T12:14:28.994436Z"
  },
  {
    "id": "157bde0b-7572-5de1-91e7-4aff4561b206",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-12T12:33:20.030926Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-12T12:34:26.030926Z"
  },
  {
    "id": "181dd134-943b-571c-9aaa-f896a3636a6a",
    "indicator_id": "bp_systolic",
    "value": 99.0,
    "taken_at": "2026-11-12T14:36:19.412177Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-12T14:36:55.412177Z"
  },
  {
    "id": "5af0141e-0e43-5a95-951f-9b67e8969f31",
    "indicator_id": "sleep_hours",
    "value": 8.0,
    "taken_at": "2026-11-12T15:10:46.679626Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-12T15:10:52.679626Z"
  },
  {
    "id": "8c960a24-9082-59e1-95e5-f4537414b33a",
    "indicator_id": "bp_diastolic",
    "value": 72.0,
    "taken_at": "2026-11-12T15:45:47.909532Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-12T15:47:06.909532Z"
  },
  {
    "id": "d9d0a749-af2e-5b54-9846-987ff5977eeb",
    "indicator_id": "heart_rate",
    "value": 87.0,
    "taken_at": "2026-11-12T16:19:30.685979Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-12T16:20:13.685979Z"
  },
  {
    "id": "d25b241d-5160-5032-ae1d-67c6ca50bc10",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-13T11:47:48.443088Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-13T11:48:48.443088Z"
  },
  {
    "id": "d6357d99-1ea4-5d67-904b-81755372e3b8",
    "indicator_id": "exercise_min",
    "value": 230.0,
    "taken_at": "2026-11-13T11:51:23.230657Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-13T11:52:03.230657Z"
  },
  {
    "id": "2725f235-3063-5e31-80dc-a1f2cde11e24",
    "indicator_id": "temperature",
    "value": 36.5,
    "taken_at": "2026-11-13T12:21:28.461895Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-13T12:22:51.461895Z"
  },
  {
    "id": "961ae870-5eff-5a60-85e9-91468cc84f2b",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-13T13:21:09.883713Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-13T13:21:32.883713Z"
  },
  {
    "id": "b38aa164-ac42-5f25-83a6-af6c685a54ea",
    "indicator_id": "bp_systolic",
    "value": 106.0,
    "taken_at": "2026-11-13T14:52:48.418120Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-13T14:53:59.418120Z"
  },
  {
    "id": "feeb6326-e55b-54d9-8507-48882888e702",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-13T14:57:30.605659Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-13T14:57:41.605659Z"
  },
  {
    "id": "24a88391-33ec-5dde-b666-ee3ccdf74bcb",
    "indicator_id": "bp_diastolic",
    "value": 72.0,
    "taken_at": "2026-11-13T16:04:27.976624Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-13T16:04:54.976624Z"
  },
  {
    "id": "945818ff-62a8-57fe-98a7-632af071c340",
    "indicator_id": "heart_rate",
    "value": 80.0,
    "taken_at": "2026-11-13T16:34:49.995487Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-13T16:36:02.995487Z"
  },
  {
    "id": "0b7e5c1a-3f2d-4e8b-9a6c-1d2e3f4a5b6c",
    "indicator_id": "bp_systolic",
    "value": 142.0,
    "taken_at": "2026-11-14T10:00:00Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-14T17:16:01.833051Z"
  },
  {
    "id": "663b95f8-6a40-5bdb-86eb-0ad398bd0197",
    "indicator_id": "spo2",
    "value": 98.0,
    "taken_at": "2026-11-14T11:30:44.945317Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "%",
    "received_at": "2026-11-14T11:31:32.945317Z"
  },
  {
    "id": "cc9d130d-0190-5241-bc1e-3d8b78c6f1d8",
    "indicator_id": "exercise_min",
    "value": 225.0,
    "taken_at": "2026-11-14T11:49:56.227293Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "min",
    "received_at": "2026-11-14T11:49:59.227293Z"
  },
  {
    "id": "ab8d1c89-4db0-53b9-9a30-14c3c01b7d1f",
    "indicator_id": "temperature",
    "value": 36.3,
    "taken_at": "2026-11-14T11:54:19.478569Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "°C",
    "received_at": "2026-11-14T11:54:23.478569Z"
  },
  {
    "id": "62d665ab-d858-5be3-9c8b-801102b80a75",
    "indicator_id": "mood",
    "value": 4.0,
    "taken_at": "2026-11-14T12:32:01.516209Z",
    "source": "checkin",
    "note": null,
    "member_id": 1,
    "unit": "1-5",
    "received_at": "2026-11-14T12:32:36.516209Z"
  },
  {
    "id": "fd48d2ed-fea0-5cf0-9dd1-9dc098e94076",
    "indicator_id": "bp_systolic",
    "value": 103.0,
    "taken_at": "2026-11-14T14:16:30.283922Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-14T14:17:58.283922Z"
  },
  {
    "id": "8d883aba-bf73-526e-830a-2532529d7740",
    "indicator_id": "sleep_hours",
    "value": 8.5,
    "taken_at": "2026-11-14T15:05:02.253096Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "h",
    "received_at": "2026-11-14T15:06:22.253096Z"
  },
  {
    "id": "ad75f82d-e6a3-5c23-81c7-1a2726d60ad0",
    "indicator_id": "bp_diastolic",
    "value": 69.0,
    "taken_at": "2026-11-14T15:46:56.022220Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mmHg",
    "received_at": "2026-11-14T15:47:27.022220Z"
  },
  {
    "id": "dd4ec25b-4eaa-59b7-a2f2-e20e7a9c2609",
    "indicator_id": "radiation_dose",
    "value": 69.0,
    "taken_at": "2026-11-14T16:39:42.533624Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "mSv",
    "received_at": "2026-11-14T16:39:44.533624Z"
  },
  {
    "id": "40aed8d7-228a-5f81-9e91-ac11aa408a18",
    "indicator_id": "heart_rate",
    "value": 88.0,
    "taken_at": "2026-11-14T16:49:30.350583Z",
    "source": "manual",
    "note": null,
    "member_id": 1,
    "unit": "lpm",
    "received_at": "2026-11-14T16:49:48.350583Z"
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
    "as_of": "2026-11-14T17:16:01.949358Z",
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
    "as_of": "2026-11-14T17:16:00.951815Z",
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
    "as_of": "2026-11-14T17:02:01.953991Z",
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
    "as_of": "2026-11-14T17:16:01.956248Z",
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
    "as_of": "2026-11-14T17:16:01.958363Z",
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
    "as_of": "2026-11-14T17:16:01.960409Z",
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
  "generated_at": "2026-11-14T17:16:02.007244Z",
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
  "expires_at": "2026-11-15T05:16:02.016023Z",
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
