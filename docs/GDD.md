# Silverstone GP — Game Design Document

**Version:** 1.28.0 · **Last updated:** 2026-11-20 · **Owner:** Petr

This document is the source of truth for how the game should work. Every
change starts here: update the GDD on a feature branch first, then change the
code to match (see [§14 Change process](#14-change-process)).

---

## 1. Overview

| | |
|---|---|
| Genre | 2D top-down motorcycle racing sim |
| Platform | Desktop browser, single self-contained HTML file (`index.html`), keyboard. Since 1.18.0 also phones in landscape (touch and tilt, §3a) |
| Track | Silverstone Grand Prix circuit, 5.89 km, 18 turns |
| Player fantasy | Ride a MotoGP prototype around a realistic Silverstone against a full grid, manage fuel and damage, and chase lap records |
| Pillars | Believable physics · readable top-down racing · full race weekend feel · fast to start, nothing to install |

Teams, riders and liveries are **fictional**; no real MotoGP names or branding.

## 2. Game modes

| Mode | Grid | Length | Notes |
|---|---|---|---|
| **Practice** | Player alone | Unlimited | Since 1.16.0 starts on a grid slot the player picks, the same way as for the 10 lap race (§2a), or from a chosen spot with Curve training (§11d). No start lights. Lap and sector times, optional speed guide (§9). Laps are saved (§10). |
| **10 Lap Race** | 22 riders | 10 laps | Player picks the starting slot (pole / front row / mid-pack / back of the grid). |
| **Grand Prix + Qualifying** | 22 riders | Qualifying, then 20 laps | Qualifying: out lap + 3 flying laps, best lap sets the grid. AI quali times are simulated from their pace. Player can end qualifying early from the pause menu. |

Start lights (since 1.7.2): when a race starts or is restarted, the countdown begins immediately with no grid wait.
- The first red light is on at once, and one more comes on every 0.9 s up to five.
- After that, the lights go out following a random hold of 0.6–2.4 s.
- The lights label shows the lap count.

Race flow: grid → start lights → race →
chequered flag → results table (positions, gaps, best laps, DNFs).

## 2a. Practice start (since 1.16.0)

Before 1.16.0 normal practice started in the pit box, and the player had to ride down the pit lane first. Since 1.16.0 practice starts on the grid.

- **Grid slot:** the player picks the slot on the start screen with the same **Starting position** control as the 10 lap race (Pole / Front row / Mid-pack / Back, §4), and the bike stands on exactly the same slot as in the race (same grid boxes, same row and column). The track is empty apart from the player and any ghosts (§11c).
- **No start lights.** The session starts at once: no lights, no countdown, no grid wait.
- **Hold until the first input:** the bike stands still on the slot until the player presses W, S, A or D (the same hold as Curve training, §11d). "FREE PRACTICE · P12 on the grid · press W, S, A or D to go" is shown meanwhile. The moment of that first input is the **start moment** of the session: lap 1 is timed from it, and ghosts start moving at it (§11c).
- **Lap 1 is a timed standing-start lap**, as in the race: it runs from the start moment to the first time the line is crossed after a full lap (crossing the line just ahead of the grid does not count). It is saved like any other lap (§10). There is no out lap.
- Full tank, cold tyres, as at a race start.
- **The pit box is still usable:** stop in it for a pit stop (§7); W leaves the box as before. Since 1.22.0 a stop neither refuels nor repairs. The box marker on the minimap stays (§11).
- **Restart session** (pause menu) and **R** put the bike back on the same grid slot, held, with the ghosts re-synced (§11c). With Curve training On, Restart and R go to the training spot instead (§11d).
- Qualifying still starts from the pit box (out lap + 3 flying laps).

## 3. Controls

| Key | Action |
|---|---|
| W | Throttle (also leaves the pit box after a pit stop) |
| S | Brake |
| A / D | Lean left / right |
| O / L | Shift up / down (ignored in automatic) |
| M | Mute / unmute sound |
| C | Switch camera: Behind → CLOSE → Top-down → Behind (§11a) |
| R | Practice only: back to the start at once, ghosts re-synced. With Curve training On, to the training spot (§11d); otherwise, since 1.16.0, to the chosen grid slot (§2a) |
| Space, ←/→, ↓/↑, [ ], Tab | Replay viewer only: play/pause, jump 5 s, speed, lap, followed bike (§11e) |
| Esc | Pause menu (resume, restart, end qualifying, quit). In Practice it also shows the Curve training map (§11d) |

Keyboard controls stay the same on phones with a keyboard. Touch and tilt controls for phones are in §3a.

## 3a. Mobile controls (since 1.18.0)

Used when the game runs on a phone or tablet (touch screen, no keyboard). The desktop keys in §3 keep working on any device with a keyboard.

| Control | Action |
|---|---|
| Left half of the screen | Brake (default) |
| Right half of the screen | Throttle (default) |
| Rotate the phone | Lean. Tilting it left leans the bike left, right leans right |
| Pause button (bottom centre, between the two bottom panels) | Opens the pause menu (§11, Esc) |

- **Automatic only:** on phones the gearbox is always automatic (§4). There are no shift buttons.
- **Always on:** the brake and throttle halves and the tilt lean are always active on phones. They are not switched on in the menu.
- **Swap sides:** an option (§4) puts Throttle on the left and Brake on the right, for riders who want their hands the other way round.
- **Both halves pressed:** Brake wins, so the bike never accelerates and brakes at once.
- **Lean by tilt:**
  - The lean target follows the phone's roll angle in landscape. Rolling it through the angle set by Tilt sensitivity reaches full lean (default 60°), which the rider aids (§4) still limit as on keyboard.
  - A dead zone of 12° around the straight-up position (was 8°) stops small hand movements from leaning the bike. The bike starts to lean only past it, and the lean then grows smoothly up to full lean.
  - The zero point is the phone's angle when the race or session starts. Pause and resume keep the same zero. The pause menu has **Re-centre** to set a new zero.
  - Tilt sensitivity can be Very low (full lean at 75°), Low (60°, default) or High (35°).
- **No zoom:** on phones the browser must not zoom or scroll the page while playing. Pinch zoom, double-tap zoom and drag-to-scroll are off for the whole game. Pressing the throttle or brake halves never zooms the page. Menus still scroll with a finger, but do not zoom.
- **Brave and other iPhone browsers (since 1.19.5):** every iPhone browser on iOS uses the same WebKit engine, so the rules above apply to Brave too. The menus, overlays and pause screen must also block double-tap zoom: the overlay layer allows it today, so a double tap on a menu zooms the page. Text on the page cannot be selected by a press or long press, on any screen. The game surface keeps its current rules.
- **No zoom or selection while playing (since 1.19.7):** on iPhone browsers (Safari, Brave and the others, which all use WebKit) holding a brake or throttle half is a long press, and two quick presses are a double tap. Neither may select text, show the magnifier or copy menu, or zoom the page, during play or in replay. The touch layer cancels the browser's own handling of every touch it gets (start, move and end), not only the pointer press, because iPhone WebKit ignores a cancelled pointer press for its zoom and selection gestures. Two thumbs at once must not pinch zoom. Any text selection that appears during play is cleared. Brake, throttle, pause and replay seeking work as before.
- **Landscape only:** in portrait the game shows a "Turn your phone sideways" screen and pauses. Landscape is needed because the tilt is read from the roll angle.
- **Permission:** iPhone Safari asks for motion access the first time the player taps Start. If access is refused, lean is off and the message says so; brake and throttle still work.
- **Layout:** the brake and throttle areas have a faint tint so the player can see where to press. The HUD sits at the same places as on desktop, and the bottom controls are kept clear of the speedometer and fuel.
- **Replay:** on phones, tapping the left or right third of the replay steps back or forward 5 s, and tapping the middle third plays or pauses. The keyboard keys in §3 still work.

## 4. Options (menu)

Stored in `localStorage` key `sgp_opts`. The camera choice is remembered for all three cameras (before 1.14.0 only Top-down was kept; a saved Behind was dropped and fell back to the default, which was also Behind).

| Option | Values | Default |
|---|---|---|
| Transmission | Manual / Automatic. On phones always Automatic and not shown (since 1.18.0) | Manual |
| Controls (since 1.18.0) | Auto (touch on phones, keyboard elsewhere) / Touch / Keyboard. Touch shows the on-screen halves (§3a) | Auto |
| Left side is (since 1.18.0, touch only) | Brake / Throttle | Brake |
| Tilt sensitivity (since 1.18.0, phones) | Very low (full lean at 75°) / Low (60°) / High (35°) | Low |
| Rider aids (lean limiter + traction control) | On / Off | On |
| AI level | Rookie (0.905) / Pro (0.955) / Legend (0.99) of ideal pace | Pro |
| Camera | Behind (tilted) / CLOSE (tilted, low and close, since 1.14.0) / Top-down | Behind |
| Speed guide (practice only) | On / Off | On |
| Curve training (practice only) | Off / On toggle, plus spot on track and start speed 0–300 km/h | **On** (since 1.10.0), spot 350 m before Abbey, guide speed |
| Starting fuel (races) | 25–100 % of tank, step 5. Since 1.22.0 the race has no refuelling (§7), so this must cover the whole race | 100 % |
| Starting position (10 lap race and, since 1.16.0, Practice with Curve training Off) | Pole / Front row / Mid-pack / Back. One setting shared by both modes | Mid-pack |
| Speed blur (since 1.17.0) | On / Off. Blurs the surroundings at top speed in the Behind and CLOSE cameras (§11f) | On |
| Speed effects (since 1.24.0) | On / Off. Wider view, speed lines and camera vibration at speed (§11h). Off keeps the 1.24.0 zoom and the trackside details, which are part of the world | On |
| Sync ghosts to (since 1.16.0) | One of the selected ghosts (§11c) | The first selected ghost |
| Rider name, number, team | up to 14 chars / 1–99 / 11 teams | Petr, 25, Arancia Tech |

## 5. Bike physics

Model: point-mass bike on a 2D plane, integrated per frame with fixed sub-steps.

- **Mass:** bike 157 kg + rider 70 kg + fuel (0.745 kg/L).
- **Engine:** 205 kW peak, redline 18 000 rpm, idle 4 200 rpm, power curve shaped like a MotoGP V4/I4.
- **Gearbox:** 6 gears defined by top speed at redline (135/178/220/260/302/345 km/h). Clutch slip at launch. Over-rev protection blocks downshifts that would exceed redline (HUD shows *OVER-REV BLOCKED*).
- **Automatic:** shifts up near redline and down to keep the engine in the power band.
- **Aero:** CdA 0.30, air density 1.2, rolling resistance 0.015. **Slipstream** cuts drag up to 28 % behind another bike (HUD *SLIPSTREAM*).
- **Grip:** friction circle, μ 1.68 × surface × tyre temperature × wear × chassis damage. Braking up to 1.55 g; wheelie limit 1.02 g.
- **Cornering:** lean angle sets the path curvature via `tan(lean) = v²·κ / g`, max lean 64°. Lean rate drops with speed.
- **Rider aids:** lean limiter keeps lean inside the grip budget; traction control cuts power on wheelspin.
- **Steering ramp (1.26.0, approved 2026-11-01; Petr 2026-11-01: a bike at 250 km/h cannot lean 50° the way it does in tight corners).** Today the steering target is the full 64° the moment the key goes down (`src/world.js`), so the bike reaches 50° in about 0.5 s whatever the speed. Checked against the article on lean angle: lean = atan(lateral g), set by speed and corner radius, and racing riders reach 50–65° in fast corners. So the physics is right; the input is not. Proposed:
  - **Steer input ramps:** the steering target rises from 0 to the held steer over **0.35 s** (linear), and falls back the same way when the key is let go. Keyboard only: phone tilt is unchanged. A tap gives a small lean; a held steer reaches the full lean after the ramp.
  - **Lean is still set by speed and radius**, through the grip limit and `tan(lean) = v²κ/g`. No speed cap is added, because real racing lean is not capped by speed.
  - **Effect (measured 2026-11-01, 250 km/h, full left):** 50° is reached in 0.46 s, against 0.49 s before. The ramp is not the limit: the lean rate (about 122°/s at 250 km/h, from `clamp(3.4 - v/55, 1.55, 3.2)` rad/s) reaches 50° in 0.41 s on its own. The lean rate is unchanged.
  - **HUD:** the lean gauge shows the real lean, as now.
  - **Lap times and AI:** the AI sets its own lean (`aiControl`) and is not changed, so AI lap times do not move. Player lap times change through turn-in timing only.
- **Tyres:** cold for the first ~2.5 km (HUD *COLD TYRES*, up to 7 % less grip); slow wear over distance (up to 4.5 %).
- **Surfaces:**

| Surface | Grip | Rolling drag | Braking |
|---|---|---|---|
| Asphalt | 1.00 | 0 | 1.00 |
| Kerb | 0.88 | low | 0.90 |
| Tarmac run-off | 0.86 | low | 0.88 |
| Grass | 0.42 | medium | 0.45 |
| Gravel | 0.34 | grows with speed (below) | 0.40 |
| Pit lane | 0.95 | 0 | 1.00 |

**Gravel traps (since 1.23.0).** As in real life, gravel stops a fast bike hard but lets a slow rider get out by feathering the throttle:

- **Drag grows with speed:** 0.12 g + 0.0053 g × v² (v in m/s), at most 0.80 g: about 0.14 g at walking pace, 0.28 g at 20 km/h, the full 0.80 g from about 40 km/h (plus air drag, so about 1 g at 150 km/h). Before 1.23.0 it was 0.55 g at every speed.
- **Push is limited by the loose stones:** the rear tyre can give at most 0.30 g in gravel. With feathered throttle this balances the drag at about **20 km/h**, the top speed while in the gravel. From a standstill the bike reaches about 18 km/h in 5 s.
- **Too much throttle spins the rear wheel:** when the throttle stays more than half open for over 0.3 s (holding W), the wheel digs in: push falls to 0.13 g, the rpm flare up and more stones fly. That is below the drag, so the bike barely moves. Releasing W stops the spin. Tapping W (short presses, about three a second) keeps the wheel biting and rides out at about 18 km/h.
- **Rider aids on:** traction control feathers the throttle for you, so holding W rides out at about 20 km/h. With aids off you have to feather yourself.
- **A stopped bike stays still.** It no longer creeps forward at about 1 km/h (the bug before 1.23.0).
- **Hint:** the first time per session that the player's wheel spins in the gravel for over 1 s, the HUD shows *FEATHER THE THROTTLE*.
- Unchanged: the crash chance when leaning in gravel above 22 m/s (§6), braking 0.40, cornering grip 0.34, grass.

## 5b. Drive at lean (approved and built 2026-11-20, version set at Release)

Asked by Petr (2026-11-20), riding the Onboard camera (§11p): "When accelerating I can go between maximum leans on each side and bike still goes in the same direction pretty much." The check (§11p, lean and turning check) found the lean and turning correct, but **at 50° of lean the bike accelerates exactly as hard as upright** (0.93 g at 117 km/h): the friction circle (μ 1.68 g) covers 1.19 g of cornering plus the 1.02 g wheelie limit. Real riders cannot open full throttle at big lean; they pick the bike up first. Petr: question 9, "yes".

**Why the friction circle is not enough:** only the rear tyre drives, it carries the cornering load too, and a tyre on its edge gives less grip along its length than across it. The game's single circle for the whole bike leaves too much for drive at big lean.

**Design**
- **Drive cap by lean:** the drive the rear tyre can give falls with lean:
  `aDriveMax = 0.2 g + (wheelie − 0.2 g) × (1 − smoothstep((|lean| − 25°) / (leanGrip − 25°)))`,
  where `leanGrip = atan(gripMax / g)` is the lean at which the corner alone uses the whole grip (59° on warm, dry tyres; lower on cold tyres, kerbs or damage, so the cap falls earlier there).

  | Lean | ≤ 25° | 35° | 45° | 50° | 59° (grip limit) |
  |---|---|---|---|---|---|
  | Drive allowed | 1.02 g (wheelie limit, as now) | 0.85 g | 0.51 g | 0.35 g | 0.20 g |
  | Today | 1.02 g | 1.02 g | 1.02 g | 1.02 g | 0.23 g |

  The numbers are a design choice to be tuned by riding (no sourced telemetry for drive against lean). Full drive up to 25° keeps straights, kinks and fast exits as they are.
- **Rider aids on:** traction control holds the drive at the cap: no wheelspin, the bike simply accelerates less until it is picked up. The lean limiter is unchanged.
- **Rider aids off:** drive above the cap spins the rear: the slip grows with the excess, at the rate aids-off slip grows today (`(excess / cap) × 3.4` per second), and as today a slip over 0.5 with the throttle open is a highside. Easing the throttle or picking the bike up lets the slip fall back as now.
- **Braking is unchanged** (the front tyre and the friction circle, §5).
- **Speed profile and AI:** the ideal speed profile's traction pass (`T.speedProfile`) uses the same cap, with the lean from the racing line's curvature (`atan(v² κ / g)`), so the speed guide (§9), the corner countdown targets (§11b) and the AI's target speeds stay achievable. The AI rides with aids on through the same `stepBike`, so it follows the cap by itself.

**Lap times (check on this branch, before merging)**
- Before: ideal profile 2:08.11; AI Pro about 2:12 (§8). About 32 s of the ideal lap is spent accelerating at more than 25° of lean and 22 s at more than 40°, so the lap gets slower; my estimate is 1–3 s.
- Measured after the change and written here: the ideal profile lap; a headless AI Pro lap and its ratio to the profile (`AI_REAL`, now 0.99); a headless autopilot lap of the player's bike; acceleration from 100 km/h at 0°, 35° and 50° of lean (target: the table above).
- Saved laps and ghosts set before this change were set with more drive. They stay as they are.

**Built (2026-11-20)**
- `driveCapAt(lean, gripMax)` in `src/core.js`. In `stepBike` the cap is checked against the drive the wheelie limit leaves (not the engine's raw drive, which in a low gear is several g and made the first version highside in 0.04 s): with aids the drive is held at the cap; without aids the excess grows the slip and the drive is held at the cap (the spinning wheel gives no more). `T.speedProfile`'s traction pass takes the cap at the racing line's lean.
- **Measured (headless, `tests/unit` loader):**

  | | Before | After |
  |---|---|---|
  | Ideal profile lap | 2:08.110 | 2:12.006 (+3.9 s) |
  | Autopilot flying lap (player's bike, AI control) | 2:12.133 | 2:16.267 (+4.1 s) |
  | Acceleration from 100 km/h, upright | 0.94 g | 0.94 g |
  | at 35° of lean | 0.94 g | 0.77 g |
  | at 50° of lean | 0.94 g | 0.27 g |

  The accelerations are net of air drag (about 0.08 g at 100 km/h), so they sit that much under the cap table. The lap cost is more than the 1–3 s estimated: about 32 s of the lap is spent accelerating at more than 25° of lean. The autopilot's ratio to the profile stays the same (1.031 before, 1.032 after), so the AI follows the new profile; no crashes in the autopilot laps.
- **Aids off, throttle opened at the keyboard's normal rate (7 per second) and held:** at 35° no wheelspin builds up; at 45° a highside after 0.23 s; at 50° after 0.14 s. Feathering the throttle or picking the bike up first avoids it.
- Open question 4 (new): tune the shape after Petr rides it, if the lap is too slow.

**Tests (GDD 13b)**
- Unit tests: the new cap function (the table above, the cap falling earlier with less grip); `stepBike` at 50° of lean with aids on accelerates at no more than the cap (plus drag), and upright as before (0.93 g at 117 km/h); with aids off and full throttle at 50° the slip grows and a held throttle ends in a highside, while easing off lets it fall; `T.speedProfile` uses the cap (slower than before, and an AI bike can follow it: the headless AI lap within 2 % of the profile).
- `npm run test:unit` before merging into `dev`.

**Open questions (recommended answer in bold; the design above uses it)**
1. The shape: full drive to 25°, falling to 0.2 g at the grip limit? **Yes**, then tune by riding. Alternative: start the fall at 15° for a stronger effect.
2. Aids off: wheelspin and highside above the cap? **Yes**, it gives the throttle control real meaning. Alternative: only the cap, no highside.
3. Old saved laps and ghosts: keep them as they are? **Yes**; a note in the CHANGELOG at release.
4. The lap is 3.9 s slower (ideal 2:12.0). Keep the shape, or soften it (for example the fall starting at 30° instead of 25°, or the floor at 0.3 g instead of 0.2 g)? **Keep it** (Petr rode it, 2026-11-20: "5b is okay").

## 6. Collisions, crashes and damage

- Bikes are oriented boxes; contacts push both bikes apart and transfer speed.
- Contact with relative speed above ~3 m/s causes a slide; above ~5.5 m/s it is a crash.
- Hitting a wall or exceeding the grip limit by too much crashes the bike.
- **Crash:** bike slides and tumbles with sparks/debris, then the rider respawns on track after a delay.
- **Damage** has three parts (0–1 each), shown on the HUD:
  - **Engine** — up to −40 % power. At 100 % the rider is out (DNF).
  - **Aero** — up to +35 % drag.
  - **Chassis** — up to −13 % grip and −20 % lean rate.
- Damage is never repaired in the pits: since 1.22.0 a pit stop neither refuels nor repairs (§7). AI with heavy aero/chassis damage drives more cautiously.

## 6a. Track limits (since 1.20.0)

Based on the real MotoGP rules (FIM Grand Prix Regulations Art. 1.21 and the Race Direction track limits and shortcut protocols). Phase 1 (1.20.0): invalid laps in practice and qualifying, time penalties for cuts in races. Phase 2 (1.21.0): a count of infractions in races, a warning, the Long Lap loop and the last lap position drop.

**Legal and illegal**

| Legal | Over the limit |
|---|---|
| Asphalt, the white edge line, the kerbs | Tarmac run-off, gravel and grass beyond the outer edge of the kerb |
| The pit lane (surface `PIT`), and the strip between the track and the pit lane inside the pit zone | |

- The check uses the bike's centre point (the game has no separate wheels). A **trip off track** starts when the centre moves onto run-off, gravel or grass, and ends when it is back on asphalt, kerb or pit lane.
- Only the **player** is judged. AI riders follow their line and are not judged.
- Not judged: the out lap, the grid crossing before the first timed lap, laps driven by autopilot, and a trip that ends in a crash (the respawn puts the bike back on track, which is not a rejoin).

**Practice, Curve training and qualifying: the lap is invalid**
- Any trip off track during a timed lap makes the whole lap invalid. This matches the real rule, where the lap time is cancelled.
- The HUD shows a red **LAP INVALID · Track limits** message once, and the lap stopwatch turns red until the line.
- An invalid lap is still timed and listed, marked **INV**. It does not count as:
  - the session best or the best lap per mode (§10);
  - the all-time best lap trace or the PB;
  - a ghost lap (§11c), or the reference trace for the speed guide delta;
  - a best sector time (its sector splits are shown, but are not compared or stored as best).
- Qualifying: an invalid lap still uses up one of the 3 flying laps. If all of them are invalid, the player has no time and starts from the back of the grid.

**Races: count, warning and Long Lap (since 1.21.0, Phase 2)**

This replaces the Phase 1 rule (a fixed 2 s penalty for every cut).

- When a trip off track ends, the game compares its time with a **reference time** over the same stretch of track (from the point where the bike left the track to the point where it rejoined):
  - the player's best lap trace (`W.bestTrace`, 10 m steps), if it has times for both points;
  - otherwise the ideal speed profile at the speed guide pace (96 %, §9).
- **Time lost** = trip time − reference time.
  - Lost **0.5 s or more:** not counted. The rider ran wide and paid for it already, as in the real rules.
  - Otherwise the trip is **one track limits infraction**, and it is counted.
  - If the rider **gained** time (time lost below 0), the gain is also added at once as a **time penalty** (rounded up to 0.1 s), so the cut never pays.
  - If the gain is **1 s or more** (a clear advantage), the rider gets a **Long Lap at once** as well, for that single infraction. This trip is not added to the count.
- **Count and thresholds** (as in real MotoGP, the 10 lap race uses the Sprint numbers):

| Race | Warning | Long Lap |
|---|---|---|
| Grand Prix (20 laps) | 3rd infraction | 5th infraction |
| 10 lap race | 2nd infraction | 3rd infraction |

- Each counted infraction shows **TRACK LIMITS 2/5** in amber. At the warning it shows **TRACK LIMITS WARNING** in red (the dashboard message riders get in real races).
- When a Long Lap is given, the count starts again from 0, so 5 more infractions (3 in a 10 lap race) give the next one.
- **Last lap:** an infraction on the last lap while a rival is less than **0.5 s behind** (the real "striking distance") is not counted. Instead the player **drops one position**: in the result the player is placed directly behind that rival, if the rival finishes. The HUD shows **TRACK LIMITS · drop one position**.

**The Long Lap loop**
- A marked loop in the tarmac run-off on the **outside of Stowe**. That corner comes after the longest braking zone of the lap, with 38 m of tarmac run-off on the left, and is slow enough (apex about 120 km/h) for a safe detour.
- Shape: a 6 m wide lane that leaves the track edge (outside the kerb) about 70 m before the apex, swings out to about 22 m from the track edge at the apex, and joins the track edge again about 70 m after it. It is drawn with dashed white edge lines and **LONG LAP** painted on the tarmac, always visible. While a Long Lap is pending, its lines turn yellow and it blinks on the minimap.
- **Serving:** the rider rides through the lane: the bike's centre must be inside it at three checkpoints (entry, apex, exit) on the same pass. Then the HUD shows **LONG LAP SERVED** in green.
- **Cost:** a Long Lap always costs at least **2.5 s**. The time through the loop is compared with the reference time for the same stretch of track (as above). If the loop cost less than 2.5 s, the difference is added as a time penalty, so riding the loop well never makes it cheap.
- Riding the loop to serve a Long Lap is not a track limits trip. Riding it without a Long Lap pending counts as a normal trip off track.
- After the exit, the run-off up to 40 m past the end of the loop is part of the loop: rejoining the track there is not a trip either, so the way back never counts as a track limits infraction.
- A trip that reaches the loop, from the run-off just before the lane as well as inside it, is not counted when the rider gets back on track. The rider is judged only on trips that stay off the loop.
- **Window:** 3 laps. A panel under the lap stopwatch shows **LONG LAP · Stowe · 3 laps** and counts down at every line crossing. The real rule gives 3 laps too.
- **Not served** in time: **5 s time penalty** (more than the loop costs, so it never pays to ignore it), message **LONG LAP NOT SERVED · +5 s**.
- Given with **fewer than 3 laps left:** changed to a **3 s time penalty** at once (in real races the stewards change it to a time penalty).
- Two Long Laps pending: they are served one per pass of the loop, the oldest first, each with its own window.

**HUD and results**
- The total time penalty shows as **PEN +x.x s** next to the lap stopwatch and on the player's row in the timing tower (as in Phase 1). Time penalties are added to the race time at the finish and count in the result order.
- The results table's **Pen** column shows the time penalty and the Long Laps, for example `+1.4 s · 1 LL`. A position drop shows as `−1 pos`.

## 7. Fuel and pit stops

- Tank 22 L. Consumption ≈ 1.0 L per lap at race pace (scales with throttle and rpm), so a full tank covers the 20-lap Grand Prix with fuel to spare. Since 1.22.0 this is the only fuel the race has: there is no refuelling (see open question 1).
- **Out of fuel:** engine stops (HUD *NO FUEL*), the bike coasts.
- **Pit lane:** on the right of the Hamilton straight. Speed limiter 60 km/h is enforced automatically inside the lane (HUD *PIT LIMITER*).
- **Box:** each team has a box with crew and garage. Stopping in your box starts a pit stop: the bike is held until you press W. The stop does not refuel and does not repair.
- **AI strategy:** AI riders do not pit. They start with enough fuel to finish, and a stop would gain them nothing (see open question 4).
- **Menu:** Starting fuel shows the least fuel that finishes the chosen race (10 lap race 50 %, Grand Prix 95 %, in steps of 5). Less fuel is lighter and faster but risks running dry.

## 8. AI riders

- 21 fictional AI riders + the player = 22 bikes, across 11 two-rider teams.
- Driving: pure-pursuit steering on a racing line, target speed from the track speed profile × pace level × individual skill.
- Racecraft: traffic awareness, overtakes on either side, backs off to avoid contact; adjusts for grip loss from damage.
- Pace levels: Rookie 90.5 %, Pro 95.5 %, Legend 99 % of the ideal lap.

## 9. Speed guide (practice)

Option, on by default, practice only.

- Panel **directly under the lap stopwatch**, showing:
  - the recommended speed for the current point (96 % of the ideal speed profile);
  - the player's speed against it, coloured faster / on target / slower;
  - the distance to the next braking point.
- A coloured racing line drawn ~170 samples (~340 m) ahead of the bike: green accelerate, yellow lift, red brake.

- Phones (since 1.19.0): the speed guide panel is removed. The coloured line on the track is an open question (§11g). The panel is still there on desktop.

## 10. Saved laps (records)

Stored in `localStorage` key `sgp_records`, format `{v:1, laps, best, trace, traceT}`.

- Every completed player lap is saved (newest 300 kept) with the mode, time, sectors and date.
- Best lap per mode is kept; the all-time best lap trace is kept for comparison.
- Menu panel **"Your laps"** lists the best and recent laps, with a *Clear* button.
- On phones (since 1.19.0) the in-session **"Your laps"** list is removed (§11g). The saved laps stay in the menu.
- In practice, the timing tower shows an **ALL-TIME** best row.
- Laps driven by autopilot (e.g. while the crew is servicing) are not saved.
- Invalid laps (track limits, §6a, since 1.20.0) are saved with `inv: 1` and listed as **INV**, but never become a best lap, the all-time trace or a ghost lap. Session recordings mark them the same way.

## 11. HUD and screens

- **Top left:** timing tower (positions and gaps; in practice, session and all-time bests).
- **Top centre:** lap stopwatch, last/best lap, sector splits; speed guide panel below it (§9).
- **Bottom:** speedometer, rpm bar with shift light, gear, fuel (litres and laps left), damage bars, status tags.
- **Top right:** minimap of Silverstone with all riders.
  - The player's own pit box is marked by a ring in the team's main colour that blinks every 0.3 s.
- Centre messages for start, pit, flags and session events.
- Screens: menu, loading, pause, results.
  - **Version on the menu (since 1.19.6):** the version number shows next to the menu title, "Silverstone GP", as a small label (for example `v1.19.6`). The number is read from the newest `## vX.Y.Z` heading in `CHANGELOG.md` when `tools/build.py` writes `index.html`, so there is one source of truth and no version to edit by hand. It is shown on the menu only, not in play, pause or results.
  - **Release note on the menu:** beside the title, a one or two sentence summary of the newest release. It is built from the changelog by `releaseSummary` in `src/ui.js`: the first note that is not a test note, without its `(GDD ...)` references, up to two sentences. Nothing is written by hand, so the release steps do not change. Clicking it opens the full changelog for the last 10 releases (the `- ` notes); click again to close. The changelog is embedded by `tools/build.py`.
  - **Zoom and selection during play (since 1.19.7):** bug before 1.19.7 (suspected cause, found by reading the code, not reproduced here: the headless test browser is not iPhone WebKit): the touch layer only cancels `pointerdown`. iPhone WebKit still runs its long-press selection and double-tap zoom unless `touchstart`/`touchend` are cancelled with a non-passive listener.
  - **Zoom and selection on menus (since 1.19.5):** the overlay layer and the page body allow double-tap zoom and text selection. Bug before 1.19.5 (suspected cause, found by reading the CSS, not yet reproduced on a phone): `.overlay` sets `touch-action: pan-y`, which lets double-tap zoom through, and no rule stops text selection outside the game surface.
  - **Race result order (since 1.19.4):** the results table ranks finishers by laps completed first, then by finish order (the order they crossed the line). Every rider on the winner's lap count is listed above every rider a lap down, so all `+NN.MMM` rows come before all `+N lap` rows.
  - Bug before 1.19.4 (suspected cause, not yet reproduced in a run): after the chequered flag, a rider a lap down could cross the line first and was ranked above a lead-lap rider still on the last lap, because finish order alone set the rank. The "+1 lap" row then showed above a "+NN.MMM" row.
- **Touch (phones, since 1.18.0):** a faint brake or throttle tint on each half of the screen, a pause button at the bottom centre between the two bottom panels, and a "Turn your phone sideways" screen in portrait (§3a). The minimap, timing tower and speed guide keep their places; the speedometer and fuel stay at the bottom and are not covered by the touch halves' tint.

## 11a. Camera

Three cameras (since 1.14.0): **Behind**, **CLOSE** and **Top-down**. Chosen on the start screen (Camera option, §4) and remembered there; **C** switches through them in order Behind → CLOSE → Top-down → Behind, in a session and in replay. Choosing with C also updates the start-screen option. Behind and CLOSE are both tilted views drawn the same way (below); they differ only in their settings.

**Behind (default, since 1.7.0)**
- A chase view from behind and slightly above the bike. The flat 2D world is tilted back in true perspective (see Tuning below).
- Near track is big, which keeps the feel of speed. Far track shrinks towards the horizon, so corners coming up are visible much earlier than top-down.
- The bike sits ~20 % above the bottom edge. The view rotates with the bike's heading, smoothed. Bikes are drawn at least ~40 px long so they stay readable when zoomed out (visual only).
- Zoom eases out with speed: `ppm = min(20, min(VW, 1.25·VH) / (30 + 0.5·v))`. Since 1.7.1 it is closer at speed (it was `1.45·v`), because the far view made the game feel slow. Since 1.23.0 the speed factor is 0.5 (was 1.0), so the ground moves faster on screen at speed (§11h).
  - At 300 km/h roughly 200 m of track ahead is on screen, about the Stowe braking distance.
  - In a slow corner it stays close.
- HUD, name tags and panels are drawn flat on a separate layer on top. Name tags are projected through the same perspective.
- **Implementation:** the ground plane is rendered top-down into two offscreen canvases.
  - Near band: the first screen-height of plane at 0.75 × resolution.
  - Far band: the rest, up to ~2.6 screen heights, at 0.45 × resolution (0.4 before 1.11.6). It also covers the top 30 % of the near band, where the near band fades into it, so the picture gets softer gradually with distance instead of in one step where they join (since 1.11.6).
  - Both are projected onto the screen one screen row at a time, each row scaled by the perspective factor (since 1.11.5). Before, 3 px strips with one scale each drew straight lines (track edges, kerbs) as ~1 px steps every 3 rows, which showed as a kink across the screen, also where the near and far bands join.
  - A sky gradient fills the space above the far edge, and haze fades the far ground into it.
  - On slow machines (frames over 24 ms on average) the rows are first projected in 2-row strips, half the draw calls (since GDD 11n; straight lines bend by up to 0.6 px at the screen sides). If still slow, 1× pixels, then the resolution of both bands drops by a further 20 %.
- **Tuning:** the tilt is **40°** with a camera distance of 1.3 × screen height. The plane is 2.3 × screen width and 2.6 × screen height.

**CLOSE (since 1.14.0)**
- Its own camera, labelled **CLOSE** on the start screen and in the C message. It was the Close profile of the Behind camera in 1.13.0–1.13.1; it became a camera of its own so it can be picked on the start screen and compared with Behind using C.
- Aims at what a rider really sees: tilt 55°, so the road stretches ahead and the ground is seen at a low angle; camera distance 1.8 × screen height and the bike 8 % above the bottom edge; zoomed in (maximum 30 px/m, base 12 m, speed factor 0.4); most detail (near image 1.5, far image 0.7; above 1.0 uses the extra pixels of Retina screens); a deeper and wider ground (depth 6 × screen, width 3.5 × screen) so the road reaches the horizon, which sits about 8 % of the way down the screen. Fade zone 30 % and minimum bike length 40 px as in Behind.
  - Fine-tuned on a 1470 × 830 Retina screen. The first draft had distance 0.6, depth 5, width 2.3 and speed factor 0.6. With tilt 60°, a distance of 0.6 puts the horizon only about 35 % above the bottom edge (it sits at distance × cot(tilt)), so two thirds of the screen were sky. Distance 1.6 with depth 5.5 brings the far edge of the ground to about 69 % of the screen height. Width 3.5 keeps the far ground as wide as the view, and speed factor 0.4 keeps the bike bigger at speed.
  - Since 1.13.1 (Petr, 2026-10-28): the 1.13.0 Close (tilt 60°, distance 1.6, depth 5.5) showed too much sky (31 % of the screen), so the tilt went down to 55°, the distance up to 1.8 and the depth up to 6: sky is now about 8 % of the screen, the ground reaches about 10 % further ahead (≈200 m instead of ≈183 m at 280 km/h) and the bike is about 20 % longer on screen, with the same zoom. The far image went from 0.6 to 0.7, because with the lower tilt the step in sharpness where the near image fades into the far one grew from 8 % to 14 % (0.7 brings it to about 3 %).
- CLOSE draws more pixels and can be slower; the automatic quality drop for slow machines applies to both tilted cameras.

**Camera tuning (since 1.12.0; per camera since 1.14.0)**
- With the Behind or the CLOSE camera on, the pause menu (Esc) shows a **Camera tuning** panel for that camera, titled "Camera tuning (Behind)" or "Camera tuning (CLOSE)": one slider with a number box per setting. The view behind the menu updates live while dragging. Pressing C in the pause menu switches the panel to the new camera (and hides it for Top-down).
- Each tilted camera keeps its own values. Changing CLOSE does not change Behind and the other way round.
- Settings (Behind default / CLOSE default, range):
  - Tilt: 40° / 55°, 20–70.
  - Camera distance: 1.3 / 1.8 × screen height, 0.5–2.5.
  - Bike height on screen: 20 / 8 %, 5–40.
  - Zoom: maximum 20 / 30 px/m (10–30), base 30 / 12 m (10–60), speed factor 0.5 / 0.3 (0.1–2.0; was 1.0 / 0.4 and 0.3–2.0 before 1.24.0, §11h) in `ppm = min(max, min(VW, 1.25·VH) / (base + factor·v))`.
  - Ground depth default for Behind is 2.9 × screen since 1.24.0 (was 2.6), so the closer zoom loses less road ahead (§11h).
  - Speed effects (since 1.24.0, §11h): **Widen at speed** 15 / 15 % (0–30), **Vibration** 1.5 / 1.5 px (0–4).
  - Ground area: width 2.3 / 3.5 × screen (1.5–3.5), depth 2.6 / 6 × screen (1.5–6).
  - Image quality: near band 0.75 / 1.5 (0.4–2.0), far band 0.45 / 0.7 (0.25–0.8), fade zone 30 / 30 % (0–60).
  - Minimum bike length: 40 / 40 px, 20–80.
  - Speed blur (since 1.17.0, §11f): start speed 260 / 260 km/h (150–340, step 5), full speed 330 / 330 km/h (160–345, step 5, always at least 10 above the start speed), strength 20 / 24 px (0–40; 0 turns it off for that camera).
- **Reset to defaults** button: returns the current camera (only) to its own defaults above.
- Saved in the browser and kept after a reload: Behind in `localStorage` key `sgp_cam` (as before), CLOSE in `sgp_cam_close`.
- The **Profile** list of 1.13.0 (Standard / Close / Custom) is removed: Close is now its own camera, and Standard is what Reset to defaults gives on Behind, so the list had nothing left to choose.
- Saved values from before 1.14.0 (`sgp_cam`) stay with Behind. If the saved profile was **Close** with the Close values unchanged, Behind starts from its defaults instead (that player had picked Close, which is now the CLOSE camera); any other saved values, also Custom ones, are kept as they are. The `profile` field is no longer written.
- Not shown with the Top-down camera.

**Top-down (Rotating)**
- The pre-1.7 camera. Top-down, rotates with the bike's heading, zooms out with speed and looks ahead along the heading.
- Look-ahead is limited so the bike always stays on screen at top speed.

**Removed in 1.6.0**
- Look-ahead camera: its far zoom took away the feel of speed.
- North-up camera.

The corner countdown (§11b) works with all three cameras.

## 11b. Corner countdown (HUD)

The corner countdown appears in every mode when the player approaches a braking
corner. It uses the same corners that have braking boards on track: any corner
where the ideal speed drops by more than 80 km/h.

- **When:** it appears ~400 m before the corner's braking reference point. It disappears just after the corner entry. It is hidden in the pit lane and while crashed.
- **Where:** top centre, directly under the lap stopwatch (under the speed guide when that is shown). The section name moves below it.
- **Size:** compact, about 250 × 44 px.
  - Left: a 36 px pictogram.
  - Right, top row: corner name and distance.
  - Right, below: the four board tiles (each ~42 × 20 px) and a thin countdown bar.
- **Marks:** four board tiles **300 · 200 · 100 · 50**, measured to the same point as the trackside boards.
  - Upcoming tiles are drawn as white boards.
  - The next tile to pass is highlighted and grows as it gets closer.
  - Passed tiles turn dark.
  - A thin bar under the tiles counts down the distance.
- **Pictogram:** a small diagram of the corner's shape, about 250 m of track from just before the 50 board to the exit. It is turned so the approach points up, with an arrow at the exit and a dot for the player's position. It is drawn next to the tiles with the corner name.

## 11c. Session recordings and ghost opponents

**Recording**
- Every practice, qualifying and race session the player rides is recorded automatically.
  - Recording starts when the session starts and stops when it ends (results, restart, or quit to menu).
  - Laps ridden on autopilot are still recorded, but only the player's own completed laps count as "best lap".
- What is recorded:
  - Samples at 10 Hz: x, y, heading, speed, lean, track distance `s`, and race progress `p` (laps × track length + `s`).
  - Events: lap start and end times, the race start (lights out) time, and the finish.
  - Since 1.16.0 also the **start** of the session: how it started (`grid`, `spot` or `box`), the start moment `t` (lights out in a race; the first input in practice, §2a and §11d), the grid slot or the spot. Restart and R begin a new recording, so each recording has one start.
- A session is kept when the player completed at least one timed lap, or started a race.

**Recording file (JSON, `format: "silverstone-gp-session"`, `version: 1`)**
```
{ format, version, game, track: "silverstone", id, date,
  kind: "practice|quali|sprint|gp", mode: "practice|quali|race", totalLaps,
  rider: { name, num, team, short }, aids, auto,
  laps: [ { start, end, time } ], bestLap, raceStart, finishT, position,
  start: { kind: "grid|spot|box", t, slot, s, v },        // since 1.16.0
  samples: { dt: 0.1, x: [], y: [], h: [], v: [], lean: [], s: [], p: [] } }
```
- `start` is an added field, so the version stays 1 and older files still load. A file without it is read as: race recording with `raceStart` → `grid` start at `raceStart`; any other → `box` start.
- `slot` is the grid position (1–22) for a `grid` start; `s` (track distance) and `v` (start speed, m/s) are for a `spot` start.
- `raceStart` stays race-only (practice recordings keep it 0, so the Recordings list does not show them as a DNF).
- Numbers are rounded to keep files small. A 20-lap race is about 1 MB.
- File name: `silverstone_<mode>_<rider>_<best lap>_<yyyy-mm-dd_hhmm>.json`.

**Library (menu panel "Recordings")**
- **Storage (since 1.9.1): `localStorage`.**
  - The last **10** recorded sessions (practice, qualifying and races) are kept, in key `sgp_sessions`. When an 11th is saved, the oldest is dropped automatically.
  - To fit, sessions are stored in a compact form: each sample channel is delta-encoded as 16-bit integers in base64. A 20-lap race takes about 0.4 MB and 10 such races fit in the usual 5 MB browser limit.
  - If the browser still reports the storage as full, the oldest sessions are dropped until the new one fits, so fewer than 10 may be kept. A short note in the panel says so.
  - Imported files and files read from `saved_tracks/` are held only for the current visit; they are not written to `localStorage`. The linked folder re-loads them with one click.
  - On the first start of 1.9.1, the newest 10 sessions from the old IndexedDB library are moved to `localStorage` once.
  - Exported JSON files keep the readable format below (unchanged), so older exports still import.
- **Each row shows:** rider, session type, best lap, laps and date, plus three actions:
  - **Replay** (since 1.11.0): watch the session in the replay viewer (§11e).
  - **Compare** checkbox (since 1.11.0): pick several sessions and replay them together (§11e).
  - **Ghost** toggle: race against this recording.
  - **Sync** (since 1.16.0): shown on rows whose Ghost is on; picks which ghost is the sync reference for spot starts (see Ghost sync below). Exactly one is marked. Saved in `localStorage` key `sgp_ghost_sync`. When the reference is switched off, the first remaining ghost becomes the reference.
  - **Export:** save that session as a JSON file (into the linked `saved_tracks/` folder, otherwise to Downloads). Every row in the list has its own Export button.
  - **Delete.**
- **Import file…** imports one or more `.json` files.
- **Open saved_tracks folder…** reads every `.json` in the `saved_tracks/` folder next to `index.html`.
  - A web page opened from disk cannot list a folder by itself, so the player picks the folder once.
  - Chrome and Edge use the folder picker and remember the folder. Next time, one click on **Reload saved_tracks** re-reads it.
  - Since the folder is linked with write access, every new session is also saved into it automatically.
  - Safari and Firefox use a folder-upload picker (read only). Exports go to Downloads and are moved into `saved_tracks/` by hand.
  - When the game is served over http(s), `saved_tracks/index.json` (a list of file names) is also read automatically if present.
    - `python3 tools/index_saved_tracks.py` writes that list. `saved_tracks/README.md` explains the folder.
- **Export:**
  - In the pause menu and the results screen, **Export session** exports the current session.
  - With a linked folder, files are written straight into `saved_tracks/`. Otherwise they are downloaded.

**Ghost opponents** (up to 4 selected recordings)
- Ghosts are drawn translucent with a "GHOST" name tag. They appear on the minimap as hollow dots.
- They have no collisions and AI riders ignore them. They never pit, crash or use fuel; they replay positions only.
- **Practice (since 1.16.0, see Ghost sync below):** ghosts start moving at the same moment as the player, from the grid or from the curve-training spot. After that, from the player's first line crossing on, each ghost replays the best lap of its recording with every timed lap the player starts (crossing the line, or completing a lap) and disappears at the end of its lap, as before. The timing tower lists each ghost's best lap.
  - 1.15.0 (replaced): in curve training no ghost was shown before the line; the ghosts only started with the first timed lap. Petr found that this did not work well: the ghost was missing for the part being practised.

**Ghost sync in practice (since 1.16.0)**

The ghosts are synced to the player at the **start moment** (the first W, S, A or D press on the grid or on the spot; §2a, §11d). Until then the player and the ghosts all stand still, each ghost shown at its sync position. How a ghost is synced depends on how the player starts and on what its recording holds.

*Grid start (Curve training Off)*
- **Recordings with a standing start** (a race recording, or a practice recording made since 1.16.0 that started on the grid): the ghost stands on its own recorded grid slot and launches at the start moment, together with the player. The time between the recorded lights out and the recorded rider's launch (start lights, hold and reaction) is cut:
  - The **launch moment** of a recording is found from its samples: from `start.t`, the first sample with speed above 0.5 m/s; the launch moment is the sample before it (still standing). For a 1.16.0 practice grid recording this is about `start.t` itself.
  - The ghost then plays its recording at `launch + (now − start moment)`: the whole recording as ridden, lap after lap, including its pit stops, until the recording ends; then it disappears. Its race laps are listed in the timing tower like its best lap.
  - Its grid slot can be the same as the player's; ghosts have no collisions, so they simply overlap.
- **Recordings without a standing start** (older practice recordings that started in the box, qualifying, curve training): no ghost on the standing lap. The ghost starts its best lap at the player's first line crossing, as before 1.16.0. (Its best lap is a flying lap; starting it beside a standing bike would put it 20 m ahead at 250 km/h in the first second.)

*Spot start (Curve training, Go to spot, R)*
- The player stands on the spot at track distance `s0`. Each ghost uses its **sync lap**: its best lap (the same lap the practice rule uses; laps ridden on autopilot only if there is no other).
- **The reference ghost** (the one marked Sync) is placed where it passes `s0` on its sync lap:
  - `t_spot` = the time in the recording where its track distance crosses `s0` within its sync lap, interpolated between the two 10 Hz samples around it. Every point of the track is passed once in a lap from line to line, so there is one answer.
  - Until the start moment the ghost is shown standing at that sample; from the start moment it plays at `t_spot + (now − start moment)`.
- **The other ghosts are aligned to the reference by lap time**, the same way as Align = Best lap in the replay viewer (§11e): with `τ = t_spot − (start of the reference's sync lap)`, each other ghost plays from `τ` seconds into its own sync lap. So at the start moment the reference is right on the player, and each other ghost is ahead or behind by how much faster or slower it reached that point of its lap than the reference did. If `τ` is longer than a ghost's lap, that ghost appears only with the next timed lap.
  - Why not sync every ghost to the spot: they would all stand on top of each other and the choice of reference would mean nothing. Relative to the reference, the gap between the ghosts is shown from the first metre.
- **Speed:** a ghost passes the spot at its recorded speed, while the player starts at the curve-training start speed (the guide speed by default, any value 0–300 km/h). Rule: the ghost always runs at its recorded speed; nothing is slowed down or bent. With the guide speed the two speeds are close; with a much lower start speed the ghost pulls away at once, which is what really happens when entering a corner too slowly. The start message names the reference's speed at the spot so the player can match it, e.g. "CURVE TRAINING · Abbey · 212 km/h · ghost VAL 218 km/h".
- After the sync lap: a ghost that reaches the line disappears; from the player's first line crossing on, the normal practice rule applies (best lap with each timed lap).

*Restart, R and Go to spot* put the player back on the grid slot or spot and sync all ghosts again in the same way, with the reference chosen at that moment.

*Choosing the reference*: the **Sync** mark in the Recordings list (above) and a **Sync ghosts to** list in the practice pause menu (only with 2 or more ghosts). A change in the pause menu applies from the next Restart, R or Go to spot, like the other curve-training settings. The reference only matters for spot starts; on the grid every ghost syncs to its own launch.
- **Race (10 laps and Grand Prix):**
  - Each ghost replaces one of the slowest AI riders, so the grid stays at 22.
  - A race recording replays from its own lights out, aligned to this race's lights out. It follows its recorded line including its grid slot, start and pit stops.
  - A practice or qualifying recording replays its completed laps in order from the start line at lights out, looping them if the race is longer.
  - Ghosts count in the race order, gaps, timing tower and results (marked "GHOST").
    - A ghost finishes when its progress reaches the race distance.
    - It retires (shown "OUT") if its recording ends before that.
- **Qualifying:** no ghosts (the AI field is simulated).

## 11d. Curve training (practice only)

Practise one corner again and again without riding the whole lap.

**Menu (shown when Practice is selected)**
- **Curve training** On / Off. When On, the menu shows:
  - **Track map:** click or drag on the map to pick the start spot. The spot snaps to the nearest point of the track centreline and is drawn as a marker with an arrow for the direction of travel.
  - **Corner list:** picks the spot 350 m before the braking zone of that corner (so all four countdown boards come up) and sets the start speed to the guide speed there.
  - **Start speed** slider, 0–300 km/h in steps of 5, plus a **Guide speed** button that sets the recommended speed for the spot.
  - A line naming the spot: the corner it is in, and the distance to the next corner.
- Spot and speed are saved with the other options.
- Since 1.10.0 Curve training is **On by default**. Saved options from older versions switch to On once; after that the player's choice is kept.

**Pause menu in Practice (Esc, since 1.10.0)**
- The pause menu shows the same Curve training block as the main menu: the **On / Off toggle**, the track map, the corner list and the start speed slider with **Guide speed**.
- **Go to spot** puts the bike on the chosen spot at the chosen speed at once (a fresh curve-training session, as with Restart). It turns Curve training On if it was Off.
- **Resume** carries on riding where the bike is. Changes to the toggle, spot or speed are saved and apply from the next restart or R.
- Turning the toggle Off and pressing **Restart session** starts normal practice on the chosen grid slot (§2a; before 1.16.0, from the pit box).
- **Sync ghosts to** (since 1.16.0, with 2 or more ghosts selected): picks the reference ghost (§11c).

**Session**
- The bike starts on the spot, always in the **centre of the road** (lateral offset 0), pointing along the track, at the chosen speed and in the matching gear. The tank is full and the tyres are warm.
- The bike waits on the spot, frozen, until the player presses W, S, A or D, then rides off at the chosen speed. "CURVE TRAINING · press W, S, A or D to go" is shown meanwhile.
- **Restart session** (pause menu) and the **R** key put the bike back on the same spot at the same speed, with no delay.
- Riding on past the line starts normal timed laps, as in practice.
- Since 1.16.0 ghosts (§11c) ride from the spot too: the reference ghost stands on the spot with the player and both start at the first input; the other ghosts are placed relative to it (Ghost sync in §11c). From the first line crossing on they ride with each timed lap as in practice. (1.15.0: ghosts appeared only from the first timed lap.)
- Curve training is not available in qualifying or races.

## 11e. Session replay (since 1.11.0)

Watch one recording, or several together for comparison. Any recording in the list can be used (own sessions, imported files, `saved_tracks/` files).

**Opening**
- **Replay** button on each row of the Recordings list: replays that one session.
- **Compare** checkbox on each row (up to 6) and a **Replay selected** button above the list: replays the ticked sessions together.
- **Watch replay** on the results screen (race and qualifying) and in the pause menu (the session so far).

**Comparing several sessions**
- All selected bikes ride on the track at the same time on one shared timeline. The first ticked session is the **reference**; the others are drawn slightly translucent, each with a name tag (rider, session, date).
- **Align** choice in the replay bar:
  - **Best lap** (default): each session's best lap starts at 0 s, so the bikes leave the line together and the timeline is as long as the slowest of those laps.
  - **Lap N**: the same, using lap N of every session (sessions without that lap are hidden).
  - **Session start**: each session from its own start; race recordings from their own lights out.
- **Gap panel** (top left): each bike's time gap to the reference at the same point of the track, updated live, plus its lap time for the aligned lap. Best of the group in purple.
- **Tab** switches which bike the camera follows; the minimap shows all of them.

**What is shown**
- The bikes on the track, driven by the recorded samples (position, heading, lean, speed), smoothly interpolated between the 10 Hz samples.
  - Since 1.11.2 the path follows a cubic B-spline through the samples. Straight lines between samples turned the bike's direction in small steps ten times a second, and the camera shook in replay.
  - New recordings take each sample exactly on the 0.1 s grid (interpolated between physics steps); before, a sample could be up to 8 ms late.
- Recordings hold only the player's bike, so AI riders are not in the replay.
- The normal cameras (Behind / CLOSE / Top-down, C or the Camera button to switch, same order as in a session) follow the followed bike. The replay starts with the camera chosen on the start screen (or the one in use, when opened from the pause menu or results screen).
- HUD for the followed bike: speed, lean, lap number, current lap time, best lap, the corner name and the corner countdown. No fuel, damage or throttle data (not recorded).

**Timeline (bottom of the screen)**
- A full-width scrubber from session start to end. Click or drag to jump anywhere. Lap starts are marked with ticks and lap numbers; the best lap is purple.
- Buttons: **Play / Pause**, **Rewind** and **Fast forward**, **Slow motion**, **1×** (back to normal speed, also by clicking the speed readout), **Previous / next lap**, **Exit**.
- The buttons, the keys and the timeline work whatever has focus (after using the Align list, focus goes back to the replay so Space and the arrows keep working).
- Playback speeds: −8×, −4×, −2×, −1× (rewind), 0.25×, 0.5× (slow motion), 1×, 2×, 4×, 8× (fast forward). The current speed and time are shown next to the scrubber.
- Keys: **Space** play/pause, **←/→** jump 5 s, **↓/↑** slower/faster (through the list above, through 0 into rewind), **[ / ]** previous/next lap (Session start alignment), **Tab** followed bike, **C** camera, **Esc** exit to the menu (or back to the results screen).
- At the end of the recording playback pauses; rewinding to the start pauses there too.

## 11f. Speed blur (since 1.17.0)

Asked by Petr (2026-10-28): "Create blur effect in high speeds. High speed - blur just perspective view in Top speed only road with borders should be sharp."

**What the player sees**
- Only on the long straights, close to top speed: the grass, gravel, tarmac run-off, pit lane, walls, boards, trees, grandstands and buildings beside the track smear into streaks that run outward from the point straight ahead on the horizon, like a camera zooming forward. The faster, the stronger.
- The road stays sharp, with its borders: the asphalt, the white edge lines, the red and white kerbs, the grid boxes, painted corner names and tyre marks. The sharp area reaches 0.3 m beyond the outer edge of each kerb (or of the white line where there is no kerb), so the border itself is never touched.
- The bike, the ghosts and the other riders stay sharp, also when one of them is off the road. So do the name tags, the HUD, the minimap and every panel (they are on the flat HUD layer anyway).
- The streaks are short near the horizon and longest at the screen edges, so the far road and the corner coming up stay readable. Smoke and dust off the road are blurred with the ground.
- Only in the tilted cameras, **Behind** and **CLOSE**. **Top-down** is never blurred.

**Strength vs speed**
- The bike tops out at 345 km/h (6th gear at redline); on Silverstone's long straights (Hangar, Wellington, Hamilton) it reaches about 320–340 km/h.
- Strength `s = smoothstep((v − start) / (full − start))`, with **start 260 km/h** and **full 330 km/h** by default. Below 260 km/h there is no blur at all, so braking zones and corners are always sharp. In 6th gear on a straight it fades in; at 330 km/h and above it is full.
- `v` is the speed the camera follows: the player's bike, or in replay the followed bike's recorded speed (also in slow motion, fast forward, rewind and when paused, so a paused frame looks the same as when it played). While crashed the blur fades out with the sliding speed like any other speed.
- **Maximum strength** is the length of a streak at the screen edge, at full strength: **20 px** (Behind) and **24 px** (CLOSE, which is closer to the ground and feels faster), in CSS pixels at the screen corner farthest from the horizon point. Halfway to the horizon a streak is half as long; at the horizon it is 0.

**How it is built (cheap zoom blur, road masked out)**
- After `projectTilted()` has drawn the ground (with the bikes in it) onto the screen, and only when `s > 0.01`:
  1. Copy the projected screen into a small offscreen canvas at **¼ of the CSS resolution** (one `drawImage`). The down- and upscale alone already softens the picture by about 4 px.
  2. Into a second small canvas, draw that copy **3 times**, scaled about the horizon point straight ahead (screen centre column, horizon row) by 1, 1 + k/2 and 1 + k, each with alpha 1/3, where `k = strength · s / (distance from the horizon point to the farthest screen corner)`. Scaling about one point moves every pixel by an amount proportional to its distance from it, so the streaks radiate from the vanishing point and grow towards the edges with no per-pixel work.
  3. Cut the sharp area out of it with `destination-out`: the **road polygon** (both track edges plus kerb width plus 0.3 m, projected to the screen with `worldToScreen` for every track point inside the ground area, in contiguous runs so a second part of the track in view is cut out too, e.g. parallel straights) and an **ellipse around each bike and ghost** on screen (1.3 × its drawn length, so it covers the boosted sprite). The pit lane is not part of the road polygon. The mask is drawn at the same ¼ resolution, so its edge is soft over about 4 px, all of it on the outside of the 0.3 m margin.
  4. Draw the masked blur back over the screen, upscaled with smoothing, with `globalAlpha = s`. The road and the bikes stay as `projectTilted()` drew them; the surroundings cross-fade from sharp to blurred as `s` rises.
- No `ctx.filter` (slow or missing in some browsers) and no extra pass over the ground layers or the tile cache: the cost is two small canvases (about 370 × 210 px on a 1470 × 830 screen), four small `drawImage` calls, one path of a few hundred points and one full-screen `drawImage`.
- **Performance limit:** at full strength the blur may add at most **20 % to the frame time** of the same view without it (target: about 1 ms on the 1470 × 830 Retina reference screen). It was 15 % until the 3D scenery (§11o): the blur draws the 3D walls, trackside and estate a second time so they smear too, and Petr raised the limit for that (2026-11-20). When the slow-machine quality drop lowers the tilted image quality (`TILT.q` below 1, §11a), speed blur is switched off for the rest of the session, before that it counts in the frame time like everything else.
- Name tags and the HUD are drawn after it on the HUD layer, as now.

**Settings**
- **Speed blur** On / Off on the start screen (§4), default **On**, saved in `sgp_opts` (`blur`). Off skips all of the above (no extra cost).
- The Camera tuning panel in the pause menu (§11a) gets three more sliders for the current tilted camera, saved with its other values (`sgp_cam`, `sgp_cam_close`) and returned to defaults by Reset to defaults: **Blur start speed**, **Blur full speed**, **Blur strength** (values and ranges in §11a). Older saved values without these fields get the defaults. The view behind the pause menu shows the blur at the current speed, so changes can be seen live while moving the sliders (when paused at top speed).

## 11g. Phone HUD (since 1.19.0)

On phones (touch controls on, §3a) the HUD is made smaller and simpler. Desktop keeps the layout in §11. The phone layout is picked by the touch controls, not by the screen width, so a phone in landscape gets it.

| Element | Desktop (§11) | Phone |
|---|---|---|
| Speedometer, bottom left | Speed, gear, rpm bar, lean and brake/gas bars | **Compact:** speed, gear and rpm bar. Lean as a small bar, with the angle in degrees centred right above it and no "LEAN" label. The brake and gas bars are removed, because the touch halves already show them |
| Fuel, engine, aero and chassis panel, bottom right | Shown | **Removed completely** |
| Lap stopwatch | Top centre, with last/best, sectors and the position | **Top left**, compact: current lap time, last and best lap. Sectors and position move into the timing tower |
| Next corner countdown (§11b) | Under the stopwatch, top centre | **Top centre**, compact: corner name, distance to it and the pictogram. The 300/200/100/50 marks stay |
| Speed guide panel (§9) | Under the stopwatch | **Removed** |
| "Your laps" list (§10) | Top left, in practice and the time attack | **Removed** |
| Timing tower (race, §11) | Top left | Top left, under the stopwatch, with shorter rows so six riders fit |
| Minimap | Top right, about 190 px | Top right, about 140 px |
| Start lights, centre messages | As in §11 | Unchanged |

- Nothing on the phone layout is drawn over the touch halves' labels at the bottom edge.
- Fuel is not shown on the phone HUD. A race has no refuelling, so a centre message warns when fewer than 3 laps of fuel are left (see open question 2 of 1.19.0).

### Open questions for 1.19.0 (recommended answer in bold; the design above uses it)

1. The coloured racing line on the track (§9) on phones: keep or remove? **Keep**, because it is on the track, not in the HUD. Remove the panel only.
2. Fuel is removed from the HUD. How is a low tank warned? **Centre message "FUEL 3 LAPS" once when fewer than 3 laps are left**, and again at 1 lap.
3. Minimap on phones: keep its size or make it smaller? **About 140 px**, so the timing tower and the minimap do not crowd the top corners.
4. Lean as a number in the speedometer, or a bar? **A bar** (Petr, 2026-10-28), with the angle in degrees centred right above it and no "LEAN" label (Petr, 2026-10-28).

## 11h. Sense of speed (since 1.24.0)

Asked by Petr (2026-10-30): "How to make game feel faster?", then picked four of the proposed changes: closer zoom at speed, wider view at speed, more detail beside the road, and camera vibration at speed.

**Why the game felt slow**
- How fast the ground moves across the screen is `ppm · v`. With `ppm = C / (base + factor·v)` that is `C · v / (base + factor·v)`, which flattens out as speed rises. In Behind (base 30, factor 1.0) doubling the speed from 160 to 320 km/h made the ground move only about 25 % faster on screen. The camera zoomed out almost as fast as the bike sped up.

**1. Closer zoom at speed**
- The zoom speed factor goes down: **Behind 1.0 → 0.5**, **CLOSE 0.4 → 0.3**. The slider range becomes 0.1–2.0 (was 0.3–2.0). Base and maximum stay the same.
- On the 1470 × 830 reference screen (`C` = 1037):

  | | Behind 1.23 | Behind 1.24 | CLOSE 1.23 | CLOSE 1.24 |
  |---|---|---|---|---|
  | Zoom at 160 km/h | 13.9 px/m | 19.9 px/m | 22.6 → 30 (max) | 30 (max) |
  | Zoom at 320 km/h | 8.7 px/m | 13.9 px/m | 21.8 px/m | 26.8 px/m |
  | Ground speed on screen at 320 km/h | 775 px/s | 1239 px/s (+60 %) | 1938 px/s | 2382 px/s (+23 %) |
  | 320 vs 160 km/h on screen | ×1.25 | ×1.40 | ×1.45 | ×1.79 |

- A closer zoom shows less road ahead. The Behind **ground depth goes from 2.6 to 2.9 × screen height** (the design asked for 4.0; see Performance limit below for why it is 2.9). Measured at 300 km/h on the 1470 × 830 screen, the road visible ahead in Behind goes **from about 208 m to about 148 m**. Behind sky on a straight at speed is about 8 % of the screen. CLOSE is already at its maximum depth (6) and shows about 172 m ahead at 300 km/h. The corner countdown (§11b) still warns from about 400 m.
- **Saved camera values:** a saved Behind value of exactly 1.0 for the speed factor or 2.6 for the depth, and a saved CLOSE speed factor of exactly 0.4, are the old defaults and move to the new ones on load. Any other saved value is the player's own choice and is kept. Reset to defaults gives the new values.
- Top-down keeps its zoom (see open question 1).

**2. Wider view at speed (Behind and CLOSE)**
- Like a racing game widening its field of view: above 200 km/h the camera moves closer to the ground plane, so the perspective gets stronger. The near ground and the sides stretch outward and the road ahead seems to rush at the player.
- Camera distance used for drawing: `P = p · VH · (1 − widen · w)`, with `w = smoothstep((v − 200) / (340 − 200))` (v in km/h, the speed the camera follows, as for the blur in §11f) and **widen 15 %** by default for both cameras. Below 200 km/h nothing changes. `w` is smoothed over about 0.4 s, so braking does not snap the view back.
- **The horizon stays put** (implementation finding, 2026-10-30): the horizon sits at distance × cot(tilt), so a shorter distance alone lowered it and showed much more sky (CLOSE at 340 km/h: about 19 % of the screen instead of 8 %). The tilt used for drawing is lowered with the distance, `tan(a') = tan(a) · (1 − widen · w)`, so distance × cot(tilt) stays the same. Measured at 1470 × 830: CLOSE sky 8.4 % → 5.9 % at 340 km/h; Behind sky does not grow either. What is left of the effect is mostly the road ahead stretching taller: the point 20 m ahead moves up about 8 px in Behind and 17 px in CLOSE at full widen; the sides barely move.
- The bike stays at its set height on screen (`tiltBikeH()` already uses the current distance and tilt). The horizon point of the speed blur and of the speed lines follows the current distance and tilt.
- The ground layers are sized once in `resize()` for the smallest distance the setting can reach, so no canvas is reallocated while the speed changes.
- Camera tuning gets a slider **Widen at speed**, 0–30 %, step 1, per tilted camera. 0 turns it off for that camera.

**3. More detail beside the road**
The eye judges speed from small things passing by. These are part of the world, baked into the cached ground tiles (no cost per frame), and are shown in all three cameras and in replay.
- **Mowing stripes on the grass:** bands 6 m long along the track, alternating lighter and darker (about ±6 % brightness), running across the track direction from the track edge to the wall on both sides. They follow the track's curves, so they always cross the view at right angles to the road.
- **Distance posts:** small white posts with a black top (0.5 × 0.5 m, with a short shadow) every 25 m on both sides along the straights, on the grass 1 m inside the wall. Not where kerbs are (corners) and not in the pit lane. The braking boards stay as they are.
- **Asphalt joints:** a faint dark line across the track every 40 m (about 8 % darker than the asphalt, 0.15 m wide), as where the track was resurfaced. Subtle so it does not look like a painted line.
- At top speed in the tilted cameras the stripes and posts are smeared by the speed blur (§11f) like the rest of the surroundings, which makes the streaks easier to see.

**4. Speed lines (all cameras)**
- Above 280 km/h, thin white lines streak outward at the screen edges, from the horizon point straight ahead (Top-down: from a point above the bike in the direction of travel). Strength `l = smoothstep((v − 280) / (340 − 280))`.
- About 16 lines at full strength, each 1 px wide, 40–120 px long, alpha up to 0.3 · `l`, living about 0.15 s. They appear only in the outer 30 % of the screen width and never over the road ahead.
- Drawn on the HUD layer before the HUD, so panels, timing and the minimap stay on top. Cost: a few short lines per frame.

**5. Camera vibration at speed**
- The world image shakes by a small random offset every frame; the HUD stays still. It uses the same path as the impact shake (§6), and the two add up.
- Amplitude `A = vib · min(2, s + k + b)`, with **vib 1.5 px** by default:
  - `s = smoothstep((v − 180) / (345 − 180))`: speed, 0 below 180 km/h, 1 at top speed.
  - `k = 1` while on a kerb above 50 km/h: kerbs rattle.
  - `b = 0.5` while braking harder than 1.0 g.
  - So the most it shakes is 3 px (2 × vib).
- Camera tuning gets a slider **Vibration**, 0–4 px, step 0.5, per tilted camera; Top-down uses the default 1.5 px.
- No vibration while paused, in the pause menu or while crashed (the impact shake still works). In replay it follows the followed bike's recorded speed and surface.

**Settings**
- New start-screen option **Speed effects** On / Off (§4), default **On**, saved in `sgp_opts` (`fx`). Off turns off the wider view, the speed lines and the vibration at speed (not the impact shake). The closer zoom and the trackside details stay, because they are part of the camera and the world. Hint text: "Wider view, speed lines and camera vibration at speed."
- The pause-menu Camera tuning panel gets the two new sliders above, saved with the other camera values (`sgp_cam`, `sgp_cam_close`) and reset by Reset to defaults. Older saves without them get the defaults.

**Performance limit**
- Everything in 1.24.0 together may add at most **10 % to the frame time** at top speed on the 1470 × 830 reference screen, compared with 1.23.0 in the same view. Measured (headless Chromium, 1470 × 830 @2x, Behind at 340 km/h; implementation finding, 2026-10-30): the zoom, wider view, speed lines and vibration together add about 2 %. The deeper ground is what costs: depth 4.0 added +23 %, +15 % with the far band at 0.4 and +8 % at 0.35. But a far band below 0.45 fails the seam test (§11a, `tilt_seam`): at 1024 × 700 the jump in sharpness where the near band hands over to the far band grows from 11 % to about 20 % (limit 15 %); near band 0.6 with far band 0.35 fails too. So the far band stays at 0.45 and the **Behind depth is 2.9**: about +8 %. Each 0.1 of depth costs about 2 %. A player whose machine is fast enough can set a deeper ground in Camera tuning.
- When the slow-machine quality drop (`TILT.q` below 1, §11a) happens, the speed lines and the wider view stay (they are cheap); the speed blur goes off as before.

**Tests**
- `camera_tuning`: new defaults (zK 0.5 / 0.3, Behind depth 2.9, widen 15, vib 1.5), the two new sliders, and the move of old saved defaults to the new values while custom values are kept.
- New `speed_feel` test: zoom at 160 and 320 km/h matches the table above; widen is 0 below 200 km/h and full at 340; no canvas reallocation while the speed changes; speed lines are drawn at 340 km/h and not at 250 km/h or with Speed effects Off; the world offset is 0 at rest, when paused and with Speed effects Off, and at most 2 × vib at top speed on a kerb; frame time within the limit above.

### Open questions for 1.24.0 (recommended answer in bold; the design above uses it)

1. Top-down camera: change its zoom too (`34 + 0.95·v`, which flattens out the same way)? **No**, keep it: its look-ahead is limited so the bike stays on screen, and a closer zoom would shorten what the player sees ahead. It still gets the trackside details, the speed lines and the vibration. Alternative: speed factor 0.95 → 0.6.
2. One option for all the effects, or one per effect? **One option, Speed effects**, plus per-camera sliders for widen and vibration. Separate On/Off options for each would make the start screen longer.
3. Should old saved camera values move to the new defaults? **Only values equal to the old defaults** (zK 1.0 / 0.4, Behind depth 2.6). Without this, anyone who ever saved camera settings, Petr included, would not see change 1. Alternative: keep every saved value and let the player press Reset to defaults.
4. Grass stripes: 6 m bands, or longer like real mowing (about 10–15 m)? **6 m**: shorter bands pass by more often, which gives more sense of speed. Real circuits often use wider bands.

## 11i. Bike drawing per camera (since 1.25.0)

Asked by Petr (2026-10-28, planning session): "Help to plan change to improve: 1. Graphics ... is 3D an option? leaning of the bike with rider on it. Overall look and feel of the bikes, make better look and feel on acceleration and braking. I can deliver required assets." Then: "Can you think about other ways how to improve graphics without going into 3D?" Then (2026-10-31), after the upright sprites were tried: "Recommend how to do it in old style and improve the looks, let's forget about sprites ... Can you perhaps prepare better graphics by making unique graphics for each camera?"

**Why**
- In Behind and CLOSE the bike is a top-down drawing seen through the tilted camera, so the road's perspective squashes it front to back: by 23 % in Behind (tilt 40°, cos 40° = 0.77) and by 43 % in CLOSE (tilt 55°, cos 55° = 0.57). In CLOSE it looks like a sticker on the road.
- The way the bike moves is right and stays as it is (see Movement below).

**Tried and dropped: upright rear-view sprites (2026-10-30 to 31)**
- The bike was drawn standing up on screen from rear-view images (first five rider poses per team, then one image for team 1), with lean as a rotation about the tyre contact point.
- It did not read as a turn: a rear view rolled by the lean looked like a hard turn at 300 km/h, where the bike turns about 400 m. A lean factor by speed (0.6 at 300 km/h) and a smaller roll with a heading skew did not fix it. The images are not used; the code is removed.

**What the player sees**

| Camera | Drawing |
|---|---|
| Top-down | The top view as in 1.24.0, refined: shading on the fairing and the rider, visible front and rear tyres, the inside knee and elbow when leaning. |
| Behind | A rear three-quarter view seen from above: more of the rider's back and the rear of the helmet, the tail section and the rear tyre. Stretched front to back to cancel the camera's squash. |
| CLOSE | A stronger rear three-quarter view: the rider's back and shoulders, the rear of the helmet, the tail light, a wide rear tyre. Stretched front to back to cancel the camera's squash. |

- All drawings are made by the game from the team colours and the race number, as in 1.24.0, so all 11 teams get them at once and no image files are needed.

**Movement (unchanged from 1.24.0)**
- The bike is painted on the road in world space and turns with its heading, so it always points where it goes.
- Lean as in 1.24.0 for the bike: the chassis narrows (0.72 + 0.28 × cos(lean)) and shifts by 0.16 × sin(lean). Sparks from 58°, brake light from brake 0.3 and 5 km/h, as now. The rider moves as in "Rider on the bike" below.

**Rider on the bike (since 1.25.0)**

**Why** (Petr, 2026-10-31: "way is rider is moving on the bike need to be improved")
- Until now the whole rider slides sideways as one piece, by 0.5 × sin(lean) of the sprite: boots, hips, back and helmet move together. At 40–60° the boots leave the pegs, the hips hang in the air beside the seat and the hands leave the handlebars, so the rider looks like he slides off the bike rather than hangs off it.
- Braking and accelerating do not show on the rider at all.

**Rule** (distances in sprite units, the bike is about 2 units long)
- **Hands and feet stay on the bike:** the hands stay on the grips and the boots on the pegs at every lean, braking and throttle.
- **Hang-off from the seat:** the hips move to the inside by 0.12 × sin(lean), the shoulders by 0.30 × sin(lean) and the helmet by 0.40 × sin(lean), so the body bends from the seat towards the inside of the bend instead of sliding. The helmet also moves forward by 0.05 × |sin(lean)| (the head looks into the bend).
- **Knees:** each leg is one piece, thigh from the hip to the knee and shin back to the peg. The inside knee goes out with lean, from nothing at 0.3 rad to 0.19 at 0.8 rad, far enough to clear the bent body, with a knee cap and the knee slider on it (from about 0.45 rad). The outside knee stays against the tank. (2026-10-31, Petr: the knee patch drawn beside the leg looked detached; it is now part of the leg.)
- **Arms:** drawn each frame from the shoulders to the grips: the inside elbow drops out, the outside arm reaches across the tank.
- **Braking** (by the brake value, 0–1): the rider sits up and back: shoulders and helmet 0.08 back, arms straight.
- **Accelerating** (by the throttle above 0.7): the rider tucks in: shoulders and helmet 0.06 forward, the back flatter and lower behind the screen. Full throttle on a straight shows a tucked rider.
- Smooth by itself: lean, brake and throttle already change smoothly, so the rider moves smoothly with them.
- The rider is drawn each frame from these parts instead of one cached image; the cached image is kept for a crashed rider. The separate knee and elbow patches are gone: the leg carries the knee, the arm drops the elbow out.
- In all three cameras, with each camera's drawing (top view, Behind, CLOSE).

**Tests**
- Unit tests (GDD 13b) for the new drawing functions (`riderPose`, `riderBend`, `riderAt`, `drawArm`, `drawRiderTop`, `drawRiderRear`): at lean 0.8 the helmet is further inside than the shoulders, the shoulders than the hips; hands and boots do not move with lean; braking moves the helmet back, full throttle forward.
- `bike_views`: lean still moves the rider to the inside in every camera, and the frame cost limit holds.


**Stretch rule**
- In Behind and CLOSE the drawing is stretched along the screen's up direction (the camera's forward direction on the road), around the bike's position, by 1 / (cos(tilt) × the perspective scale of the bike's screen row), using the tilt of the moment (it is lowered at speed, §11h). At most × 2.5 (near the horizon).
- The tilt alone squashes by cos(tilt) (Behind × 1.31, CLOSE × 1.74). The perspective squashes rows further up the screen more (implementation finding, 2026-10-31: with the tilt alone the Behind bike, 20 % above the bottom edge, still came out 9 % short and a 20° turn showed as 25°). So the player's bike is stretched × 1.50 in Behind and × 1.86 in CLOSE, and bikes further ahead more (CLOSE: × 2.46 at 20 m).
- The stretch follows the camera, not the bike, so a bike that turns still rotates on the road as before; only its proportions on screen are corrected.
- The shadow is stretched the same way, so it stays under the bike.
- Crashed bikes and riders, ghosts (§11c, at their ghost alpha) and other riders use the same drawing and stretch.

**Extras**
- A tighter shadow under the tyres, darker where the tyres touch.
- The brake light drawn on the tail of the drawing, glowing when braking (as now), instead of a dot behind the bike.

**Performance limit**
- Each drawing is made once per team, number and camera and cached, as in 1.24.0. The change adds at most **5 % to the frame time** at top speed on the 1470 × 830 reference screen, compared with 1.24.0.

**Tests**
- New `bike_views` browser test (the bike found on screen by the Viola Corse violet): in all three cameras the bike's on-screen length-to-width ratio is within 10 % of its drawing's own (the squash is cancelled; the drawings differ, so each is compared with itself), a bike turned 20° shows turned 20° ± 4°, and lean moves the rider to the inside. Behind is zoomed in for the test (zoom limit 30 px/m, base 12, near quality 1.5) to have enough pixels. Frame cost: drawing a 22-bike field in CLOSE takes at most 5 % of the frame (measured on a fresh page: reading pixels back slows Chrome's canvases).
- Unit tests (GDD 13b) for each new function: the per-camera drawings, the stretch and where it is applied.

**Clean-up from the upright sprite trial**
- Removed: the upright sprite drawing, the lean and speed rules for it, `tests/bike_upright.test.js`, and the `--allow-file-access-from-files` Chromium flag added to the 14 tests (the game loads no image files again).
- The image files in `assets/bikes/` and `assets/bikes-processed/` stay on disk, not committed. Delete them when no longer needed.

### Open questions for 1.25.0 (recommended answer in bold; the design above uses it)

1. Full or partial stretch? **Full (1 / cos(tilt))**, so the bike keeps its real top-view proportions. A real bike seen from 35° also shows its height, which would make it look even taller; full stretch is the closest a flat drawing gets. Alternative: half the correction, if × 1.74 looks too long.
2. Separate drawings for Behind and CLOSE, or one three-quarter drawing for both? **Separate**: CLOSE is lower and shows more of the rider's back. One shared drawing is cheaper and could be tried first if the difference is small.
3. Keep the image files in the repository? **No**: they are not used.
4. Rider: also show braking and accelerating, or only lean? **Both** (approved 2026-10-31): they were part of the first request ("better look and feel on acceleration and braking").
5. Hang-off amounts (hips 0.12, shoulders 0.30, helmet 0.40): **as proposed, then tuned by eye in the game** (approved 2026-10-31).

**Rider rig (proposed for 1.26.0, not yet approved; Petr 2026-11-02)**
- The rider is drawn from one upright picture (`assets/bike-parts/rider-rear-braking-upright.png`), split into parts. The joints are in `assets/bike-parts/upright-joints.txt`: neck, shoulders, elbows, wrists, hips, knees and ankles, left and right, in picture pixels (1920 × 1920, the rider's own left and right).
- The game draws each part and turns it about its joint. Lean, corner and braking come from joint angles, not from a blend between drawn poses. The arms, legs and head stay attached at every lean.
- Overlaps are in the same file: the helmet and arms are over the torso, the torso is over the thighs, and the shoulder pads and gloves are over the upper arms and sleeves. Knee pads and boots still to confirm.
- Per-lean poses are no longer drawn; the rig replaces the corner and limit pictures and the morph between them.
- Decided (Petr 2026-11-02): (1) the rider is split into pieces: torso, helmet, each upper arm, forearm, glove, thigh, shin and boot. (2) Knee pads sit on the outside of the knee, drawn over the thigh and shin; boots are drawn on top of the shin at the ankle. (3) Joint angles come from one formula, with lean in degrees: hips shift towards the inside by 0.3 × lean; shoulders by 0.5 × lean; neck and helmet by 0.4 × lean, so the head stays closer to level; the inside knee goes out by a fixed amount past about 20° of lean; elbows stay straight at speed and bend a little when braking.
- Draw order (2026-11-02, Petr: thighs first from above, shins under them): torso, helmet, shins, boots, thighs, upper arms, forearms, gloves. The render test is `shots/mannequin-layers-sweep.png` (placeholder rider, Blender).
- Placeholder (2026-11-02): the parts are procedural shapes in Blender (`scratchpad/rig/mannequin.py`) until a detailed rigged model is supplied.

**Bike and rider from pictures (2026-11-01, Petr; in progress)**
- The bike is one top-view picture (`assets/bike-parts/bike-top-only.png`), upright, no rider. It is used in all three cameras (Top-down, Behind and CLOSE). The rear view is dropped: Behind and CLOSE look forward at the corners ahead, so they need the top view too.
- The rider is four pictures, all from above: corner (`rider-top-corner.png`), limit (`rider-top-limit.png`), accelerating (`rider-rear-accelerating.png`, from above despite the name) and upright/braking (`rider-rear-braking-upright.png`, the same picture for both).
- Rider frame (2026-11-01): the frame moves towards its target at 110 frames a second, so changes read as movement, not a cut. Accelerating uses the upright picture (Petr: the forward accelerating pose did not look right); the rider changes pose only with lean (upright → corner at 40° → limit at 60°).
- Build (2026-11-01): `src/bike_art.js` holds the traced bike and the four rider poses (97 frames, 32 blended steps per pose change, Petr 2026-11-01: "even more smoothly", then "can you double the frames?") (upright, accelerating, corner, limit). The bike is drawn first, then the rider in the pose for the riding state: corner at 40° of lean (Petr 2026-11-01: "Corner pose should be there when lean exceed 40 degrees"), limit above 60°, accelerating at throttle above 0.7 and no braking, upright otherwise. Shown only in the "Traced" preview style. Colours are found by clustering the picture (k-means on its colours, then a majority filter on the label map), and each cluster is traced. This removed the broken-up shapes of the first trace. Still a preview style, not yet approved as the default.
- Matching: the rider pictures are at the bike's scale (1:1 in pixels; a helmet is about 240 px and the bike is about 950 px per metre). Each rider is moved by one shared offset, +5 px down (the first fit was +120 px; moved 40 px forward, then 15 px five times on 2026-11-01, Petr: "Move rider further on the bike. Little step" / "Almost, make tiny step further" / "Another step" / "another 15px please" / "Little further" / "One more"), so the hips sit about 115 px forward of the seat. The same offset is used for every pose, so the rider stays in the same place on the bike.
- Open: the head sits over the tank in the upright pose; check the new position after a ride.

**Traced bike and rider frames (superseded in part by the 2026-11-01 notes above)**
- Two sheets of posed riders, one from the top and one from behind (15 poses each), are traced into `src/bike_art.js`: 15 frames per camera, from upright (frame 0) to the full lean (frame 14).
- Each frame is the bike and the rider together, so the frame is the whole drawing. The frame is picked from the lean, up to 64°, and a left-hand bend is mirrored across the bike's centreline.
- The race number is drawn on the tail on top of the frame. Braking and throttle do not change the frame yet (the sheets have no braking or throttle poses).
- Assumption, to confirm: each sheet runs from upright to the full lean in order, left to right and top to bottom.
- Known issues: in the top view the leaned frames sit off-centre, and in Behind and CLOSE the rear frames look blocky at game size.

## 11j. Bike and rider realism (proposed, version set at Release)

Asked by Petr (2026-11-16): "improve graphics of motorbike, bike should be more sharp, animation should be real-a-like, etc... do your best job you can."

**Why**
- The traced bike (§11i, `src/bike_art.js`) is built from colour clusters, so its edges are stepped and soft at game size, next to the sharp road, kerbs and tyre marks.
- Only the rider moves. The bike itself has no suspension, no steering and no weight transfer, so braking and acceleration look like the bike slides on rails.

**Rule** (visual only: lean, path, speed, grip and every physics value stay as in §5 and §11i)

*Sharpness*
1. **Vector outlines, not cluster traces.** Each bike part (tank, fairing, seat, tail, tyres, fork, swingarm, exhaust, mirrors) is an outline of Bézier curves in sprite units, filled at device resolution. Edges stay crisp at any zoom, in all three cameras.
2. **Three tone bands and a highlight.** Each colour is drawn in light, base and shade, with a thin specular line on fairing and tank. The light comes from a fixed screen direction (upper left), so it does not change with heading.
3. **Detail lines at one device pixel:** seams between tank and fairing, number board edge, tyre sidewall, brake disc, exhaust outlet.
4. **Caches at device pixel ratio** (capped at 2×), made once per team, number and camera, as in §11i, so the 5 % frame limit still holds.

*Motion* (each input is a value the game already has)
5. **Suspension.** Under braking (brake 0–1) the front forks compress: the front end drops and the fork lowers by up to 4 % of bike length. Under throttle above 0.7 the rear squats by up to 3 %. Both follow the same smoothing as the rider pose (§11i), so rider and bike move together.
6. **Steering.** The front wheel turns into the bend by the steering angle the heading change implies (wheelbase × heading rate ÷ speed), capped at 25°. At 300 km/h it is only a degree or two, as in real life; at low speed (curve training, pit lane, gravel) it reads clearly. The handlebars and the rider's hands turn with it, so the grips move with the wheel.
7. **Front and rear wheel as separate cached pieces,** so the front wheel can turn and the fork can compress without redrawing the whole bike.
8. **Weight transfer shows on the chassis.** Under braking the front tyre shows a larger contact patch, and under acceleration the rear tyre does; the tyre shading changes with load (visual only).
9. **Kerbs and bumps.** The existing camera vibration (§11h) also bounces the bike's drawn chassis slightly, so the bike shares the shake the camera has.

*Not changed*
- No change to the physics, the lean value or the path. Visual lean does **not** lag the physics lean, because a drawn lag would make the bike look as if it does not follow its path (see the 1.24.0 lean rule).
- The rider rig (§11i) keeps its joint formula. Only the bars and the wheel are added to it.

**Tests**
- Unit tests (GDD 13b) for each new function: steering angle (zero on straights, sign follows the bend, capped at 25°), fork compression and rear squat (zero at rest, maximum at full brake or throttle, never past the stated limit), and the device-pixel cache key.
- `bike_views` browser test: front wheel turns more at 60 km/h than at 300 km/h, the bike outline stays inside the stated line width at 1× and 2× pixel ratios, and frame cost stays within 5 % of 1.24.0.

### Open questions for 11j (recommended answer in bold; the design above uses it)
1. **Where does the bike art come from?** Hand-set vector outlines drawn over the existing picture (no new files needed). Alternative: Petr supplies a sharper top and rear picture, and the outlines are traced from that. Petr offered assets on 2026-10-28, so either works.
2. **Steering amount:** the true angle, capped at 25°. Alternative: exaggerate it about 3× so the turn reads in the top view at speed. Real angle is the recommendation.
3. **Suspension amounts** (4 % fork, 3 % rear): **as proposed, then tuned by eye in game**, as the rider hang-off was in §11i.
4. **Wheel rotation** (tread and spokes turning with speed): **not in this version**. From above at speed it is hard to see, and it costs a redraw each frame. Reconsider if the bike still looks static in Behind.
5. **Counter-steer at turn-in** (the bars briefly turn the other way): **not in this version**. It would need a new rule for steering, which is more than a drawing change.
6. **Exhaust heat shimmer and smoke at full throttle:** **not in this version**; the existing spark and smoke effects stay.

**Built (2026-11-16, Petr approved the recommended answers):**
- Sprite cache 96 → 128 px a unit (`SPR`). Top-view tyres are no longer in the cache: `drawTyresTop` draws them each frame (the default, reference and art drawings; the styled presets keep their own tyres, `topTyresLive`).
- Steering (`steerAngle`, capped 25°): the front tyre turns about its centre by atan(wheelbase × heading rate ÷ speed), smoothed (0.08 s). Correction to the design text: at 300 km/h on a 400 m corner the true angle is about 0.2°, so the steer only reads at low speed.
- Suspension (`suspensionTargets`, `updateBikeMotion`): front tyre moves back by up to 0.08 units on braking, rear tyre forward by up to 0.06 units on squat (throttle above 0.7, not braking), smoothed 0.15 s and 0.2 s. Contact patches follow and widen by up to 30 %.
- State is kept per bike and moved by the real time since the last drawing (at most 0.1 s); a heading jump over 0.5 rad is not a turn.

**Not built (deviations from the approved answers, to decide):**
- Vector outlines (answer 1): not done. The default bike was already vector shapes; the gain so far is the higher cache resolution only. The traced preview styles are unchanged.
- Shading bands and detail lines (design item 2–3): not added.
- Rider hands following the bars (design item 6): not done; the bars are not drawn.
- Behind and CLOSE: steering and suspension are not shown (the front wheel is hidden behind the rider); only the Top-down view moves.
- Tests run: `npm run test:unit` 304 pass; `bike_views` browser test passes all 10 checks, frame cost 0.2 % in CLOSE (headless Chromium, 22 bikes), well under the 5 % limit.

## 11k. Bike graphics, next pass (proposed, version set at Release)

Asked by Petr (2026-11-16): "Improve graphics of the bike", after §11j, and "bike seems a bit too long".

**Why**
- In Behind and CLOSE the stretch from §11i (×1.50 and ×1.86 at the player's bike) cancels the camera squash on purpose. It makes the bike look longer than a viewer expects.
- The default drawing is still flat: one colour gradient and a few details. §11j left the vector outlines, shading bands and detail lines undone.

**Rule** (visual only: physics, lean, steering and suspension from §11j stay as they are; rider rig from §11i unchanged)

*Length*
1. **Shorter overhangs, full stretch kept.** The stretch stays the full §11i correction, so turn angles stay right. Half the stretch was tried first and failed: a 20° turn showed as 28° in Behind and 38° in CLOSE. Instead the whole drawing is scaled 0.92 along the bike (`BIKE_SHORT`): nose, tail, seat, number and rider move in with it, while the wheel centres stay where they are, so the wheelbase (1.45 m) and steering are unchanged. The tyres are 0.42 long instead of 0.62. Measured length: 1.81 units, down from 2.04 (about 11 % shorter).

*Look*
2. **Hand-set vector outlines** for the default body in all three drawings (Bézier curves, as the top view's fairing already is), so edges stay crisp at device pixel ratio.
3. **Shading and highlights:** the tank and fairing get three tone bands and a thin specular line, lit from a fixed screen direction; the tyre sidewalls get a light edge.
4. **Detail lines at one device pixel:** seam between tank and fairing, number board edge, fork legs (drawn with the front tyre, so they turn with it), brake disc, exhaust outlet.

*Not changed*
- Team livery and race number, and the bike's size in the world. No new image files.

**Tests**
- Unit tests (GDD 13b) for each new function (the half-stretch factor, the detail-line drawing).
- `bike_views` browser test: the "on-screen proportions" check now expects the half stretch instead of the full one; the other checks stay. Frame cost stays within 5 %.

### Open questions for 11k (recommended answer in bold; the design above uses it)
1. **Length:** **shorter overhangs, full stretch** (built, see item 1 above). Half the stretch was dropped after the test showed turn angles distorted; the approved recommended answer was changed by Petr on 2026-11-16 after that finding.
2. **Detail level:** **moderate** (items 2 to 4 as above). A full redraw of the bike is a separate, larger job.

**Built (2026-11-16):** the seam between tank and seat and the tyre sidewall edge (item 4); the shade band down the far flank and a thin specular line on the lit flank (item 3). The light is fixed to the bike, not to the screen, because the drawing is cached once per team, number and camera. Outline (item 2): the top-view body follows a silhouette traced from the reference picture (`assets/bike-parts/bike-top-only.png`, the bars, wheels and pipe left out) as 52 smooth Bézier segments (`BIKE_BODY_TOP`), in the existing body box. The tail is a little fuller than before. The rear (Behind and CLOSE) body still has its hand-set outline. Tests: `npm run test:unit` 304 pass; `bike_views` 10 of 10.

## 11l. 3D bike and rider (new, not released)

**Merge note (2026-11-17):** the pre-rendered sprites described first in this section were replaced by the real-time 3D below (11l-b) and removed when `dev`'s new 2D drawing (11i–11k) came in: that drawing is now the Classic fallback.

**Status:** approved (2026-11-16) and built on branch `feature/bike-3d-sprites`. Not released yet: the version is set at release (GDD 14).

**Goal:** draw the bikes and riders from the Blender models in `models/` instead of the procedural 2D drawing, so they look more like real machines. Physics, handling, AI, sound and the track don't change.

**Approach (pre-rendered sprites, not live 3D):** the game stays a canvas 2D game. `tools/render_bike_sprites.py` renders the bike offline, and the result is stored in `src/bike3d.js` (generated, not edited by hand). No 3D engine is added.

- **What is rendered:** two top-down transparent sprites per team, at the game's size (2.5 m × 1.3 m, 48 px per metre, rendered at 4×): the **chassis** (the bike with no rider) and the **rider** (the rider on the same position). These replace the two layers the game already draws, so the lean code is unchanged: the rider layer still moves by `sin(lean)` and the chassis is still squashed by `cos(lean)`.
- **Change from the first proposal:** the first design proposed a rear-view strip of rider poses for lean. The game draws the bike top-down, so the strip was not used. Only the upright rider pose is built now. The accelerating and max-lean poses stay in the model files for a later step.
- **Team colours:** each team's fictional colours (the same `TEAMS` list), not the source livery. Bodywork (Parts 1, 3, 4, 9) takes colour 1, the screen (Part 2) takes colour 2, the rest is dark. The source's real sponsor marks are not drawn.
- **Rider suit:** near white (`RIDER_SUIT`), so the rider stands out from the team bodywork and the tarmac.
- **Race number:** drawn by the game on the tail (`drawBikeNumber`), since the rendered chassis has no number.
- **Setting:** Menu → **Bike graphics: 3D / Classic** (default 3D, saved with the other options). Classic keeps the procedural drawing. While the images have not loaded, the classic drawing is used.
- **Regenerating:** `/Applications/Blender.app/Contents/MacOS/Blender -b "<rigged scene>.blend" -P tools/render_bike_sprites.py -- --out <dir> --js src/bike3d.js`, then `python3 tools/build.py`.

**Known limits:**
- The rider model is the MakeHuman body as it stands; pose and suit fine-tuning is a later re-render, not a code change.
- The file is about 1.4 MB, because each sprite is embedded as base64 PNG so the page still opens from disk.

**Decisions (recommended answer in bold; the build uses these):**
1. Live 3D in the browser or pre-rendered sprites? **Pre-rendered sprites**.
2. Keep the procedural sprites as a fallback? **Yes**: the "Bike graphics" setting, and the classic drawing until the images load.
3. Livery? **Fictional team colours**, not the Ducati Lenovo livery (GDD 15).
4. Rider model? **MakeHuman body as it is**; fine tuning later.
5. Rendering size? **Game size at 4×** (changed from 2× after the CLOSE camera was soft; 11l-b option A).

**Test plan:** unit tests for `bike3DImg`, `useBike3D`, `bikeLayer` and `drawBikeNumber` (GDD 13b). The team count in the generated file must match `TEAMS`.

**Out of scope for this step:** physics, handling, AI, sound, the track, and the rider's fine tuning.

### 11l-b. Real-time 3D bikes (three.js)

**Why:** the pre-rendered sprites are soft at close range (the CLOSE camera enlarges a 240 px sprite), and they are flat top-down images with no shading or depth.

**Option A, quick (sharper sprites):** render at 4× game size instead of 2×. Keeps the current design; file size grows about 3× (to about 1.4 MB). Low effort.

**Option B, real-time 3D (recommended if sharpness matters):**
- Add a WebGL layer (three.js, inlined into `index.html` so the page still opens from disk) that draws the bikes and riders in 3D on top of the current canvas.
- Use the game's own camera (tilt, height, zoom, lean) for the 3D camera, so the bikes stay locked to the track.
- Export the bike and rider from Blender as a low-poly glTF (about 20–30k triangles in total) with one 1024 px atlas per team, stored in the page as base64.
- Lean is a real rotation of the 3D rider and bike. The 2D layers stay as the Classic fallback.

**Costs and risks:**
- The file grows by roughly 1–2 MB, and the first load takes longer on phones.
- Phones and low-end machines need a fallback (the Classic setting already covers this).
- The camera code is 2D-projected today, so the 3D camera must match it closely, or bikes will drift off the track.
- Several days of work and new browser tests.

**Decision (2026-11-16):** B, real-time 3D, on this branch. A was built first and is not enough.

**Feasibility checked:** the tilted view is a plain perspective: `worldToScreen` is the CSS `perspective(P) rotateX(a)` projection about the canvas bottom centre (`src/render.js`). A three.js camera with the same focal length `P`, tilt `a` and origin can therefore draw the bikes exactly where the 2D code would put them. Lean and height follow from the same rotation.

**Plan, in milestones (each checked in the browser before the next):**
1. Vendor three.js (MIT licence) as `src/vendor/three.min.js`, inlined by `tools/build.py`. Check the page still opens from disk.
2. Overlay WebGL canvas above the game canvas, below the HUD. Match the camera to `worldToScreen`, and draw one bike at a fixed track point. Check that it lines up with the 2D track.
3. Export decimated glTF meshes from Blender (about 20–30k triangles in total): bike and rider, flat team colours set at runtime, so no texture atlas is needed.
4. Drive the 3D bike from the existing state: position, heading, lean, wheelie, crash. Keep the 2D sprites as the Classic fallback.
5. Tests and a browser check on all cameras; the unit tests keep the same function coverage.

**Status (2026-11-16):** steps 1 and 2 are done on this branch.
- Step 1: three.js r187 vendored as `src/vendor/three.min.js` (533 KB minified, MIT, only the classes used; see `src/vendor/README.md`).
- Step 2: the bikes are drawn in 3D into a transparent WebGL canvas, and that canvas is composited after the road warp and the speed blur, so the bikes sit in the same scene as the road and are not blurred by speed. Scenery is drawn before the bikes, as today, so a tree or kerb never covers a bike; that matches the 2D behaviour.
- Alignment: the 3D projection reproduces `worldToScreen` to within 0.01 px (unit test). In the CLOSE camera the 3D box lines up with the Classic sprite in both x and y.
- Still placeholder: a box per bike. Crashed and retired bikes stay 2D. Top-down camera stays 2D.

**Step 3 done (2026-11-16):** the real bike and rider replace the placeholder box. `tools/export_bike_models.py` exports the debranded scene (rider in its posed state) as four indexed meshes by role (body, screen, dark, rider), about 16k triangles in total, into `src/bike3dmodel.js`. The game builds the geometry once and colours each role per team at runtime (`gl3DColour`), with Lambert lighting. The format is base64 arrays, not glTF, so no loader is needed.

**Step 3 fix (2026-11-17):** the rider is drawn on the player's bike only. Other bikes show the chassis, as riders are not separated visually from the bike at race distance.

**Model and colour changes (2026-11-17):**
- The rear stand is cut from the exported model (the triangles at the rear, low and near the ground, from `Part10`). A thin strut near the axle remains.
- The rider is drawn in the team's second colour, so the rider reads apart from the bodywork. For some teams that colour is dark.
- A tail light is added to every bike: a small box at the rear, lit red while braking (`b.ctl.brk` > 0.3 and speed above 5 m/s, the same rule as the 2D brake glow).
- Materials: gloss on the bodywork, glass on the screen, satin on the rider, matte tyres. A fill light is added.

**Performance levels (2026-11-17, final):** `--bike-scale 0.1 --rider-scale 0.5`. The bike is at 10% for every bike (about 8,200 triangles each, about 170,000 for 21 AI bikes); the player's rider is at 50% (about 26,800). The player's bike is about 35,000 in total. Full detail was tried for AI bikes (about 52,000 each) and reverted for frame-rate reasons. Not yet measured on a device.

**Team designs and rider kit (2026-11-17, suits revised the same day):** each team has a suit, a helmet and an accent colour (`src/core.js`, `TEAMS`: `suit`, `helmet`, `accent`). The suit contrasts with the bike, so the rider reads apart from it; the accent is the suit's bands. The first version had the columns swapped, so most suits had the bike's colour. The 2D sprites and the bodywork colours are unchanged.

| Team | Name idea | Bike | Suit | Bands (accent) | Helmet |
|---|---|---|---|---|---|
| Rosso Veloce Factory | fast red | red | white | red | red |
| Blu Tridente Racing | blue, trident | blue | silver | blue | navy |
| Arancia Tech | orange, tech | orange | charcoal | orange | orange |
| Lime Works | lime, works | lime | black | lime | lime |
| Nero Opaco | matt black | black | gold | black | black |
| Celeste Squadra | sky blue | sky | white | sky | sky |
| Viola Corse | violet, racing | violet | lime | violet | violet |
| Argento Factory | silver | silver | red | silver | silver |
| Giallo Moto | yellow | yellow | blue | yellow | yellow |
| Bianco Sport | white, Italian | white | green | red | white |
| Cobalt Satellite | cobalt, space | cobalt | pink | cobalt | cobalt |

- **Rider (player only):** skin (head, neck, hands) in tan; a suit that sits 15 mm off the body (`SUIT_OFFSET`), so the body does not show through; a helmet at the head joint, with a dark visor on the front. Built by `tools/export_bike_models.py`.
- **Suit pattern (2026-11-17):** two bands in the team's accent colour, one at the waist and one across the thighs, plus the arm bands where they cross the band heights. Built as a separate `stripe` role, so the shared suit geometry is unchanged. A chest band is not in yet, since the band rule sits at the waist.
- **Not yet:** the helmet is a single colour (no top stripe), and the pit-lane render (tools/build_pitlane_scene.py) still shows plain suits.
- **Check:** the mesh view of team 2 only. Other teams are checked by the colour tests, not by eye.

**Rider poses (2026-11-17, approved on renders before baking):** the pose is one module, `tools/rider_pose.py`, used by the pose renders (`tools/render_rider_poses.py`, sheet in `shots/poses/v6/`) and the exporter, so the game gets exactly the approved poses.
- **Tuck at every lean:** the upper body pitches forward 0.8 rad so the helmet sits behind the windscreen (the jaw is level with the screen top, about 1.0 m), and the head tilts back 70% of that to look ahead.
- **Hang-off,** complete by 35° of lean and held from there (`HANG_FULL`; it was scaled to 64°, which left the rider barely off the seat at the usual 20–30° and looked like no movement): the bottom slides 0.22 m off the seat to the inside and drops 5 cm; the hips and the upper body roll about 11° further into the turn; the chest turns toward the inside; the head rolls back toward level.
- **Inside knee:** points out toward the road, but stays at least 15 cm above the road once the bike leans (found by search on its IK pole), so it never drops below the bike.
- **Outside knee:** rests against the side of the tank, 7 cm off its surface (found by search against the bike's mesh), so it never passes into or across the tank.
- **Hands (fixed 2026-11-17):** the hands hold the grips at every lean, within 3 mm. The old grip targets floated in the air 26–30 cm out and 7 cm above the bars, and the IK fell short. Now: the grips are measured from the bike's mesh (0.41 m forward, ±0.29 m, 0.79 m up); the hand is measured from MakeHuman's hidden joint markers (the ForeArm bone ends about 10 cm short of the real wrist, and the hand points about 47° off the forearm, so the bone can't be used); each pose moves the wrist's IK target, in damped steps, until the knuckles sit 25 mm over the grip (`fit_hands`); the arm bones may stretch a little (`ARM_STRETCH` 0.25) so the outside arm reaches at full lean; and the exporter curls the fingers 110° round the knuckle line, toward the grip (`curl_fingers`). Taking the clavicle into the IK chain was tried and dropped: the solver swung the arm out sideways.
- **Feet:** the IK keeps them on the pegs.
- **In the game:** baked at 0 (the base mesh), ±20, ±40 and ±64 degrees as morph targets on the rider, suit, stripe, helmet and visor; the game blends the two poses either side of the lean (`gl3DPoseWeights`). The helmet follows the head bone's transform. Source: `Ducati rider debranded without stand.blend` (the paddock stand, `Part10`, removed by Petr; the exporter's stand cut is gone with it). The page is about 4.2 MB.

**Race helmet (2026-11-17, remodelled from five reference views):** `tools/helmet.py`, checked with `tools/render_helmet.py` against `models/reference/helmet-ref-{side-right,side-left,front,rear,top}.png` and `helmet-reference.png` (`shots/helmet3/compare2.png`). The references are a real branded helmet: only the shape and features are taken, no logos or text, and the paint is in team colours (GDD 15).
- **Shell** (team helmet colour): a superellipsoid (exponent 2.4, boxier than an egg), longer at the back with a low flat crown, a chin bar, a curved neck line, the intake scoop on the brow, a low rear spoiler that lifts off the top of the back, a diagonal ridge on each side from the spoiler's end down to the cheek, and a raised pad low on each side at the back.
- **Dark parts** (`visor`): a tall visor wrapping about 80° round each side, its gasket and the black plate behind each end, the black rubber trim right round the neck line, the intake's slot, the chin's V vent, three slanted slots on each side of the chin and two exhaust slots under the spoiler.
- **Trim** (team suit colour): a raised panel down the centre of the top, from the scoop to the spoiler.
- About 16,800 triangles; it follows the head bone in every pose. Still softer than the reference: the shell has no sharp creases.

**Known limits after step 3:** the surface looks grainy in the CLOSE camera (to check: normals of the decimated mesh, and the directional light). The white rider covers most of the bike from above. The page is about 3 MB.

**Step 4, partly done (2026-11-17):** lean drives the 3D bike: it rolls about its forward axis through the contact point. Positive lean is a right turn (core.js), and the bike rolls to its right. Checked in the browser at +0.5 and -0.5 rad (the first version had the sign inverted, fixed 2026-11-17). Pitch done (2026-11-17, from load transfer): the bike pitches from the longitudinal acceleration `b.aLong`. Acceleration lifts the nose and braking dips it, by θ = m·a·h / K, where K = Σ k·d² is the pitch stiffness over the springs: fork 9 kN/m per leg at 0.71 m, rear wheel rate 40 kN/m at 0.76 m (K ≈ 32 kN·m/rad), and h = 0.5 m. At 1 g that is about 2°. Checked online (fork rate, centre of mass height and weight split); the rear rate is an assumption. The rear axle (0.65 m behind the centre, estimated) stays on the road. The earlier wheelie lift is replaced: it was a fixed angle on the wheelie value, not physics.

## 11m. Lean at speed (new, not released)

**Problem (2026-11-17):** the assist leaned the bike 53° at 314 km/h on a straight, because the path to the next corner (Stowe, 180 m ahead) needed that lean. Only grip limited the lean, so the bike could lean the same at any speed.

**Done:** the most a bike leans now depends on speed (`maxLeanAt`, `src/core.js`), to either side (max and min lean are equal). It is 0 when stopped (a bike cannot hold a lean at standstill, the bug fixed 2026-11-17), rises to the grip maximum by about 50 km/h, stays there to 150 km/h, and falls linearly to 40° at 300 km/h. The assist's grip limit is kept as well.

**Not done:** the lookahead. The lean target is pure pursuit toward a point about `6 + 0.42·v` metres ahead on the racing line. A shorter lookahead gives a *larger* angle for the same lateral offset, so it would lean harder, not less. The right fix takes the lean from the path curvature, not the steering angle. That changes the racing line and lap times, so it needs a separate decision and a lap-time check.

**Rider mass (2026-11-17):** 67 kg (was 70 kg), the middle of the 63–70 kg range of the MotoGP grid, from the 2025 rider quotes and grid data (Motor Sport, motorsport.com). The bike minimum is 157 kg, so the total moves from 227 to 224 kg. The roll rate limits do not depend on mass in this model (see the note below).

**Roll rate (2026-11-17, rebuilt from physics with rider mass):** the lean moves toward its target at the slower of two limits.
- **Rider:** the rider shifts their mass sideways at a limited speed `u` (fitted: 2.54 m/s). The bike rolls by the momentum transferred, `w = m_r·u·h_r / (m_b·h_b² + m_r·h_r²)`, with h_b = 0.5 m and h_r = 1.0 m. A 67 kg rider gives 1.6 rad/s; 80 kg gives about 1.70, 55 kg about 1.48.
- **Damping:** the spinning wheels resist rolling, `300 km/h / v` (fitted to 1.0 rad/s at 300 km/h; a derivation needs the wheel inertia and tyre grip).
Below about 190 km/h the rider limits; above it the damping does. A 40 km/h swing takes about 1.2 s.

**Autopilot fix (2026-11-17):** the slower roll rate (`leanRate`) made the autopilot run wide. Its look-ahead (6 + 0.42·v m) was shorter than the distance a bike needs to roll into a corner, so at about 140 km/h it chased a 7 m offset with a 62° lean target, could not roll that fast, and ran onto the gravel. The look-ahead is now 6 + 0.7·v m. Headless, a minute of practice laps goes clean (no crash, 1.4 m RMS offset over 240 s, against 0.8 m before the slower roll), and the camera test passes on both runs. Tried and rejected: a lower steering gain (runs 25 m wide), a lead term on the lean target (no effect), and feedforward from the track curvature (worse).

**Test:** unit tests for `maxLeanAt` and `leanRate` (GDD 13b), and physics tests that step `stepBike` and check the lean itself: the per-step change never exceeds the roll rate, a 40 km/h swing takes about 1.2 s, a 300 km/h swing about 0.8 s, and the lean stays at 40° at 300 km/h but can pass 50° at low speed. The lean cap was not reproduced in a headless run, because the scenario needs a braking corner ahead.

## 11n. Frame rate (new, not released)

Asked by Petr (2026-11-18): the game is not smooth since the 3D bikes (1.26.0); plan to double the frame rate.

**Step 1, measure:** a frame-time overlay, toggled with **P** during a session. Averaged over the last 30 frames it shows the frame rate and the time per frame, split into: physics (`simStep`), camera, 2D world (the road layers), projection and speed blur, 3D bikes (placing the meshes and the three.js render call), and HUD. It also shows how many bikes are drawn in 3D, the canvas size and the pixel ratio. Browsers run GPU work in the background, so the 3D time is the CPU side only. The overlay is off by default and costs nothing when off.
**Result (Petr, 2026-11-18):** Safari runs at 60 fps and is smooth; Brave (Chrome) runs at 33 fps.
**Step 3, done first:** the 3D bikes are on their own canvas layer (`#gl3d`), above the game canvas and below the HUD, shown only while 3D bikes are drawn. Before, the 3D canvas was copied into the game canvas with `drawImage` every frame; in Chrome that copy makes the 2D canvas wait for the GPU. The picture is the same: the bikes were already drawn after the road warp and the speed blur, and screen shake never moved them.
**Result:** Brave still 30 fps, with the game's own work at about 2 ms of a 28 ms frame; Energy Saver off and hardware acceleration on changed nothing. Suspect: the road projection draws one `drawImage` strip per screen row (about 1,000 per frame), which Chrome runs on the GPU after the timer stops.
**Test switches** (while the overlay is shown): **8** draws the road strips 1, 2, 4 or 8 device rows tall; **9** switches the 3D bikes off and on. Both are for measuring only and reset on reload.
**Result:** 2-row strips bring Brave from 30 to 60 fps. 2 rows by default fails the seam check (bends 0.57–0.65 px, limit 0.5), so it is the first step of the slow-machine quality drop instead (§11a): after about 60 slow frames the road switches to 2-row strips, before the pixel and resolution steps. Safari keeps 1-row strips.

**Next steps (proposed, decided from the measurements):**
2. Skip 3D bikes that are off screen (the same visibility test as the 2D bikes).
3. ~~Show the 3D canvas as its own layer~~ (done, above).
4. Cheaper rendering: no MSAA, single-sided materials, the 3D canvas at 1× on high-DPI screens.
5. A low-detail bike (about 1,500–2,000 triangles) for bikes that are small on screen.

## 11o. 3D track and scenery (approved 2026-11-19, phases 1 to 5 built, not released)

Asked by Petr (2026-11-19): the track should be 3D, with trees and other objects around it, to make the bike feel really fast.

**Where we are:** everything except the bikes is flat paint. The ground (road, kerbs, grass, gravel, walls, trees, grandstands, buildings) is drawn top-down into 2D canvases and warped onto the screen with the tilted-camera projection (§11a). Trees and grandstands are pictures lying on the grass, so nothing passes the camera at height. The strongest cue for speed is parallax: tall things close to the track rushing past faster than the ground under them. That is what is missing.

**Approach:** move the world into the three.js scene the bikes already use (§11l), with the same camera (`gl3DProjection`), one phase at a time. Each phase is a separate feature branch, ends playable, and is released on its own. Physics, the track data, the AI and the Top-down camera do not change: the 3D is drawing only. Classic graphics and Top-down keep today's 2D world.

**Rules for every phase**
- 60 fps in Safari and Brave on Petr's MacBook at 1470×830 @2× in CLOSE, with 22 bikes; the P overlay (§11n) gets a line per new part.
- Objects are built in code from simple shapes (low-poly boxes, cylinders, cones, flat cards) with no external files, so the game stays one HTML file. Many copies of one object are one draw call (three.js `InstancedMesh`).
- Things far away or behind the camera are not drawn. Small far things switch to a cheaper version (level of detail).
- Every new function gets its unit test (§13b); each phase adds browser checks to `tests/track3d.test.js`.

**Phase 1: the ground in 3D (foundation, looks the same).**
- The ground is one large plane in the 3D scene, textured with today's baked ground canvases (the near and far bands, §11a). The GPU does the perspective, so the 1,000 strips per frame of `projectTilted` go away. That is the cost behind Brave's 30 fps (§11n), and it removes the 0.6 px bends of the 2-row fallback in every browser.
- The 3D bikes and the ground are in one canvas and one depth buffer, so a bike can later pass behind a tree or a grandstand.
- Speed blur (§11f) moves with it: the same three zoomed copies, done in a final shader pass, with the road and bikes cut out as now.
- Done when: the tilt seam, camera and speed blur checks still pass; the picture matches today's within 2 px; Brave runs at 60 fps with the sharp road.
- **Built (`src/track3d.js`):**
  - The ground bands are drawn as three textured quads in their own three.js scene, before the bikes, on the 3D canvas (`#gl3d`, §11n): the near band, the far band where it fades in over the top `hB` of the near band (alpha 0 to 1, as `projectTilted`), and the rest of the far band. A ground-canvas point `(cx, cy)` sits at `(cx − RW/2, (cy − RH)·cos a, (cy − RH)·sin a)` in the frame of `gl3DProjection`, so it lands exactly where `worldToScreen` puts it. The band canvases are uploaded as textures each frame (they are redrawn each frame anyway).
  - The sky (gradient and haze) stays on the 2D game canvas, under the 3D canvas; `projectTilted` is not called.
  - Speed blur: the ground is drawn into a 1/2-resolution image; a shader zooms it about the horizon point from 1 to 1 + k times in 8 equal steps into a 1/4-resolution image, with the road and bikes cut out (a 1/4-resolution mask canvas); a last pass lays that over the screen at the blur strength, one sample per pixel. Same strength curve, horizon point and cut-out as §11f. 8 steps instead of 3 copies: the GPU samples without averaging, so 3 copies showed as 3 separate images. The sky is not in the blur image, so it is not hazed over. Cost in headless Chromium (software WebGL, GPU included): +12 % of the world drawing, limit 15 %.
  - Browser tests that read the screen now read the game canvas with the 3D canvas over it, in the same frame (`screenX()` test hook; the sky check of `camera_tuning`, `speed_blur`), and the frame-cost checks wait for the 3D canvas too.
  - Used when the 3D bikes are (3D graphics, tilted camera, WebGL). Classic graphics, Top-down and machines without WebGL keep the 2D projection, with the 2-row strip step for slow machines (§11n).
  - Tests: `tilt_seam.test.js` runs every case also through the 3D ground (bends 0.29–0.35 px, limit 0.5; sharpness step at most 10 %, limit 15 %); unit tests in `tests/unit/track3d.test.js`.

**Phase 2: walls, barriers and fences with height.**
- Concrete walls and Armco barriers on today's wall line, about 1 m high; tyre walls on the outside of the fastest corners (Copse, Maggotts, Stowe, Club, Abbey).
- Debris fence on top of the walls: posts every 3 m, about 3 m tall, with a see-through mesh. Posts every few metres are the main speed cue: at 300 km/h about 28 of them pass each second.
- Kerbs get a few centimetres of height and a sloped edge, so they catch the light.
- Done when: walls follow the track edge checks of `track_edges.test.js` (no square ends, no jumps), and no wall or fence crosses the road or the pit lane.
- **Design (approved 2026-11-20, built, `src/scenery3d.js`):**
  - **Where:** on today's wall line `T.WALL` (both sides, the garage frontage left open as now), plus the pit wall (`PIT.wallD`, beside the flat pit lane). The line already keeps clear of the road, the run-off and the pit lane, and has no square steps (§1.11.4), so the 3D walls inherit that.
  - **Heights are scaled like the bikes:** the bikes are drawn 1.35× real size (`PHYS.VS`), so heights are 1.35× too, or a 1 m wall would look knee-high next to a rider. Real values below; footprint on the ground stays real.
  - **Concrete wall** (default): 1.0 m high, 0.5 m thick, grey with a light top edge, painted in 6 m blue and white blocks on the track face (as the flat wall today).
  - **Armco** where the wall stands far back (more than 20 m from the track edge): two steel rails at 0.45 and 0.75 m on posts every 4 m. Lower and see-through, so the land behind still shows.
  - **Tyre walls** on the outside of Copse, Maggotts, Stowe, Club and Abbey (from 60 m before to 60 m after each corner): 1.0 m of stacked black tyres with a coloured belt (red and white blocks) in front of the concrete.
  - **Debris fence** on top of concrete and tyre walls and the pit wall: posts every **4 m** (not 3 m) up to 3.0 m above the ground, a top rail, and a see-through dark mesh between wall and rail (about 25 % cover). 4 m because at 330 km/h a bike moves 1.5 m per frame at 60 fps: with posts 3 m apart that is half the spacing, where the eye can read posts as standing still or going backwards (the wagon-wheel effect); at 4 m it stays well under half. That still gives 21 posts a second at 300 km/h.
  - **Built once, moved by one matrix:** all walls, rails, tyres and fence panels are built once in world metres when the track is loaded; posts are one `InstancedMesh`. Each frame they get one matrix from world metres to the camera frame (the same affine map as `gl3DPlanePoint`), so the CPU cost per frame does not grow with the number of posts. Split into pieces of about 250 m; a piece is drawn only if it reaches into the ground area on screen.
  - **One depth buffer with the bikes:** they are in the bikes' scene, lit by the same sun, so a bike can pass behind a wall and the walls hide each other correctly.
  - **Far edge:** the ground ends at the far band's edge (§11a), so walls fade into the haze colour over the last 40 % of the ground depth (fog) and are cut at the ground's far edge and sides; nothing stands in the sky.
  - **Speed blur:** the walls and fences go into the blur image with the ground (§11o phase 1), so they smear at top speed like the land, and the road and bikes stay sharp.
  - **The flat walls go:** while the 3D walls are on, the ground tiles leave out the flat wall and fence lines and draw a soft contact shadow at the wall foot instead, so the walls sit on the ground. Switching (Classic, Top-down, no WebGL) rebuilds the tiles with the flat walls.
  - **Kerbs: no height (changed from the plan).** A few centimetres are 1 px or less from the CLOSE camera, so it would cost work and frame time for nothing visible.
  - P overlay: a "3D walls" line (pieces drawn, ms). Test switch **7**: 3D walls on/off.
  - Tests: unit tests for each function; `tests/track3d.test.js` (new browser test): over the whole lap no wall, rail, tyre or post point is on the road, the kerbs, the run-off or the pit lane (`T.surface`); walls change by at most 1.5 m between neighbouring points (as `track_edges`); with walls on, the screen at the start/finish and Hangar Straight has pixels above the ground line that the walls drew (they stand up); frame cost of the walls under 15 % of the world drawing.
  - **Built, results:** 24 pieces, about 58,000 triangles and 2,900 posts over the lap; 2–3 pieces are drawn at a time. Where the wall line would stand in another part of the circuit's run-off or gravel (where two parts come close, about 80 m in all), the barrier leaves a gap; the flat walls were drawn through there. The pit wall stands on the strip between the track and the pit lane, as the flat one did. Frame cost in headless Chromium: +3 % of the world drawing (limit 15 %). The 3D seam checks of `tilt_seam` measure the ground with the walls off (they stand over its test pattern).

**Phase 3: trees, grandstands, buildings.**
- Trees as real 3D objects (trunk plus 2–3 leaf cones or a rounded crown), 3–5 types, up to about 3,000, in groups behind the run-off as now. Far trees become flat cards that always face the camera.
- A tree line on the horizon, as a strip of cards, so the land does not end in haze.
- Grandstands as stepped blocks with a crowd texture and a roof; the Wing pit building and garages as boxes with the team doors (today's layout in `SCN`).
- Done when: no object stands on the road, the run-off, the gravel or the pit lane (checked over the whole lap); 60 fps with all of it in view at Abbey and Club.
- **Design (approved 2026-11-20, built, `src/estate3d.js`):** the scenery that is already laid out in `SCN` (§12) stands up; nothing moves.
  - **Trees:** the 1,493 trees of `SCN.trees` (crown radius 2.5–7.5 m) become low-poly 3D trees in 4 types, picked from each tree's variant: round broadleaf (faceted ball crown), wide broadleaf (two overlapping balls), conifer (three stacked cones), poplar (tall narrow crown). Trunk 0.3–0.6 m. Height from the crown size: 1.6 × radius + 2 m, so 6–14 m (scaled 1.35× like the bikes). Leaf colour varies a little per tree (instance colours). One `InstancedMesh` per type for the whole estate: 4 draws in all.
  - **No flat-card level of detail (changed from the plan):** with 1,500 trees at 40–80 triangles each the GPU draws about 90,000 triangles of trees, cheap enough that cards would add work and popping for nothing. If Safari or Brave says otherwise, cards come back.
  - **Tree line on the horizon:** a strip of tree silhouettes standing on the far edge of the ground, tinted towards the haze, which turns with the camera (it is far away, so it does not slide sideways). The land then ends in a tree line, not in fog. (Taken out in phase 5, open sky: it read as a bar.)
  - **Grandstands** (10, at the classic viewing spots): stepped blocks rising from 1 m at the front (the track side) to 8 m at the back in 8 tiers, a crowd texture on the tiers (coloured dots, drawn once), a white back wall, and a roof on pillars at 12 m.
  - **The Wing:** the garage block along the pit lane, 6 m high, dark grey with the 22 team-coloured garage doors (4 m high, by box), and behind it the office block to 11 m under a white roof slab with a blue edge that rises towards the back. The pit boxes painted on the ground stay as they are.
  - **Paddock buildings** (56 team units): white boxes 3.5 m high with the team colour band.
  - **The flat drawings leave the ground tiles** while 3D scenery is on (tree crowns, stands, buildings, the Wing roof); the soft tree shadows stay on the ground so the trees sit on it. Test switch 7 still covers all 3D scenery.
  - **Placement:** the layout already keeps clear of the track (`trackClear`), the pit compound and the stands. New rule: a tree that would touch a marshal post, a camera tower or a gantry pillar (phase 4) is left out.
  - **Could hide the bike:** a tall tree on the inside of a tight corner can stand between the camera (28 m up, about 45 m behind) and the bike for a moment. I will watch for it at the tight corners (the Loop, Vale, Club) and lower or drop trees there if it happens.
  - Tests: unit tests for each function; the whole-lap placement check covers trunks, stands and buildings; `tests/track3d.test.js`: a tree stands up (its crown above its shadow), a grandstand shows its crowd, the Wing's doors show in the team colours, the tree line is on the horizon; frame cost of all 3D scenery at Abbey and at Club under 15 % (headless), and the fps check in Safari and Brave by Petr.
  - **Built, results:** all 1,493 trees (none had to give way to a phase 4 object), 10 grandstands, 56 paddock units and the Wing, about 55,000 triangles. The estate is cut into 39 cells of 300 m and only the cells reaching into the ground area are drawn: drawing all of it every frame cost +16 % at Abbey and +22 % at Club in headless Chromium; with the cells +8 % at both (walls, trackside and estate together; limit 15 %). Speed feel at the screen edges with all 3D scenery: +71 %.
  - **Horizon cut:** the scenery is cut by the plane through the eye and the ground's far edge (it was cut at the far edge itself), so tall far trees no longer stand in the sky as pale shapes; the tree line (4 m, tinted most of the way to the haze) covers the cut. Phase 5 (open sky) replaced both: the haze goes by ground distance, the cut is upright at the far edge, and the tree line is gone.
  - **Wall shadows follow the 3D walls:** the contact shadow in the ground tiles is drawn only where a 3D wall stands, not across the gaps of phase 2 (it showed as a dark line across the gravel at the Loop).
  - **Bike hidden by trees:** not seen at the Loop, Vale or Club in the test views; no trees were lowered.
  - **Speed blur frame cost:** `speed_blur.test.js` measures +15.4–15.6 % in three runs. The blur draws the 3D scenery a second time into its own image, so the walls, trackside and estate smear (phase 2); without the estate it is +14.6 %, the estate adds about 1 ms. Unlit materials for the estate make no difference. Petr's decision (2026-11-20): keep the scenery in the blur and raise the blur limit from 15 % to 20 % (§11f).

**Phase 4: trackside rhythm (the most speed per triangle).**
- Small, repeated objects close to the track: marshal posts with flags every 250–300 m, distance boards in 3D (300/200/100 before braking zones), advertising boards along the walls (fictional brands only), light posts, TV camera towers, a few gantries over the track (start/finish gantry with lights, sponsor bridge on Hamilton Straight).
- A gantry over the road is the biggest single "whoosh": something tall that the camera passes under.
- Done when: the speed-feel checks show more on-screen motion at the same speed than Phase 3 (measured as pixel change at screen edges per frame at 300 km/h).
- **Design (approved 2026-11-20, built in `src/trackside3d.js`, into the same 250 m pieces as the walls):**
  - **Camera height, a correction to the plan:** the CLOSE camera looks down from about 28 m above the road (Behind about 53 m), so the rider passes *over* a gantry, not under it. A gantry still sweeps down the screen as the tallest thing near the road, but the "under the bridge" moment needs the lower camera of Phase 6.
  - **Distance boards in 3D:** the 44 braking boards (300/200/100/50 before each braking zone, `T.boards`) stand up where the flat ones lie today (3.2 m beyond the track edge): white 2.2 × 1.1 m boards with black numbers on two legs, bottom edge 0.4 m up, facing the oncoming rider. No collision, as now (physics unchanged).
  - **Distance posts in 3D:** the white posts every 25 m on the straights (§11h, 219 of them) become 1 m white posts with a black band.
  - **Marshal posts** every 275 m, alternating sides, 2 m behind the wall: a small white hut 1.6 × 1.6 × 2.4 m with an orange roof and a flag pole with a yellow and a green flag (still).
  - **Advertising boards** on the track face of the fences, from 1.0 to 1.9 m, 6 m panels in a repeating row of 8 fictional brands: on the outside of every corner (100 m either side) and along the start/finish straight. Brands (made up for the game, not checked against trademark registers; they avoid known brand words): **KESTRAN**, **VOLTANO**, **NOVAPEAK**, **ZEFIRA**, **RIVALTO**, **OKTARA**, **BRAKEMOR**, **HELIXON**, each in its own colours, drawn once into a texture.
  - **TV camera towers** on the outside of 10 corners: scaffold tower 5 m high with a platform and a camera box. **Light posts: left out** (Silverstone has no floodlights), the fence posts already give that rhythm.
  - **Gantries** (7 m clear over the road, pillars outside the walls): the start/finish gantry with five red start lights over the grid, from the left wall to the pit wall; and two sponsor bridges, on the Wellington Straight and the Hangar Straight (no bridge on Hamilton Straight: that is the start/finish straight, with the start gantry).
  - **Placement rule as Phase 2:** nothing on the road, kerbs, run-off, gravel or pit lane, except the distance boards, which stand where the flat ones are today; gantry pillars stand behind the walls.
  - The flat braking boards and distance posts leave the ground tiles while the 3D scenery is on, as the walls did. Test switch **7** becomes "3D scenery" (walls and trackside together).
  - All of it in the same pieces: the boards and ads share one texture (one draw per piece), posts, huts, towers and gantries go into the existing vertex-colour and instanced meshes.
  - Tests: unit tests for each function; whole-lap placement check extended to the new objects; `tests/track3d.test.js`: a 3D braking board stands up at the end of the Hangar Straight, the start gantry shows over the grid, and **speed feel** (the done-check above): over 60 frames at 300 km/h along the Hangar Straight to Stowe, the pixel change per frame in the outer 25 % of the screen is larger with the scenery on than off; frame cost of all 3D scenery under 15 %.
  - **Built, results:** 44 braking boards, 219 distance posts, 21 marshal posts, 8 camera towers (2 of the 10 corners have no clear spot behind the wall), the start gantry and two bridges; with the walls about 63,000 triangles, 3,300 posts and 880 textured cards over the lap. Placement over the whole lap: only the braking boards' legs stand off the grass (on run-off, where the flat boards lie). Speed feel at 273 km/h on the Hangar Straight: pixel change per frame at the screen edges +69 % with the 3D scenery. Frame cost in headless Chromium: +5 % for walls and trackside together (limit 15 %).
  - Seen in testing: for a moment just after the rider passes under the start gantry, its beam hides the bike (the camera is behind and above, and the beam stands between them).

**Phase 5: depth of the world.**
- Sky dome with a sun and clouds that move slowly, light fog with distance, soft shadows of walls and stands on the ground (baked once, not per frame).
- Gentle hills around the circuit (Silverstone is nearly flat; the track itself stays flat, the land beyond the walls rises and falls by a few metres) so the view is not one flat sheet.
- **Design (approved 2026-11-20, built, `src/sky3d.js`):**
  - **What the camera sees, measured:** the sky is a thin strip at the top of the screen, 7.7 % in CLOSE (64 of 830 px, camera tilt 55°) and 8.7 % in Behind, and the ground ends at a haze line about RH ahead. A sun high in the sky is never in view, and a few metres of hills 300 m away cover only a few pixels. So this phase works where it shows: the sky strip, the horizon line, and shadows on the ground, which fill most of the screen.
  - **One sun, fixed in the world:** the sun stands to the north-west on the map (−x, −y), 40° high. This matches the shadows the 2D game already draws (bikes and trees cast towards +x, +y). Today the 3D light of the walls and estate turns with the camera, so a stand's lit side changes as the rider turns. From now on that scene's sun light is turned by the camera rotation every frame, so the lit and dark faces stay put in the world and agree with the shadows on the ground. The bikes keep their own light (open question 1).
  - **Shadows on the ground (baked into the ground tiles, drawn once per tile, no per-frame cost):** each 3D object casts its shape along the sun, 1.2 × its height long (sun at 40°), soft-edged, in the same dark as the 2D shadows (about 28 % black):
    - stands (roof 12 m: about 14 m of shadow), the Wing and the office block, the paddock units, buildings;
    - the start gantry and the two bridges: their beams lay a dark band across the road, which the rider crosses at speed (a strong speed cue, and the road is on screen all the time);
    - camera towers, marshal posts, braking boards (a thin strip each);
    - trees keep their round shadows, moved to lie along the sun at 1.2 × the tree's height (today about half a radius off);
    - the walls keep their contact shadow.
    These come back to what 2D mode had: since phase 3, stands and buildings stand in 3D with no shadow at all (`drawBuildings` returns early while the 3D scenery is on). Key 7 (3D scenery off) also takes the shadows off with it.
  - **Sky strip with clouds (built, then taken out: no sky for now, see the end of this phase):** the sky stays on the 2D game canvas under the 3D layer, the same blue-to-haze gradient. Over it goes one cloud texture (made in code once, soft white puffs on a 2048 px wide strip that wraps around), drawn in the strip above the horizon:
    - it slides sideways when the camera turns (a full turn = one strip width, like the tree line), so corners show in the sky too;
    - it drifts slowly on its own (about one strip width in 10 minutes) on the game clock: it stops while the game or the replay is paused, so a paused picture stays still;
    - towards the sun's side the sky is a little brighter and warmer (a broad glow, no sun disc, since the sun is above the screen).
  - **Hills on the horizon, not in the land (built, then taken out by the "open sky" fix below):** a strip of low distant hills (2.5–4.5 m high as at the ground's far edge, so they show above the 4 m tree line's lower tops without filling the sky strip, in a blue-grey between the tree line and the sky) stands just behind the tree line and slides with the camera in the same way. It breaks the straight line where the ground meets the sky, which is the only place hills would show from 28 m up. The land itself stays flat (open question 2).
  - **Fog with distance:** already in place since phases 1–3 (the 2D haze over the far 22 % of the ground and the matching 3D fog). This phase only makes the clouds and hills fade into the same haze colour at the horizon; the haze itself does not change.
  - Classic graphics and Top-down stay as they are. The speed blur does not take in the sky strip (as today).
  - **Cost:** clouds and hills are two `drawImage` calls per frame on the 2D canvas; the shadows cost only when a tile is drawn (tiles are cached); the sun turn is one vector per frame. Target: phase 5 adds at most 3 % frame time in CLOSE (headless) and does not move the speed blur check.
  - **P overlay:** no new line (the clouds and hills are part of the sky drawing, the shadows part of the tiles).
  - **Tests:** unit tests for each function; `tests/track3d.test.js`:
    - the clouds move: standing on the grid, the sky strip changes over 10 s; turning through a corner, the sky strip slides the way the camera turns;
    - the horizon is not a straight line: the hills strip makes the row where the ground meets the sky vary across the screen;
    - shadows: a road patch under the start gantry's shadow is darker than the road beside it, and the ground on the shadow side of the Abbey stand is darker than on its sun side; with key 7 off, both differences go away;
    - one sun (unit test `sunLightPlace`): a face towards the sun is lit the same before and after the camera turns by 90°;
    - frame cost of phase 5 under 3 %; `camera_tuning`'s sky check (at most 12 %) still passes.
  - **Built, results:** about 450 trackside boxes and posts, the 10 stands, the 56 paddock units and the Wing (in 4 m slices) cast baked shadows; the trees' round shadows lie along the sun. The start gantry's shadow crosses the road just past the line. Hills 2.5–4.5 m (the first try at 4–10 m filled the whole sky strip). The clouds are 16 wide soft clusters (a first try with 70 small puffs read as speckle) and drift on the game clock, so a paused game or replay stands still (the speed blur test compares frames that must be identical). Frame cost against `dev` in headless Chromium, CLOSE at 250 km/h: −0.3 % (Hangar Straight), +0.2 % (Abbey), +0.8 % (Club), within the noise (target 3 %). All 3D scenery together at Abbey and Club: +8 to +14 % over three runs (limit 15 %; phase 3 measured +8 %; the spread is the headless timing). Speed blur +14.4 to +15.6 % (limit 20 %); CLOSE sky 3.2 % (limit 12 %).
  - **Questions, answered by Petr (2026-11-20):** 1 no, 2 not now (planned as Phase 7), 3 as recommended.
    1. Should the bikes' light also be fixed in the world? Then a bike riding towards the sun shows its dark side, which matches the shadows but changes the look you approved in §11l. **No: keep the bike light as it is; only the scenery gets the world sun.**
    2. Should the land rise and fall as real 3D hills? It needs the ground plane cut into a grid that follows a height map, every tree, stand and building raised to the height under it, and the seam tests run with the hills off. From 28 m up, a few metres of rise 200 m away shows as a few pixels. **No: hills on the horizon strip only. Real 3D land can come with the lower camera of Phase 6, where it would show.**
    3. A low sun (warm, long shadows) or a midday sun (short shadows)? **40°, mid-afternoon: shadows long enough to read (1.2 × height) without covering the road at the stands.**
  - **Fix: open sky, no bar (Petr 2026-11-20: "there is a bar on top with clouds and it doesn't look really nice; can it be removed or replaced with real clouds and sun without a bar showing"). Approved (a), built:**
    - **Why it reads as a bar:** from the top, the strip shows clouds, then a flat pale band (the haze over the clouds, the blue-grey hills and the pale tree line, all about the same colour), then a hard straight line where the ground starts. Just below that line the ground is still clearly green and grey, so the band looks like a strip glued over the top of the picture, not like sky.
    - **The change:**
      - The tree line (phase 3) and the hills strip (phase 5) go.
      - The scenery's haze is measured along the ground (how far ahead its foot stands), not as depth from the eye, so a tall tree near the far edge fades as a whole instead of its top showing clearer than its foot. The cut moves from the plane through the eye and the far edge (which cut tall trees flat at the horizon line, hidden until now by the tree line) to an upright plane at the far edge: trees, stands and the Wing stand up into the sky, the far ones in the haze's colour, and nothing beyond the ground shows.
      - The ground fades all the way into the sky's colour at the far edge: the last stretch of the 2D haze and the 3D fog both end fully opaque in one shared horizon colour, and the sky gradient starts from exactly that colour. The hard line goes away; land and sky meet in soft haze, as on a real summer day.
      - The clouds fill the whole strip and thin out towards the horizon (smaller and fainter low down, as distant clouds look), with no separate haze rectangle over them.
      - The sun: at 40° it is far above the top of the screen (CLOSE shows only a few degrees above the horizon), so a sun disc can't show without lying about the shadows. The warm glow towards the sun stays and gets a little stronger, with the clouds on that side lit warmer.
    - **Stays:** the shadows, the world sun light, the cloud drift on the game clock, the sky in Classic and Top-down.
    - **Tests:** the phase 5 "hills vary the horizon" check is replaced by "no hard line at the horizon": the colour step between the rows just above and just below the far edge stays under a small limit across the screen; the phase 3 "tree line on horizon" check goes; the cloud checks stay. Unit tests follow the changed functions.
    - **Petr chose (a)** (2026-11-20): a soft horizon with clouds and the sun glow (the other choice was no clouds at all).
    - **Built, results:** the colour step across the horizon went from about 100 (pale tree line 159,179,166 over the hazy ground 191,208,209) to about 6 (sky 202,217,222, ground 200,215,220). The clouds come as a near row up high and a far row at half the size, fainter, lower down; the haze at the sky's foot is whole at the horizon; the glow (65 %, a little wider) lies over the clouds. Near trees and the stands now reach into the sky uncut.
  - **No sky for now (Petr 2026-11-20: "remove sky completely, let's work on that later"), built:**
    - The sky is gone in every 3D view mode (Classic too): behind the ground the 2D canvas is one haze colour (#c9d8de), the colour the far ground and the 3D scenery fade into, so the strip above the far edge reads as haze, not as sky. No blue gradient, no clouds, no glow, no cloud clock.
    - Kept from the open-sky fix: no tree line or hills, the scenery's haze by ground distance and the upright cut at the far edge (near trees and the stands reach up into the haze uncut), the world sun and the baked shadows.
    - Tests: the cloud checks are replaced by "no sky: plain haze above the far edge" (largest difference from the haze colour at most 6 on a row in the strip); the "no hard line at the horizon" check stays; the speed blur test no longer holds the clouds.
    - **Later:** the sky is to be designed again in its own step (Petr: "let's work on that later").

**Phase 6 (optional, Petr to decide later): a lower chase camera.**
- A true 3D world allows a camera just behind and above the rider, at about 1.5 m, looking along the road, like TV on-board shots. It is the most intense sense of speed, but it is a new camera with its own tuning (§11a), so it is listed separately.
- **Design (approved 2026-11-20, Petr: "start phase 6", questions "as recommended"):**
  - **What it is:** a new camera, **Chase**, in the C cycle after CLOSE: about **4.5 m behind the bike and 1.6 m up, looking 6° down**, like the low follow shots on TV. The bike and rider fill the lower middle of the screen (about 15 % of its height), the road runs to the horizon near the middle of the screen, and walls, boards, trees and stands rush past at eye height. The road just ahead of the bike moves across the screen about as fast as in CLOSE; the gain is beside the road: a board or wall 8 m to the side passes the camera at 8 m instead of about 29 m (CLOSE: 28 m up), so it sweeps past about 3–4 times faster, and the horizon ahead gives the depth.
  - **A real perspective camera, not the tilted picture, with pieces taken from the Onboard branch (Petr 2026-11-20: "onboard camera is not going to be used actually, but feel free to use the code if you can re-use some pieces"):** Behind and CLOSE warp a flat top-down picture (§11a), which fails near eye height. The Onboard branch (`feature/onboard-camera`, not merged, not to be used) solved drawing the world from a real camera. Chase is built on `dev` and copies only these pieces from it, renamed for Chase:
    - the ground: tiles laid in world metres, finer near the camera, cached canvases as textures with mipmaps, a texture budget (`obTiles`, `obTileImage`, `obTexture`, `obTexPrune`, `obQuad`, `obGround`, `obInit`);
    - the projection of a point to the screen (`obProjectPt`, `obProject`), for the HUD markers and labels;
    - the bike frame for another drawing frame (`gl3DBikeFrame` with a map, the real-size scale and the mirror fix of §11p 1f) and `gl3DSize`;
    - three.js rebuilt with `PerspectiveCamera`, `PlaneGeometry`, `Vector3` and `LinearMipmapLinearFilter` added;
    - the sky gradient (`obSky`), if question 3 says so.
    - Not taken: the yoke camera, the glass, the dash, the full-detail cockpit export, the hidden rider, the eased-in steering of 1d–1e (question 5).
  - **Name:** shown as **Chase**; inside the code it is `low`, since `chase` is already the id of the Top-down camera.
  - **How the camera follows:**
    - It sits behind the bike along a **lagged heading**: the heading eases towards the bike's over about 0.25 s, so in a corner the camera swings slightly to the outside and the bike shows a little of its side, as in TV shots, and a quick flick does not whip the view.
    - **Level horizon** (recommended, question 2): the camera does not roll, and the bike and rider lean in the view, so the lean reads at a glance and the view does not rock. The rider's hang-off poses (§11l) show as in Behind.
    - **At speed:** the camera drops back to 5.5 m and the field of view widens from 60° to 70° above 200 km/h (with Speed effects On), like Behind's wider view (§11h). Speed lines and vibration apply as in the other cameras.
    - **Bumps:** height follows the bike's pitch at 30 %, so braking dips the view a little; the bike's own pitch shows fully.
    - **Crash:** the camera stops where it is and watches the bike and rider slide, then follows the reset as Behind does.
  - **What it draws:** the ground tiles with the baked shadows (phase 5) and the haze, the 3D walls, trackside objects, trees, stands and the Wing (phases 2–4), and every bike with its rider at the full model. The walls scene's horizon cut and ground-distance haze (phase 5) are for the tilted cameras; in Chase the far cut is off and the haze goes by distance from the camera, out to the draw range (about 600 m, as Onboard).
  - **Sky:** from 1.6 m up the horizon is near the middle of the screen, so about 40 % of the screen is above it. Plain haze there (as now, "no sky for now") would be a large flat block. Recommended (question 3): in Chase only, the simple blue-to-haze gradient Onboard already has, until the sky is designed again.
  - **Speed blur:** off in Chase at first (the GPU blur zooms the ground about a horizon point and masks the road from the top-down picture; that mask does not exist here). Whether Chase needs a blur is decided after riding it.
  - **Not offered** (C skips it, a saved Chase falls back to Behind): without WebGL, with Bike graphics Classic, and on phones until it shows 60 fps on Petr's iPhone, as Onboard.
  - **Tuning panel (camera tuning, §11a):** Distance (3–8 m), Height (0.8–3 m), Look down (0–15°), Field of view (50–80°), Follow lag (0–0.6 s), Widen at speed.
  - **Cost:** Onboard measured 0.5–1.3 ms median frame work (step 1h). Chase draws more ground ahead and the full rider and bike in view: target **60 fps on Petr's MacBook in Safari and Brave**, 22 bikes, at the start and on Hangar Straight. The P overlay shows the 3D ground and walls lines.
  - **Tests:** unit tests for each function; a browser test `tests/chase_camera.test.js`: the camera sits behind the bike at the set distance and height, the horizon is level at 40° of lean, the player's bike is in the lower middle of the screen, a wall stands up beside the road, Chase falls back to Behind with Classic graphics, and the frame cost against CLOSE is reported.
  - **Built (2026-11-20, `src/chase3d.js`):**
    - Chase is in the C cycle and on the start screen after CLOSE (hidden with Classic graphics, without WebGL and on phones; a saved Chase falls back to Behind there). Its own sliders in the pause menu's Camera tuning (saved as `sgp_cam_low`).
    - Taken from the Onboard branch, renamed: the world-metre ground tiles with mipmaps and the texture budget, the projection to the screen, the bike frame for another drawing frame with the mirror fix, `gl3DSize`, and three.js rebuilt with `PerspectiveCamera`, `PlaneGeometry`, `Vector3`, `LinearMipmapLinearFilter` (the build also keeps phase 3's classes, which the Onboard branch lacked).
    - Added for Chase: the estate (trees, stands, the Wing, paddock) is drawn too, a soft shadow patch lies under each bike (the tilted cameras' 2D bike shadow does not exist here), the scenery is lit by the world sun of phase 5 and the bikes by their own light turned with the camera, the camera shake and speed vibration move the eye by a few millimetres, and the speed lines streak from the horizon point.
    - The bike fills more of the screen than the estimate (about 30 % of its height at rest, not 15 %): at 4.5 m a bike and rider 1.2 m tall is that big with a 60° field of view. Distance and Field of view are on the tuning panel.
    - Checked: unit tests (`tests/unit/chase3d.test.js`, 28); `tests/chase_camera.test.js` (in `npm test`), 9 checks: offered and in the C cycle, the camera 4.50 m behind and 1.60 m up, the horizon level (0.000°) at 39° of lean through Copse, the bike drawn in the lower middle, the concrete wall standing up, the sky blue, Classic falls back to Behind, and the frame cost against CLOSE: 0.92 times (headless software rendering, median frame 104 against 114 ms; Chase draws no 2D ground layers). Screenshots in `shots/chase/`.
  - **Phase 7 (land in 3D)** fits here: from 1.6 m the land's rise and fall shows, so it is the natural next step after Chase.
  - **Questions, answered by Petr (2026-11-20): 1 as below, 2–5 as recommended (the bold answers).**
    1. Where to build it: **answered by Petr (2026-11-20): Onboard will not be used; build Chase on `dev` and reuse pieces of its code** (above).
    2. Horizon: **level, the bike leans in the view**, or leaning with the bike like TV, or a Horizon roll slider as Onboard has?
    3. Sky in Chase: **the simple blue-to-haze gradient until the sky is designed**, or plain haze as the other cameras?
    4. Camera place: **4.5 m back, 1.6 m up (low TV follow shot)**, or higher and further (about 3 m up, 7 m back), which shows more road ahead but less speed?
    5. The Onboard branch also changed keyboard steering in every camera (a held key eases in over 0.7 s and a short tap asks for a small lean, §11p 1d–1e; `dev` has 0.35 s straight). **Leave it out: it stays on the unused branch**, or bring it to `dev` with Chase?

**Phase 7 (planned, Petr 2026-11-20: "not now, prepare for another phase"): land in 3D.**
- The land beyond the walls rises and falls by a few metres as real 3D ground; the track, its kerbs, run-off and gravel and the pit lane stay flat.
- What it takes (from the phase 5 question 2):
  - **Height map:** one height per point of the land from a smooth noise, 0 within about 40 m of the track, run-off, gravel and the pit compound, rising to its full ±4 m over the next 100 m, so no wall, board or post stands on a slope.
  - **Ground mesh:** the far and near ground quads (phase 1) become grids (for example 48 × 32 cells) whose points sit at the height under them; the texture (the baked ground canvases) stays as it is, mapped by canvas position, so nothing in the tiles changes.
  - **Objects on the land:** every tree, stand, building and the Wing raised to the height under its foot when the estate is built (one number each, no per-frame cost); the tree line and the horizon hills strip (phase 5) stay.
  - **Shadows:** the baked shadows (phase 5) stay flat on the tiles; on a slope they are a little off, which reads as normal at this height.
  - **Tests:** the seam tests (`tilt_seam`) and the speed blur run with the land flat (test switch 7 already turns all 3D scenery off); a whole-lap check that the height is 0 under every wall, board, post and the road.
- Best done together with, or after, the lower camera of Phase 6: from the CLOSE camera 28 m up, a few metres of rise 200 m away shows as a few pixels; from 1.5 m up it fills the view.

**Order and size (rough):** Phase 1 is the largest and riskiest (the ground, blur and all camera tests move); Phases 2–4 are each about one session of work plus tuning by eye; Phase 5 is small; Phase 6 is its own design, Phase 7 goes with it. Recommended order: 1, 2, 4, 3, 5 (fences and trackside rhythm give more speed per frame-time than trees), then decide on 6 and 7.

**Open questions (recommended answer in bold)**
1. Objects built in code, or modelled in Blender like the bike? **Code for walls, fences, posts, boards and gantries (simple shapes, many copies); Blender only if a hero object (the Wing, a bridge) needs it later.**
2. Keep Classic and Top-down as 2D? **Yes, as fallback and for phones that cannot run it.**
3. Real brand names on boards? **No, fictional only, as for the teams.**

## 12. Track and graphics

- Centreline from the TUMFTM racetrack-database (LGPL-3.0), resampled every ~2 m (5 888 m, 2 944 points); start line at the real finish line.
- Racing line from curvature relaxation; ideal speed profile from forward/backward acceleration passes (ideal lap ≈ 2:08).
- Track: asphalt texture, white lines, red/white kerbs, tarmac run-off, gravel traps, grass, walls, start grid boxes, braking boards and corner names.
- Kerb ends (since 1.11.3): kerbs run along corners on both sides of the track. Each kerb narrows to nothing over its first and last 8 m, instead of ending square. Before, both kerbs ended on the same line across the track and the run-off and gravel edges next to them jumped sideways by the kerb width, which looked like a horizontal cut through the screen. The kerb surface (grip, braking) follows the same narrowing.
- No square ends beside the track (since 1.11.4): run-off areas narrow at their ends, and where gravel meets tarmac run-off, by at most 1.5 m per track point (~2 m). Walls change their distance from the track by at most 1.2 m per track point (before, the walls stepped by up to 4 m at the pit zone). The pit lane entry and exit merge into the track edge over 20 m instead of ending square, and the pit lane never covers the track's white edge line. These square ends caused the same horizontal cut through the screen at the pit exit before Abbey, in live riding and in replay.
- Scenery: grandstands, Wing pit building, garages, trees.
- Bikes: drawn by the game in team livery with rider, number, lean and shadow; since 1.25.0 one drawing per camera (top view in Top-down, rear three-quarter views in Behind and CLOSE, stretched to cancel the camera's squash, §11i).
- Effects: tyre marks, smoke, sparks, debris, dust on grass and gravel; speed blur of the surroundings at top speed in the tilted cameras (§11f, since 1.17.0); wider view, speed lines and camera vibration at speed (§11h, since 1.23.0).
- Trackside details for the sense of speed (since 1.24.0, §11h): mowing stripes on the grass, distance posts along the straights, asphalt joints.
- Sound: synthesised engine (rpm and gear), shifts, impacts, pit.

## 13. Technical design

- Single HTML file; no external code, only Google Fonts (Saira Condensed, Barlow). The built file is ASCII-only so it opens correctly from disk.
- Source in `src/` (`head.html`, `core.js`, `world.js`, `replay.js`, `render.js`, `ui.js`, `track.txt`), joined by `tools/build.py` into `index.html`.
- Performance:
  - static world baked into 512 px tiles of 40 m (LRU cache of 160);
  - device pixel ratio capped at 1.5, dropping to 1 when frames are slow;
  - only dynamic things are drawn each frame;
  - speed blur (§11f) works on a ¼-resolution copy of the screen, costs at most 20 % of the frame time and is switched off by the slow-machine quality drop;
  - target 60 fps.
- Smooth motion (since 1.11.2): physics runs at 120 Hz, the screen at its own rate. Riders are drawn between the last two physics steps, so the camera does not stutter when the frame clock and the physics drift apart.
- Tests: `node tests/camera_shake.test.js [index.html]` (needs Playwright with Chromium) drives the real game loop with a fake frame clock (about 60 fps with ±1.5 ms jitter) and records the camera every frame.
  - Cases: live riding and replay at 0.25×, 1× and 4×, each with the Behind and Top-down cameras, and since 1.14.0 also with CLOSE.
  - Measured against a 0.4 s moving average (in game time): camera speed, camera turn rate, direction of camera travel, and the bike's position on screen.
  - Limits: speed 2 %, turn rate 0.08 rad/s, direction 0.08 rad/s, screen position 2 px (RMS). The test exits with an error if any case is over.
- Tests: `node tests/tilt_seam.test.js [index.html]` draws a pattern of straight lines through the real Behind camera projection, in live riding and in replay, at 1280×800, 1470×830 (2× pixels) and 1024×700, and fails if a line bends by more than 0.5 px from one screen row to the next (v1.11.4 fails with about 1 px). It also measures how sharp the lines are on each screen row and fails if the sharpness changes by more than 15 % between the 8 px above and the 8 px below any row (since 1.11.6; v1.11.5 fails with a 25 % step where the near and far bands join, v1.11.6 measures 5–6 %). Since 1.13.0 it also runs at 1470×830 (2× pixels) with the Close camera profile (since 1.14.0: the CLOSE camera).
- Tests: `node tests/track_edges.test.js [index.html]` checks that no outline beside the track ends square or jumps sideways between two neighbouring track points (~2 m apart). Limits: kerb width 0.45 m, run-off outer edge 2 m, wall 1.5 m, pit lane edges 1.5 m. Live riding and replay draw the same geometry, so this covers both; the test also draws the pit exit in both modes. v1.11.2 fails the kerb check (68 square ends); v1.11.3 fails run-off, wall and pit lane.
- Tests: `node tests/camera_tuning.test.js [index.html]` checks the Behind camera tuning panel: 12 sliders in the pause menu, values applied, kept after a reload (localStorage), Reset to defaults, hidden with Top-down; since 1.13.0 also the profile list (Close sets its values, a moved slider shows Custom, the profile is kept after a reload, Reset to defaults gives Standard). Since 1.14.0 the profile checks are replaced by CLOSE camera checks: CLOSE can be chosen on the start screen and is remembered after a reload; C cycles Behind → CLOSE → Top-down → Behind (in a session and in replay); CLOSE starts with the Close values (tilt 55, distance 1.8, depth 6, far quality 0.7, …); the panel is shown for CLOSE with its title; values tuned on CLOSE do not change Behind and are kept after a reload (`sgp_cam_close`); Reset to defaults on CLOSE gives the Close values and on Behind the Behind values; an old `sgp_cam` saved with profile Close gives Behind its defaults. The sky check (at most 12 % on a straight at speed, 1470×830 @2×) uses the CLOSE camera.
- Tests (since 1.15.0): `node tests/practice_ghosts.test.js [index.html]` records a practice lap, selects it as a ghost and checks: with Curve training On, no ghost is shown before the line and a ghost is shown on the first timed lap; with Curve training Off, the ghost is shown on the first timed lap as before. v1.14.0 fails it (no ghost in curve training). Since 1.16.0 its curve-training check is replaced by the one in `practice_start.test.js` (the ghost is now shown on the spot); the Curve training Off check now expects the ghost of a practice recording without a standing start from the first line crossing.
- Tests (since 1.16.0): `node tests/practice_start.test.js [index.html]` builds small recordings inside the test (no hand-made files) and checks:
  - **Grid start:** Practice with Curve training Off and each Starting position (Pole, Front row, Mid-pack, Back) puts the bike on the same slot as the 10 lap race (track distance and lateral offset within 0.1 m), not in the pit lane; no start lights at any time (`W.lights` stays 0, no lights phase); the bike does not move before the first input; lap 1 is timed from the first input.
  - **No lights delay for ghosts:** a race recording with lights out at 6.2 s and its launch at 6.5 s, used as a ghost on the grid: the ghost does not move before the player's first input; 2 s after it, the ghost has covered the same distance as the recording 2 s after its launch (within 0.5 m).
  - **Spot sync:** with Curve training at a spot `s0`, the reference ghost is within 2 m of `s0` (along the track) at the start moment, and 3 s later it is where its recording is 3 s after `t_spot`.
  - **Several ghosts:** with two ghosts, the non-reference ghost is `τ` seconds into its best lap at the start moment; changing the reference and pressing R puts the other ghost on the spot.
  - **Re-sync:** after riding 5 s, R and Go to spot put the ghosts back on their sync positions, standing.
  - **Old files:** a practice recording without `start` still loads and rides from the first line crossing.
  - v1.15.0 fails it (practice starts in the pit box, no ghost on the spot).
- Tests (since 1.17.0): `node tests/speed_blur.test.js [index.html]` puts the player on the Hangar Straight at a set speed (bike held at that speed, no input), at 1470×830 (2× pixels) and 1280×800, with Behind and with CLOSE, and compares frames drawn with Speed blur On and Off. The road mask for measuring is computed in the test from the track edges and kerbs projected with `worldToScreen` (not taken from the game's own mask): **road pixels** are those at least 3 px inside it, **off-road pixels** at least 10 px outside it, below the horizon and away from bikes.
  - **Standstill and slow:** at 0 and at 250 km/h the frames with blur On and Off are identical (no pixel differs by more than 1 level).
  - **Top speed, surroundings blurred:** at 340 km/h the sharpness of the off-road pixels (mean absolute difference between neighbouring pixels) is at least 30 % lower with blur On than Off, and it is lower in the outer quarter of the screen width than near the centre column (streaks grow towards the edges).
  - **Top speed, road sharp:** at 340 km/h 99 % of the road pixels (asphalt, white lines, kerbs) differ by at most 2 levels between On and Off, and the bike's pixels likewise.
  - **Fades in with speed:** the off-road sharpness at 290 km/h lies between the values at 250 and 340 km/h.
  - **Top-down unaffected:** with the Top-down camera, frames at 340 km/h are identical with blur On and Off.
  - **Option Off:** with Speed blur Off on the start screen there is no blur at 340 km/h, and the choice is kept after a reload; the strength slider at 0 does the same for that camera only.
  - **Replay:** a recording passing 340 km/h, replayed and paused there, shows the blur; paused at a point below 260 km/h, it does not.
  - **Frame cost:** over 300 frames at 340 km/h (1470×830, 2× pixels, CLOSE) the median time of drawing the world plus the blur is at most 20 % above the same with blur Off (15 % before §11o phase 3).
  - v1.16.0 fails it (no blur at top speed).
- Since 1.17.0 `tilt_seam.test.js` and `camera_shake.test.js` run with Speed blur Off, so their measurements stay as before; `camera_tuning.test.js` expects 15 sliders (the three blur sliders added) and checks that they are saved per camera and reset by Reset to defaults.
- `npm test` runs the full suite, unit tests and browser tests (§13b; needs `npm install` and `npx playwright install chromium` once).
- Tests (since 1.20.0): `node tests/track_limits.test.js [index.html]` checks §6a: kerbs and the strip beside the pit lane are legal; gravel makes a practice lap invalid; the invalid lap is saved with `inv` and never becomes a best lap, mode best or all-time trace; the next lap starts valid; in a race a cut gives 2 s + the time gained, a slow run wide and a crash give no penalty, and the penalty counts in the result order. Since 1.21.0 the race part checks Phase 2: the count (10 lap race 2/3, Grand Prix 3/5), the gain given back, the clear advantage Long Lap, the 3 s change with fewer than 3 laps left, the Long Lap lane geometry (on tarmac run-off end to end, starts at the kerb, about 22 m out), serving it, the 2.5 s top-up, a missed lane, the 5 s penalty when not served, and the last lap position drop.
- Tests (since 1.23.0): `node tests/gravel_exit.test.js [index.html]` checks the gravel traps of §5: a stopped bike rides out at 18 to 22 km/h with aids on and W held, digs in (under 5 km/h) with aids off and W held, reaches 15 to 22 km/h with W tapped, stays still with no throttle, and a bike at 150 km/h slows at over 0.6 g.
- Tests (since 1.19.8, Phase 1): `node tests/phone_emulation.test.js [index.html]` runs the phone checks in emulated phones on the Mac, with no real device or account. It uses Playwright device profiles:
  - **iPhone** in WebKit (the engine of Safari, but not Safari itself) and **Pixel** in Chromium (the engine of Chrome on Android), both in landscape with touch, at the sizes of a current phone.
  - **Layout:** the phone HUD (§11g) is shown, the bottom-right panel and speed guide are absent, the pause button and both touch halves are visible, the menu shows the gearbox row hidden and the side and tilt rows shown.
  - **Touch halves:** a touch on each half brakes or throttles as in §3a, both together brake, and the side option swaps them. Touches are sent as real touch events with CDP where the engine supports it, otherwise as pointer events.
  - **Tilt:** the roll angle is fed in as motion events, as in `mobile_controls.test.js`, with the dead zone (12°) and sensitivity (Low 60°) of §3a.
  - **Portrait:** turning the phone to portrait shows the turn prompt and pauses; back in landscape the prompt is hidden.
  - **Zoom:** the viewport meta tag has `user-scalable=no` and `maximum-scale=1`; a two-finger pinch through CDP (Chromium only) leaves `visualViewport.scale` at 1; a double tap on a touch half does not zoom; the game canvas has `touch-action: none`. The iPhone pinch gesture is blocked in script, so the test checks that the handler calls `preventDefault`.
  - **Menus:** the menu still scrolls with a finger and does not double-tap zoom (`touch-action: manipulation`, as set in 1.19.5 and 1.19.7).
  - **Limits:** WebKit here is not Safari. The pinch and double-tap checks run only in Chromium, and the portrait prompt check runs only in Chromium, because WebKit's orientation query does not follow a resized emulated viewport. Real iPhone Safari and real Android are not covered; those need Phase 2 or 3, or one manual check.
  - Added to `npm test`. The test writes nothing outside the repository (screenshots go to `shots/`).

## 13a. Code scanning (ESLint with Sonar's rules)

Every commit that changes JavaScript is scanned with ESLint and `eslint-plugin-sonarjs` (Sonar's JavaScript rules packaged for ESLint). A commit that adds a new issue is stopped, the issue is reported, and it is fixed on the same branch before the commit goes in. There is no server and nothing is uploaded.

**Setup:**
- `eslint` and `eslint-plugin-sonarjs` are dev dependencies in `package.json`, like Playwright (`node_modules` stays out of git; worktrees use a symlink to the main checkout's `node_modules`).
- `eslint.config.js` (committed) uses ESLint's recommended rules and Sonar's recommended rules.
  - `src/*.js` are browser scripts that are joined into one file by `tools/build.py`, so each file uses functions and constants from the others. For them, the rules for undefined, unused and implicit global names (`no-undef`, `no-unused-vars`, `sonarjs/no-implicit-global`) are off; every other rule applies. Sonar's own `sonarjs/no-unused-vars` stays on, since it checks only names local to a function.
  - `tests/` and `tools/` are Node scripts and get Node globals. The tests are plain Playwright scripts, not `describe`/`it` blocks, so `sonarjs/no-empty-test-file` is off for them.
  - `index.html` (built), `node_modules/`, `saved_tracks/`, `shots/` and `.claude/` are ignored.
- `npm run lint` scans the whole project and writes the list to `shots/lint-report.txt`.

**Pre-commit hook:**
- `tools/hooks/pre-commit` (committed), switched on once with `git config core.hooksPath tools/hooks`. The setting is shared by the main checkout and all worktrees; a branch made before this change has no hook file, so its commits are not scanned until it includes the change.
- It scans only the staged `.js` files under `src/`, `tests/` and `tools/`, using their staged content (not the working copy). Commits with no such file (GDD-only, CHANGELOG-only, `index.html`) are not scanned.
- It keeps only the issues on lines this commit adds or changes (from `git diff --cached`). Issues already in the code before the commit do not block it.
- If any are left, the commit is stopped and the hook prints each one: file, line, rule and message. It takes about 1–2 s.
- If ESLint is missing (no `node_modules`), the commit is stopped with a message saying how to install it. `git commit --no-verify` skips the scan; it is used only when the owner says so.

**Workflow:** when the hook stops a commit, the issues are reported to the owner in the reply, fixed on the same branch, and the commit is made again. `CLAUDE.md` gets the same rule so every session follows it.

**Existing issues:** the first full scan (`npm run lint`) is reported to the owner as a summary. These issues do not stop commits; they are fixed in their own feature branches when the owner asks.

**Cleanup of the existing issues (feature/lint-cleanup, 2026-10-30).** The first full scan found 355 issues. The cleanup changes how the code is written, never what the game does.

| Rule | Count | Plan |
|---|---|---|
| `sonarjs/no-unenclosed-multiline-block` | 130 | Statements after a one-line `if` or loop go on their own line, or get braces if they belong inside. Each is checked; the samples read so far all run as intended |
| `sonarjs/no-nested-conditional` | 65 | Nested `? :` become `if`/`else` or a small lookup |
| `sonarjs/cognitive-complexity` | 48 | **Not changed now.** Splitting the large functions (HUD, physics, AI, replay) is a redesign with real risk; they stay listed and are done later, one area per branch, when the owner asks |
| `no-empty`, `sonarjs/no-ignored-exceptions` | 36 | Empty `catch` blocks get a comment that says why the error is ignored (for example, storage not available) |
| unused names, dead stores, useless assignments | 37 | Removed |
| `sonarjs/pseudo-random` | 12 | **Rule off for `src/`.** `Math.random` is used only for camera shake, speed lines, sound noise and recording ids, not for anything that needs to be unpredictable. The race itself uses its own seeded generator |
| `sonarjs/no-fixed-wait-in-tests` | 8 | Fixed waits in tests become waits for a condition where one exists; where a test must wait for frames to be drawn, the wait stays with a comment and the rule is turned off for that line |
| `no-redeclare` (`Touch`) | 1 | The game's `Touch` object hides the browser's built-in `Touch`. It is renamed `TouchCtl`; the test hook keeps the name `Touch`, so the tests do not change |
| The rest | 18 | Fixed one by one (nested functions in tests, inverted conditions, assignments inside expressions, floating point `==`, loop counters, duplicated branches) |

- Expected result: about 48 issues left, all `sonarjs/cognitive-complexity`.
- **Proof that the game does not change:** a one-off check (kept in `shots/`, not committed) loads the build from before the cleanup and the build after it, with `Math.random` fixed to the same seeded sequence in both:
  - **Simulation:** a 10 lap race with 22 riders, a practice session and qualifying, each simulated for 3 minutes of game time. The position, speed, lean, gear, fuel and lap times of every rider must be identical in both builds.
  - **Picture:** frames drawn with the Behind, CLOSE and Top-down cameras, and with the phone HUD, must have identical pixels in both builds.
- `npm test` must pass, and every commit goes through the pre-commit hook.
- Commits are split by area (`core.js`, `world.js`, `render.js`, `ui.js`, `replay.js`, tests), so a problem can be traced to one of them.

**Limits:**
- JavaScript only: the CSS and HTML in `src/head.html` and the Python in `tools/build.py` are not scanned.
- No duplicated-code check across files, no dashboard or history; that needs the SonarQube server, which can be added later as a scan at release.
- Because `no-undef` is off in `src/`, a misspelled name used across files is not caught by the scan; the tests still catch most of these.

## 13b. Test levels

The full suite takes about 5 minutes (measured 2026-10-30 on the Mac: `speed_blur` about 125 s, `camera_shake` about 110 s, `speed_feel` about 50 s, the other 11 under 10 s each). So there are two levels:

- **Unit tests** (`tests/unit/*.test.js`): Node's built-in test runner (`node --test`), no browser and no new packages.
  - `tests/unit/load.js` joins `src/` in the same order as `tools/build.py` and runs it in Node, with small stand-ins for the page passed in as the page globals: a DOM tree parsed from the markup in `src/head.html`, canvases whose 2D contexts record every call, `localStorage` in memory, timers and animation frames that do not run unless the test asks, and a seeded `Math.random`. It returns every top-level function and object of the game to the test, so `src/` needs no export hooks for testing. `load()` gives a fresh game in about 0.15 s, so most tests start from their own.
  - Each test sets its own state (bike, track position, session) and checks the result of one function: values, state changes, and for drawing functions the calls made on the recording canvas (it draws, or does not draw when it should not, without errors). HUD text and panels must lie inside the screen.
  - Recordings for the replay and ghost tests are made in the test (`makeRec`), no files.
  - What only shows in real pixels or in the real frame loop (blur sharpness, seams, camera smoothness, frame cost, phones) stays in the browser tests.
  - Target: the whole unit suite runs in **under 30 s**. Measured (2026-10-30, the Mac): 254 tests in about 15 s.
- **Browser tests** (`tests/*.test.js`): the 14 Playwright tests of §13, unchanged.

**Every function has a unit test.** This covers every top-level function in `src/*.js` and every method of the top-level objects (`T`, `FX`, `Records`, `Rec`, `Lib`, `Ghost`, `RP`, `HUD`, `Sound`, `Touch`, `UI`, …), and the track helpers `T.*`, `T.PIT.*` and `T.LL.*`: 270 on 2026-10-30. Each one is named in at least one unit test title, as `name` or `Obj.method`, for example `test('fmtTime: minutes, seconds and thousandths', …)`. `tests/unit/inventory.test.js` reads the function list from the source and fails if a function has no test, or if a test names a function that no longer exists. Helper functions defined inside another function are covered through that function and are not listed.

**Commands:**

- `npm run test:unit`: unit tests only, with the inventory check.
- `npm run test:browser`: browser tests only.
- `npm test`: the full suite, unit tests first and then the browser tests.

## 14. Change process

1. Create a worktree with a feature branch from `dev`: `git worktree add .claude/worktrees/<name> -b feature/<short-name> dev`.
2. **Update this GDD first** and commit it. Do not change the version here.
3. Wait for approval of the design before changing the code.
4. Change the code in `src/`, run `python3 tools/build.py`, and write or update the unit tests (§13b) for every new or changed function. Run the browser tests that cover the change when it touches what they measure. Commit. The pre-commit hook scans the code (§13a); a commit it stops is fixed and made again. Feature commits add no tags, no version bump and no `CHANGELOG.md` version entry.
5. Before merging into `dev`: `npm run test:unit` must pass on the feature branch. The browser tests are not required here.
6. Merge the feature branch into `dev` with `--no-ff`, through the `.claude/worktrees/dev` worktree. Feature branches never merge straight into `main`.

**Release** (only when the owner says "Release"):

1. Compare `main` and `dev`.
2. Choose the new version: MINOR for features, PATCH for fixes, MAJOR for big redesigns.
3. On `dev`, add the `CHANGELOG.md` entry and bump the version at the top of this GDD. Commit.
4. On `dev`, run the **full suite** (`npm test`). It must pass before `dev` is merged into `main`. A failure is fixed on a feature branch and merged into `dev` first.
5. Merge `dev` into `main` with `--no-ff`, then tag `vMAJOR.MINOR.PATCH` on `main`.

**Push** (only when the owner says "Push"): push `main` to GitHub (`p3trk/motogp`). Tags, `dev` and feature branches are not pushed unless asked.

## 15. Deviations from real MotoGP (intentional)

- Fictional teams and riders.
- No tyre compound choice or flag-to-flag bike swap.
- Track limits (§6a) are simplified: only the player is judged; an infraction is decided by time lost against a reference, not by Race Direction; an unserved Long Lap is a fixed 5 s time penalty.
- No weather.
- Simplified 2D physics: no suspension and no separate front/rear tyre model.

## 16. Version history

See `CHANGELOG.md`. Current: **1.24.0** (sense of speed: closer zoom, wider view, trackside details, speed lines, camera vibration; §11h). Previous: **1.23.0** (gravel traps: drag grows with speed, feathered throttle rides out at about 20 km/h; §5). Previous: **1.22.0** (no refuelling, pit stop kept; consumption about 1.0 L per lap; §7). Previous: **1.21.0** (track limits, Phase 2: infraction count, warning, Long Lap loop at Stowe, last lap position drop; §6a). Previous: **1.20.0** (track limits, Phase 1: invalid laps in practice and qualifying, time penalty for cuts in races; §6a). Previous: **1.19.8** (phone emulation tests; §13). Previous: **1.19.7** (fix: no text selection or zoom while playing on iPhone browsers, Brave included; §3a). Previous: **1.19.6** (version number shown next to the menu title; §11). Previous: **1.19.5** (fix: no double-tap zoom or text selection on menus and overlays in iPhone browsers, Brave included; §3a). Previous: **1.19.4** (fix: race result order lists riders a lap down below lead-lap riders; §11). Previous: **1.19.3** (no browser zoom on phones; §3a). Before that: **1.19.2** (tilt dead zone 12 degrees; §3a).

### Open questions for 1.23.0 (recommended answer in bold; the design above uses it)

1. Top speed while in the gravel: **20 km/h** with feathered throttle (Petr, 2026-10-30).
2. Does traction control feather for you? **Yes**, rider aids on rides out at about 20 km/h while holding W. Alternative: feathering is always manual, also with aids on.
3. Holding W with aids off: **the wheel digs in and the bike barely moves.** Alternative: a milder penalty, e.g. about 8 km/h.
4. Show the *FEATHER THE THROTTLE* hint? **Yes, once per session.**
5. Grass: **unchanged** (it already lets you ride out). Alternative: speed-dependent drag there too, with lower numbers.
6. Test: **add `tests/gravel_exit.test.js`**: a stopped bike in gravel reaches 18 to 22 km/h with aids on and W held (at least 17 km/h after 5 s); with aids off and W held it stays under 5 km/h; with aids off and W tapped three times a second it reaches 15 to 22 km/h; a stopped bike with no throttle does not move; a bike at 150 km/h slows at over 0.6 g.

### Open questions for 1.22.0 (recommended answer in bold; the design above uses it)

1. How does a race finish with no refuelling? At 2.6 L per lap a 10 lap race needs 26 L and a 20 lap Grand Prix about 52 L, more than the 22 L tank. **Cut consumption to about 1.0 L per lap**, so a full tank covers the Grand Prix and the 10 lap race uses under half. The other options are a bigger tank (about 55 L, so about 40 kg more fuel at the start and a retune of the lap times) or a tank sized per race.
2. What happens to the pit stop? **Keep it, without refuelling**: the bike stops in its box and W leaves. The box is also the qualifying start (§2). The pit lane keeps its 60 km/h limiter, even though a stop has no fuel reason now.
3. Does a stop repair damage? **No:** damage is never repaired in the pits. The 1.21.0 code repairs damage during a stop; 1.22.0 removes that along with the refuelling.
4. Do AI riders still pit for heavy damage? **No.** A stop no longer repairs or refuels, so AI riders never enter the box. Alternative: keep the AI damage stop as a visual only, which costs time for nothing.
5. Starting fuel: keep 25–100 %? **Yes**, with the menu showing the least fuel that finishes the chosen race. Less fuel is lighter and faster but risks running dry.
6. Fuel warning on phones (§3a)? **Keep it**: 3 laps and 1 lap left, since the race cannot be refuelled.

### Open questions for 1.21.0 (recommended answer in bold; the design above uses it)

1. Where is the Long Lap loop? **Outside of Stowe** (38 m tarmac run-off, after the longest braking zone, apex about 120 km/h). Alternatives with enough tarmac: outside of Copse (39 m, apex about 100 km/h) or Woodcote (31 m).
2. How is the 2.5 s cost guaranteed? **The loop shape plus a top-up time penalty** when the loop was ridden faster than that. A speed limit in the loop would feel artificial.
3. Thresholds for the 10 lap race: **the Sprint numbers (warning 2, Long Lap 3)**, because its length is close to a real Sprint. The Grand Prix uses 3 and 5.
4. A cut that gains time: **give back the gain as a time penalty and count it; a clear advantage (1 s or more) gives a Long Lap at once.** This replaces the fixed 2 s penalty from Phase 1.
5. A Long Lap not served: **5 s**; given with fewer than 3 laps left: **3 s at once**.
6. Last lap: **drop one position if a rival is less than 0.5 s behind**, as in the real rules.
7. Judge AI riders too? **Not yet.** They only leave the track after contact.

### Open questions for 1.20.0 (recommended answer in bold; the design above uses it)

1. Which surfaces are over the limit? **Everything beyond the kerb: tarmac run-off, gravel and grass.** Kerbs stay legal, as in real MotoGP.
2. Judge AI riders too? **No, the player only in Phase 1.** The AI follows its line and only leaves the track after contact, where it gains nothing.
3. Race threshold and penalty: **cut = lost less than 0.5 s; penalty 2 s + time gained.** The real shortcut protocol asks for 1 s lost, but that would punish small runs wide at fast corners such as Copse.
4. An option to turn track limits off? **No option in Phase 1**, so saved laps and ghosts stay comparable. One can be added with Phase 2.
5. Does an invalid qualifying lap use up a flying lap? **Yes**, as in real qualifying.

### Open questions for 1.18.0 (recommended answer in bold; the design above uses it)

1. Which hand is brake? Petr said left half brake, right half gas. **Brake left by default, with a "Left side is" option to swap.**
2. Landscape only, or portrait too? **Landscape only**, because the tilt reads the roll angle; portrait shows a rotate prompt.
3. Tilt as lean only, or also a touch lean fallback? **Tilt only**, as Petr asked. No on-screen lean buttons.
4. Keep the Transmission option on phones? **No:** phones are always automatic and the option is hidden.
5. Zero point for tilt: fixed or set at start? **Set at the start of each session**, with Re-centre in the pause menu.
6. Brake and throttle together? **Brake wins.**
7. Desktop behaviour: unchanged. **Yes**, the touch layout only appears on touch devices or when Controls is set to Touch.
8. Replay on phones: tap sides to seek? **Yes**, as in §3a; a fuller replay touch UI is a later step.
9. How the phone gets the game: an `index.html` opened from disk does not give motion or orientation data in iPhone Safari. **Needs a decision (see reply):** a secure address (HTTPS) is needed, such as GitHub Pages, which requires a push and so your approval, or a local HTTPS server on the Mac.

### Open questions for 1.17.0 (recommended answer in bold; the design above uses it)

1. From which speed? Petr said "in Top speed only". **Start 260 km/h, full 330 km/h**, so it only shows on the long straights and never in braking zones; 200/300 would blur most of the lap.
2. Zoom streaks from the vanishing point, or a plain soft blur? **Zoom streaks** (stronger at the screen edges, near zero at the horizon), so the corner ahead stays readable; it costs the same as a plain blur here.
3. Are the pit lane, grid boxes and painted corner names "road"? **Grid boxes and painted names yes** (they are on the asphalt); **pit lane no** (it is beside the track).
4. Riders off the road (a crash, a run through the gravel): blurred with the ground or sharp? **Sharp** (a blurred bike looks like a bug).
5. Blur in replay when paused or in slow motion? **Yes, by the bike's speed**, so a paused frame looks like the moving one.
6. Separate settings for Behind and CLOSE? **Yes**, like every other camera setting (CLOSE 24 px, Behind 20 px).
7. Slow machines: lower the blur quality or turn it off? **Turn it off** when the tilted image quality drops; it is a pure effect.
