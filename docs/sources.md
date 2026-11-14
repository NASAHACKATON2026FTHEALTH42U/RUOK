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
| S12 | Basner M., Mollicone D., Dinges D. F. (2011). *Validity and sensitivity of a brief psychomotor vigilance test (PVT-B)*. Acta Astronautica. [PDF](https://www.med.upenn.edu/uep/assets/user-content/documents/Basner2011-ValidityandsensitivityofabriefPVT.pdf) · [PMC3197786](https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786) | PVT: un **lapso** es una respuesta ≥ 500 ms (PVT de 10 min); en la versión breve de 3 min (PVT-B) el umbral equivalente es **355 ms** |
| S13 | NASA-STD-3001 Vol. 1 Rev. C (2023), requisito [V1 4030]. [PDF](https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf) · [Radiation protection technical brief (OCHMO)](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) | Dosis efectiva de carrera **< 600 mSv** |
| S14 | NASA, blog de la ISS: *Muscle and exercise studies to maintain crew health in space* (2025). [Enlace](https://www.nasa.gov/blogs/spacestation/2025/07/16/muscle-and-exercise-studies-to-maintain-crew-health-in-space/) · Agencia Espacial Canadiense: [*Physical activity in space*](https://asc-csa.gc.ca/eng/astronauts/living-exercising.asp) | La tripulación de la ISS hace **unas 2 h de ejercicio al día** contra la pérdida ósea y muscular |

## Umbrales clínicos (Tierra)
| ID | Fuente | Uso |
|---|---|---|
| S20 | ACC/AHA 2017, guía de hipertensión arterial. [Nota de prensa del ACC](https://www.acc.org/about-acc/press-releases/2017/11/13/15/35/high-blood-pressure-redefined-for-first-time-in-14-years-130-is-the-new-high) | Normal < 120/80; elevada 120–129/< 80; estadio 1 130–139/80–89; estadio 2 ≥ 140/≥ 90; **crisis > 180/> 120** |
| S21 | FDA, *Pulse oximeter basics* (las personas sanas tienen 95–100 %). Cleveland Clinic, [*Pulse oximetry*](https://my.clevelandclinic.org/health/diagnostics/pulse-oximetry) (contactar con un profesional con ≤ 92 %, ayuda urgente con ≤ 88 %) | SpO₂ |
| S22 | Cleveland Clinic / WebMD: frecuencia cardiaca en reposo normal de 60–100 lpm en adultos. *Enlace exacto pendiente de confirmar.* | Frecuencia cardiaca |
| S23 | CDC, definición de fiebre: ≥ 38,0 °C (100,4 °F) oral, vía [MedlinePlus: *Fever*](https://medlineplus.gov/ency/article/003090.htm) | Temperatura |
| S24 | IDSA (High K. P. et al., 2009), *Clinical practice guideline for the evaluation of fever and infection in older adult residents of long-term care facilities*. Clin Infect Dis 48:149–171. Fiebre en residentes: una toma oral **> 37,8 °C**. *Cita de memoria: verificar antes de la presentación.* | Ajuste de temperatura en `geriatric` |
| S25 | American Diabetes Association, niveles de hipoglucemia. [PDF (ADA, 2025)](https://professional.diabetes.org/sites/dpro/files/2025-05/hypoglycemia-hcp-5-27-25.pdf) | Nivel 1: < 70 mg/dL; **nivel 2: < 54 mg/dL** (acción inmediata) |
| S26 | AASM / SRS (2015), *Recommended amount of sleep for a healthy adult*. [PDF](https://www.aasm.org/resources/pdf/adultsleepdurationconsensus.pdf) · [PMC4434546](https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/) | **≥ 7 h** por noche de forma regular (18–60 años) |
| S27 | EFSA (2010), valores dietéticos de referencia de agua. [Nota de prensa](https://www.efsa.europa.eu/fi/press/news/nda100326) | Ingesta adecuada total: 2,0 L/día (mujeres) y 2,5 L/día (hombres), incluida el agua de los alimentos; igual en mayores de 65 |

## Tabla de umbrales (CNT-01)

> **Valores de los JSON.** Están en `backend/app/data/indicators.json` (rangos del catálogo) y `backend/app/data/environments.json` (`threshold_overrides`). **Si cambias un valor, cámbialo en el JSON y en esta tabla**, y pasa los tests (`tests/test_catalog.py` comprueba los casos con fuente).
>
> **Cómo los aplica el motor** (`services/assessment.py`): límites inclusivos; los umbrales `critical` se comprueban primero (`≤ critical_low` o `≥ critical_high`). Un valor fuera de `normal` y sin llegar a la banda `warning` del otro lado es `warning`. **Regla de CNT-01:** el borde exterior de la banda `warning` coincide con el umbral crítico, así que **no hay huecos** (lo comprueba `test_no_gap_between_warning_and_critical`).
>
> **Tipo de fuente:** *clínica* = umbral publicado; *espacial* = estándar o práctica de la NASA; *diseño* = criterio del equipo para la demo, sin umbral clínico publicado (autoevaluaciones 1–5 y dosis intermedias). **No es un dispositivo médico**: estos valores sirven para el triaje de la demo, no para diagnosticar.

| Indicador | Unidad | Normal | Warning | Critical | Ajustes por entorno | Fuente |
|---|---|---|---|---|---|---|
| heart_rate | lpm | 50–100 | 101–129 (y 41–49) | ≤ 40 / ≥ 130 | — | [S22] clínica; 50–59 se acepta como normal en tripulación entrenada (diseño) |
| bp_systolic | mmHg | 90–129 | 130–179 (estadios 1–2; y 81–89) | ≤ 80 / ≥ 180 (crisis) | **mars:** warning 130–140, ≥ 141 critical (sin atención médica inmediata) | [S20] clínica; ajuste de Marte: diseño |
| bp_diastolic | mmHg | 60–79 | 80–119 (estadios 1–2; y 51–59) | ≤ 50 / ≥ 120 (crisis) | — | [S20] clínica |
| spo2 | % | 95–100 | 91–94 | ≤ 90 | — | [S21] clínica |
| temperature | °C | 36,0–37,9 | 38,0–39,4 (fiebre; y 35,1–35,9) | ≤ 35 (hipotermia) / ≥ 39,5 | **geriatric:** normal 36,0–37,7, warning desde 37,8 | [S23] clínica; geriatría [S24] |
| glucose | mg/dL | 70–140 | 141–249 (y 55–69, hipoglucemia nivel 1) | ≤ 54 (nivel 2) / ≥ 250 | — | [S25] clínica; ≥ 250: diseño |
| exercise_min | min | 120–300 | 31–119 | ≤ 30 | Solo en entornos espaciales | [S14] espacial |
| sleep_hours | h | 7–10 | 4,1–6,9 | ≤ 4 | — | [S26] clínica (≥ 7 h); ≤ 4: diseño |
| vision_changes | 1-5 | 1 | 2–3 | ≥ 4 (3,5) | — | [S2] SANS; escala: diseño |
| radiation_dose | mSv | 0–299 | 300–599 (≥ 50 % del límite) | ≥ 600 (límite de carrera) | Solo en entornos espaciales | [S13] espacial; 50 %: diseño |
| hydration_ml | ml | 1500–4000 | 801–1499 | ≤ 800 | — | [S27] clínica (aprox. 80 % de la ingesta total de 2,0 L procede de bebidas); ≤ 800: diseño |
| weight_kg | kg | 45–110 | — | ≤ 40 / ≥ 150 | — | Diseño. ⚠️ Un peso absoluto no es un buen indicador: lo útil es la **variación respecto a la línea base** (tendencia de BE-10) |
| mood, energy, sleep_quality, crew_relation | 1-5 | 3–5 | 2 | 1 (≤ 1,5) | — | [S3] BHP; escala de autoevaluación: diseño |
| stress, loneliness | 1-5 | 1–3 | 4 | 5 (≥ 4,5) | — | [S3] BHP; escala: diseño |
| pvt_mean_rt_ms | ms | 100–354 | 355–499 | ≥ 500 | — | [S12]: 355 ms (lapso en PVT-B) y 500 ms (lapso en PVT); usarlos con el tiempo de reacción **medio** es diseño |
| pvt_lapses | lapsos | 0–2 | 3–5 | ≥ 6 | — | [S12] (definición de lapso); recuento: diseño |

**Reglas conductuales frente a la línea base** (`behavioral_rules.json`, BE-20; ver [behavioral-health.md](behavioral-health.md)):

| Regla | Umbral | Fuente |
|---|---|---|
| Ánimo bajo | media diaria < línea base − 1 durante ≥ 5 días | [S3] BHP (línea base personal); [S10] Mars-500; umbral: diseño |
| Soledad en aumento | sube 5 días seguidos | [S3] BHP; [S11] análogos; umbral: diseño |
| PVT con mal sueño | `pvt_mean_rt_ms` > línea base + 20 % **y** sueño < 6 h | [S12] PVT como marcador de fatiga; [S26] sueño; +20 % y 6 h: diseño |
| Combinación | 2 reglas a la vez → `critical` | Diseño |

**Pendiente:**
- Confirmar el enlace de S22 y la cita de S24.
- Revisar con un profesional sanitario los valores marcados como *diseño*.
- Un indicador de **riesgo de caídas** para geriatría (no existe en el catálogo).

## Imágenes (Earth view, FE-25)
Fotos de la NASA Image and Video Library (Johnson Space Center), **dominio público** (las imágenes de la NASA no tienen copyright en EE. UU. salvo indicación). Empaquetadas en `frontend/public/earth/` en tamaño medio.

| ID NASA | Título | Fecha |
|---|---|---|
| AS17-148-22727 | View of the Earth seen by the Apollo 17 crew traveling toward the moon | 1972-12-07 |
| AS08-14-2383 | Apollo 8 Mission image, Earth over the horizon of the moon | 1968-12-24 |
| iss071e439624 | An orbital sunrise colorfully illuminates the Earth's atmosphere | 2024-08-06 |
| iss071e364425 | Noctilucent clouds illuminated when the sun is below Earth's horizon | 2024-07-16 |
| iss072e518202 | The city lights of Mexico's Yucatan peninsula | 2025-01-23 |
| iss045e013851 | Earth Observation from the International Space Station | 2015-09-17 |

Fuente: https://images.nasa.gov · Uso: https://www.nasa.gov/nasa-brand-center/images-and-media/
