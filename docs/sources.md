# Fuentes y referencias

> Responsable: Supervisor. Cada umbral, explicación o intervención que use la app debe enlazar aquí con su ID (`[S1]`).

## NASA Human Research Program
| ID | Fuente | Uso en RUOK |
|---|---|---|
| S1 | NASA HRP: *The Human Body in Space* / 5 Hazards of Human Spaceflight | Mapa de peligros → sistemas |
| S2 | NASA Human Research Roadmap (riesgos: Bone Fracture, Cardiovascular, SANS, BMed, Radiation…) | Explicaciones por sistema |
| S3 | NASA Behavioral Health & Performance (BHP) | Módulo conductual |
| S4 | Recursos de la pestaña *Resources* del reto Space Apps 2026 | Por completar |

## Otras agencias y estudios
| ID | Fuente | Uso |
|---|---|---|
| S10 | ESA: Mars-500 (aislamiento de 520 días) | Fenómeno del tercer cuarto, sueño |
| S11 | HI-SEAS / HERA (análogos) | Cohesión del equipo, contramedidas |
| S12 | Psychomotor Vigilance Test (Basner & Dinges) / Reaction Self Test en la ISS | PVT |
| S13 | Límites de dosis de radiación para tripulaciones (NASA-STD-3001) | Dosis acumulada |

## Umbrales clínicos (Tierra)
| ID | Fuente | Uso |
|---|---|---|
| S20 | Guías de hipertensión AHA/ESC | Rangos de tensión |
| S21 | Rangos de SpO₂, glucosa y temperatura (referencias clínicas estándar) | Catálogo de indicadores |

## Tabla de umbrales (provisional; la revisa CNT-01)

> **Provisional (BE-04).** Estos valores están en `backend/app/data/indicators.json` (rangos del catálogo) y `backend/app/data/environments.json` (`threshold_overrides`). Salen de los ejemplos del contrato y de criterios simples; **CNT-01 debe revisarlos y citar la fuente exacta**. Si cambias un valor, cámbialo en el JSON y en esta tabla.
>
> Cómo los aplica el motor (BE-08, `services/assessment.py`): los límites son inclusivos y un valor que sobrepasa la banda `warning` por el lado opuesto a `normal` ya es `critical`, aunque no llegue al valor de la columna *Critical*. Por eso hay huecos que conviene cerrar en CNT-01: `heart_rate` (121–129), `glucose` (181–249), `radiation_dose` (501–599), `exercise_min` (31–59) y `sleep_hours` (4,1–4,9) ya cuentan como `critical`.

| Indicador | Unidad | Normal | Warning | Critical | Ajustes por entorno | Fuente |
|---|---|---|---|---|---|---|
| heart_rate | lpm | 50–100 | 101–120 | ≤ 40 / ≥ 130 | — | provisional |
| bp_systolic | mmHg | 90–129 | 130–159 | ≤ 80 / ≥ 160 | mars: warning 130–140 | [S20] · provisional |
| bp_diastolic | mmHg | 60–84 | 85–99 | ≤ 50 / ≥ 100 | — | [S20] · provisional |
| spo2 | % | 95–100 | 91–94 | ≤ 90 | — | [S21] · provisional |
| mood | 1-5 | 3–5 | 2–2,9 | ≤ 1,5 | — | [S3] · provisional |
| temperature | °C | 36–37,4 | 37,5–38,4 | ≤ 35 / ≥ 38,5 | — | [S21] · provisional |
| glucose | mg/dL | 70–140 | 141–180 | ≤ 60 / ≥ 250 | — | [S21] · provisional |
| exercise_min | min | 120–300 | 60–119 | ≤ 30 | — | [S2] · provisional |
| sleep_hours | h | 7–10 | 5–6,9 | ≤ 4 | — | provisional |
| vision_changes | 1-5 | 1–1,9 | 2–3,4 | ≥ 3,5 | — | [S2] · provisional |
| radiation_dose | mSv | 0–250 | 251–500 | ≥ 600 | — | [S13] · provisional |
| hydration_ml | ml | 1500–4000 | 801–1499 | ≤ 800 | — | provisional |
| weight_kg | kg | 45–110 | — | ≤ 40 / ≥ 150 | — | provisional |
| stress | 1-5 | 1–3 | 3,1–4,4 | ≥ 4,5 | — | [S3] · provisional |
| energy | 1-5 | 3–5 | 2–2,9 | ≤ 1,5 | — | [S3] · provisional |
| loneliness | 1-5 | 1–3 | 3,1–4,4 | ≥ 4,5 | — | [S3] · provisional |
| sleep_quality | 1-5 | 3–5 | 2–2,9 | ≤ 1,5 | — | [S3] · provisional |
| crew_relation | 1-5 | 3–5 | 2–2,9 | ≤ 1,5 | — | [S3] · provisional |
| pvt_mean_rt_ms | ms | 100–350 | 351–499 | ≥ 500 | — | [S12] · provisional |
| pvt_lapses | lapsos | 0–2 | 3–5 | ≥ 6 | — | [S12] · provisional |
