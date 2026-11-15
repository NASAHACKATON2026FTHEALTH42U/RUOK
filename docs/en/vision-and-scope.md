# Vision and scope

## The challenge
NASA asks for a **visual tool** that helps astronauts **assess their own health** during a mission and gives them **guidance** on treatments and improvements. It has to answer five questions:
- what can be measured in space;
- why each exam is needed;
- how spaceflight hazards affect each indicator;
- when a result requires the attention of the crew or of the flight surgeons on the ground;
- which actions prevent a critical situation.

The Human Research Program (HRP) identifies **5 hazards**:

| Hazard | Health effects | How RUOK covers it |
|---|---|---|
| Radiation | Cancer, central nervous system, cataracts | Cumulative dose (dosimeter) and a radiation halo on the figure |
| Isolation and confinement | Mood, sleep, team cohesion, cognitive performance | [Behavioral module](behavioral-health.md) |
| Distance from Earth | Communication delay, medical autonomy | Escalation based on the delay and autonomous guidance ([alerts](alerts-and-escalation.md)) |
| Gravity fields | Bone and muscle loss, fluids, SANS (spaceflight-associated neuro-ocular syndrome), cardiovascular | Indicators and thresholds adjusted for gravity ([environments](environments.md)) |
| Hostile closed environment | Immune system, CO₂, microbiology | Temperature, symptoms and immune indicators |

## Core idea
> The same platform, the same rules engine and the same interface work on Mars (with a 4–24 minute delay, 14 in the demo, and no doctor), on the Moon, on the ISS and in a nursing home on Earth. What changes is the **environment profile**.

## Differentiators
1. **Clickable human body.** Each system (cardio, musculoskeletal, immune, metabolic, neuro-behavioral, eyes) is colored according to its status; radiation is shown as a halo. Clicking a system shows its function, risks and recommended actions.
2. **Gamification and cooperative routine.** Daily missions, streaks, badges and crew points (members do not compete with each other).
3. **Interchangeable environments.** Space and Earth (hospital, geriatrics) show the tool's dual-use impact.
4. **Local-first and fail-safe.** No data is lost, a status without recent data is "unknown" (never green) and there is an "R U OK?" check-in when someone stops responding.

## MVP scope
1. Environment selector, which changes the theme, thresholds, escalation, tasks and vocabulary.
2. Dashboard with a clickable SVG body and a traffic light per system and indicator, plus a detail panel per system.
3. Guided logging of measurements with step-by-step instructions:
   - heart rate, blood pressure, SpO₂, glucose and temperature;
   - sleep, mood, exercise, hydration and weight;
   - radiation dose.
4. 7- and 30-day charts with shaded threshold bands.
5. Assessment engine: thresholds with per-environment adjustments, trends, personal baseline, data freshness, recommendations and escalation.
6. Automatic alerts and a manual **SOS** button (and more detailed notices to control), with a simulated link to Earth that applies the environment's delay.
7. Heartbeat and "R U OK?" check-in, with a "no contact" alert.
8. Offline operation: on-device outbox and idempotent sync.
9. Isolation module: daily check-in, interventions, "Necesito hablar" (I need to talk) and privacy.
10. Gamification: daily missions, points, streaks and badges.
11. `/ground` console (flight surgeon or nursing staff) with "as-of" status.
12. 30 days of synthetic data and deterministic demo scenarios.
13. **Local login and roles**: member, medic, commander, responder, psych and admin, with per-view access ([auth-and-roles.md](auth-and-roles.md)).
14. **Multi-device on a local network:** each user on their own phone, a **control center** (`/control`) with the whole data flow live (SSE) and management, and a QR code to join ([control-center-and-devices.md](control-center-and-devices.md)).

**P2 (if time allows):**
- delayed messages home;
- kudos and crew missions;
- guided meditation with soundscapes (replaces the Earth view gallery);
- Amsler grid (SANS) *(no issue: only if there is time left)*.

## Out of scope (pitch roadmap)
- Real wearables and continuous streaming of vital signs.
- Camera-based heart rate (rPPG) and image analysis (ultrasound).
- AI assistant (local onboard LLM).
- Replication between crew devices.
- SSO / 2FA, end-to-end encryption and a native app. *(Local login with roles **is** part of the MVP: [auth-and-roles.md](auth-and-roles.md).)*
- Certification as a medical device.
