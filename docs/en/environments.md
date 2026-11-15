# Environment profiles

The **environment profile** is the core of RUOK. It is a JSON file (`backend/app/data/environments.json`) that changes the thresholds, escalation, delay, routine, vocabulary and theme **without touching code**. The full schema is in [api-contract.md](../api-contract.md#esquemas).

## The 6 profiles

| id | Name | Gravity | Delay (one way) | Radiation | Ladder | Vocabulary |
|---|---|---|---|---|---|---|
| `iss` | International Space Station | 0 g (microgravity) | ~0 s → `realtime` | medium | self → crew → ground | astronaut / crew / flight surgeon |
| `moon` | Artemis lunar base | 0.16 g | ~1.3 s → `realtime` | high | self → crew → ground | astronaut / crew / flight surgeon |
| `mars` | Martian base | 0.38 g | 4–24 min (demo: 840 s) → `delayed` (`autonomous` if `critical`) | high | self → crew → ground | astronaut / crew / flight surgeon |
| `earth` | Terrestrial analog (control) | 1 g | 0 s | low | self → crew → ground | participant / team / doctor |
| `hospital` | Hospital ward | 1 g | 0 s | — | self → nurse → doctor | patient / ward / nursing staff |
| `geriatric` | Nursing home | 1 g | 0 s | — | self → caregiver → doctor → family | resident / nursing home / caregiver |

## What each profile changes

- **`threshold_overrides`**: adjust the catalog ranges. For example:
  - In `geriatric`, the normal blood pressure range is wider and fall-risk indicators are added.
  - In `mars` and `moon`, the minimum daily exercise (bone loss) and the cumulative dose are stricter.
- **`indicators`**: active indicators. Radiation dose only appears in space; fall risk and hydration carry more weight in geriatrics.
- **`comm_delay_s`**: determines `escalation.mode`.
  - Below 5 s, `realtime` is used.
  - Above that, `delayed` with an ETA. If, in addition, the delay is ≥ 60 s and the status is `critical`, the mode is `autonomous`: the **autonomous protocol** is shown while the reply has not arrived.
  - The delay only affects the **external** levels of the ladder: `self` and `crew` (or their equivalents) are resolved onboard, in real time.
- **`escalation_ladder`**: the levels that automatic alerts follow, and that can be chosen when escalating by hand.
- **`liveness`**: heartbeat thresholds (normal, EVA, sleep) and the "R U OK?" timeout.
- **`routine`**: daily tasks for the gamification. For example, resistive exercise in space, and walking or hydration in geriatrics. Each item picks a `task_type` from `backend/app/data/task_types.json` (title, time of day `due`/`slots`, and the `indicator_id` that auto-completes it when measured) and sets `times_per_day` and `points`. On startup, the app validates that all types and indicators exist (BE-18).
- **`vocabulary`** and **`theme`**: texts and look (Martian sky, lunar regolith, bright hospital…).
- **`mission`**: start and end dates, for the mission day shown by the header clock.

## Data status (BE-03)

The 6 profiles are in `backend/app/data/environments.json` and are served by `GET /environments`. Pending:
- **`threshold_overrides` (CNT-01):** `mars` has a stricter systolic pressure (warning 130–140; critical from 141, because there is no immediate medical care) and `geriatric` has fever from 37.8 °C [S24]. Values and sources in [sources.md](../sources.md#tabla-de-umbrales-cnt-01).
- **Fall risk (geriatrics):** there is no indicator in the BE-04 catalog yet. Once it exists, it is added to `geriatric.indicators`.
- **Liveness:** all 6 profiles use the thresholds from [offline-and-liveness.md](offline-and-liveness.md) (5 min / 15 min; EVA 30 s). The sleep adjustment (×3) is applied by BE-12; it is not in the profile.

## How to add a new environment
1. Add an object to `environments.json` (validated by the Pydantic schema).
2. Add the theme in `frontend/src/environments/<id>.ts` (optional: if it is missing, the default theme is used).
3. Add the members to the seed (`backend/app/seed.py`).
