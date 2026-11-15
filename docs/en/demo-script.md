# Demo script (~3 min)

**Preparation (15 min before)**. See the checklist in [control-center-and-devices.md](control-center-and-devices.md#6-network-setup-for-the-demo).
- **Local network without internet:** travel router with no WAN, with the server laptop on a fixed IP (for example, `192.168.8.10`).
- `POST /demo/reset` and pause liveness alerts until step 6 (`/control`).
- **Devices:**

| Device | User (role) | View |
|---|---|---|
| 📱 Phone A | Cmdr. Vega, Mars (`member`) | Astronaut dashboard |
| 📱 Phone / tablet B | Medical officer, Mars (`medic`) | List of members and alerts |
| 💻 Projector, left half | Operator (`admin`) | **Control center** `/control` |
| 💻 Projector, right half | Flight surgeon (`responder`) | `/ground` |
| 🧾 Printed QR | For the judge | Joins as demo member |

| # | Time | What is shown | What is said |
|---|---|---|---|
| 1 | 0:00 | Problem slide | The 5 HRP hazards. On Mars there is no real-time doctor: there are 14 minutes of silence. |
| 2 | 0:20 | Operator → ISS **Control center** (environment chosen in the sidebar selector). Click a member → body → heart | A single onboard server, several devices. The figure explains each system, how space affects it and what to measure. |
| 3 | 0:45 | **Mars** environment. **Simulation** → scenario «Mal sueño y tensión al alza» (Poor sleep and rising blood pressure) and, on **phone A**, a step-by-step blood pressure measurement with the on-screen keypad. It shows up instantly in the Control center | The same engine with another profile. Cardio turns amber and neuro-behavioral turns red. |
| 4 | 1:05 | Phone A: alert with the **autonomous protocol** and a 14 min ETA. `/ground` does not see it yet | Escalation depends on the delay. Meanwhile, the astronaut knows what to do. |
| 5 | 1:25 | In **Simulation** the link is set to **LOS** and **SOS** is pressed on phone A (the notice says who is asking for help). The **medic's tablet receives the alert instantly** (`crew` level, local; it vibrates if the browser allows it over HTTP). `/ground`: queued. When the link comes back, fast-forward and it reaches `/ground` | The crew acts now; Earth finds out when it arrives. Store-and-forward: nothing is lost. |
| 6 | 1:50 | Phone A sets the **EVA** activity and **its Wi-Fi is turned off** (EVA without contact). With EVA the threshold is 30 s (`stale`) and 2 min (`lost`): the clock is fast-forwarded in **Simulation** to avoid waiting. In the Control center the device becomes lost, the figure turns grey and the medic receives `no_contact`. When Wi-Fi returns, the outbox syncs (`sync.batch`) | No data is not "all good". And what was measured offline has not been lost. |
| 7 | 2:15 | **A judge scans the QR** (operator → Dispositivos / Devices), joins as demo member and does the check-in or the **PVT** on their phone. They appear in the Control center and earn points. From **Simulation** a notification is sent to them and pops up instantly. If there is time: «Mensaje a casa» (Message home) with today's summary | Routine, isolation and cooperative gamification, on their own phone. |
| 8 | 2:35 | In the sidebar selector, switch to **nursing home** | The same product on Earth: residents, caregivers, loneliness and falls. |
| 9 | 2:50 | Roadmap and disclaimer slide | Wearables, rPPG, onboard AI. All of this has run **without internet**: the router has no uplink. |

## Plan B
1. **If the local network fails:** a single laptop, with each tab as a device (`?device=movil-vega`, `?device=tablet-medico`) in split screen.
2. **If the back end goes down:** open the app with `?mocks=1` (full demo mode, "Datos de ejemplo" / Sample data banner), or start the front end with `VITE_MOCK_FALLBACK=true` so that only reads fall back to mocks. See [`frontend/README.md`](../../frontend/README.md#mocks-el-front-sin-backend-fs-04).
3. If the laptop fails, play the recorded demo video (in the team Drive; videos do not go into git).
4. There is a second laptop with the local build already running.

## Judging criteria and where they are covered
| Criterion | Step |
|---|---|
| Impact | 8 (Earth) and 3–6 (space) |
| Creativity | 3–6 (profiles, delay, liveness) |
| Validity | 2 (HRP content with sources) |
| Relevance | Answers the 5 questions of the challenge statement ([vision-and-scope.md](vision-and-scope.md)) |
| Presentation | Live story with several devices, the judge taking part with their phone, and "no internet" |
