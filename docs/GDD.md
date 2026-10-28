# Silverstone GP — Game Design Document

**Version:** 1.19.3 · **Last updated:** 2026-10-28 · **Owner:** Petr

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
| **Practice** | Player alone | Unlimited | Since 1.16.0 starts on a grid slot the player picks, the same way as for the 10 lap race (§2a), or from a chosen spot with Curve training (§11d). No start lights. Lap and sector times, pit stops, optional speed guide (§9). Laps are saved (§10). |
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
- **The pit box is still usable:** pit in at any time to refuel; W leaves the box as before. The box marker on the minimap stays (§11).
- **Restart session** (pause menu) and **R** put the bike back on the same grid slot, held, with the ghosts re-synced (§11c). With Curve training On, Restart and R go to the training spot instead (§11d).
- Qualifying still starts from the pit box (out lap + 3 flying laps).

## 3. Controls

| Key | Action |
|---|---|
| W | Throttle (also leaves the pit box after service) |
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
| Starting fuel (races) | 25–100 % of tank, step 5 | 100 % |
| Starting position (10 lap race and, since 1.16.0, Practice with Curve training Off) | Pole / Front row / Mid-pack / Back. One setting shared by both modes | Mid-pack |
| Speed blur (since 1.17.0) | On / Off. Blurs the surroundings at top speed in the Behind and CLOSE cameras (§11f) | On |
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
- **Tyres:** cold for the first ~2.5 km (HUD *COLD TYRES*, up to 7 % less grip); slow wear over distance (up to 4.5 %).
- **Surfaces:**

| Surface | Grip | Rolling drag | Braking |
|---|---|---|---|
| Asphalt | 1.00 | 0 | 1.00 |
| Kerb | 0.88 | low | 0.90 |
| Tarmac run-off | 0.86 | low | 0.88 |
| Grass | 0.42 | medium | 0.45 |
| Gravel | 0.34 | very high | 0.40 |
| Pit lane | 0.95 | 0 | 1.00 |

## 6. Collisions, crashes and damage

- Bikes are oriented boxes; contacts push both bikes apart and transfer speed.
- Contact with relative speed above ~3 m/s causes a slide; above ~5.5 m/s it is a crash.
- Hitting a wall or exceeding the grip limit by too much crashes the bike.
- **Crash:** bike slides and tumbles with sparks/debris, then the rider respawns on track after a delay.
- **Damage** has three parts (0–1 each), shown on the HUD:
  - **Engine** — up to −40 % power. At 100 % the rider is out (DNF).
  - **Aero** — up to +35 % drag.
  - **Chassis** — up to −13 % grip and −20 % lean rate.
- Damage is never repaired in the pits (fuel only). AI with heavy aero/chassis damage pits early to top up and drives more cautiously.

## 7. Fuel and pit stops

- Tank 22 L. Consumption ≈ 2.6 L per lap at race pace (scales with throttle and rpm), so a 20-lap race needs one stop and a 10-lap race needs a full tank.
- **Out of fuel:** engine stops (HUD *NO FUEL*), the bike coasts.
- **Pit lane:** on the right of the Hamilton straight. Speed limiter 60 km/h is enforced automatically inside the lane (HUD *PIT LIMITER*).
- **Box:** each team has a box with crew and garage. Stopping in your box starts refuelling at 2.6 L/s; press W to leave whenever you want.
- **AI strategy:** AI start fuel and stop lap are planned from the race length and their consumption, with a safety margin; they refuel just enough to finish.

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

## 11. HUD and screens

- **Top left:** timing tower (positions and gaps; in practice, session and all-time bests).
- **Top centre:** lap stopwatch, last/best lap, sector splits; speed guide panel below it (§9).
- **Bottom:** speedometer, rpm bar with shift light, gear, fuel (litres and laps left), damage bars, status tags.
- **Top right:** minimap of Silverstone with all riders.
  - The player's own pit box is marked by a ring in the team's main colour that blinks every 0.3 s.
- Centre messages for start, pit, flags and session events.
- Screens: menu, loading, pause, results.
- **Touch (phones, since 1.18.0):** a faint brake or throttle tint on each half of the screen, a pause button at the bottom centre between the two bottom panels, and a "Turn your phone sideways" screen in portrait (§3a). The minimap, timing tower and speed guide keep their places; the speedometer and fuel stay at the bottom and are not covered by the touch halves' tint.

## 11a. Camera

Three cameras (since 1.14.0): **Behind**, **CLOSE** and **Top-down**. Chosen on the start screen (Camera option, §4) and remembered there; **C** switches through them in order Behind → CLOSE → Top-down → Behind, in a session and in replay. Choosing with C also updates the start-screen option. Behind and CLOSE are both tilted views drawn the same way (below); they differ only in their settings.

**Behind (default, since 1.7.0)**
- A chase view from behind and slightly above the bike. The flat 2D world is tilted back in true perspective (see Tuning below).
- Near track is big, which keeps the feel of speed. Far track shrinks towards the horizon, so corners coming up are visible much earlier than top-down.
- The bike sits ~20 % above the bottom edge. The view rotates with the bike's heading, smoothed. Bikes are drawn at least ~40 px long so they stay readable when zoomed out (visual only).
- Zoom eases out with speed: `ppm = min(20, min(VW, 1.25·VH) / (30 + 1.0·v))`. Since 1.7.1 it is closer at speed (it was `1.45·v`), because the far view made the game feel slow.
  - At 300 km/h roughly 200 m of track ahead is on screen, about the Stowe braking distance.
  - In a slow corner it stays close.
- HUD, name tags and panels are drawn flat on a separate layer on top. Name tags are projected through the same perspective.
- **Implementation:** the ground plane is rendered top-down into two offscreen canvases.
  - Near band: the first screen-height of plane at 0.75 × resolution.
  - Far band: the rest, up to ~2.6 screen heights, at 0.45 × resolution (0.4 before 1.11.6). It also covers the top 30 % of the near band, where the near band fades into it, so the picture gets softer gradually with distance instead of in one step where they join (since 1.11.6).
  - Both are projected onto the screen one screen row at a time, each row scaled by the perspective factor (since 1.11.5). Before, 3 px strips with one scale each drew straight lines (track edges, kerbs) as ~1 px steps every 3 rows, which showed as a kink across the screen, also where the near and far bands join.
  - A sky gradient fills the space above the far edge, and haze fades the far ground into it.
  - On slow machines the resolution of both bands drops by a further 20 %.
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
  - Zoom: maximum 20 / 30 px/m (10–30), base 30 / 12 m (10–60), speed factor 1.0 / 0.4 (0.3–2.0) in `ppm = min(max, min(VW, 1.25·VH) / (base + factor·v))`.
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
- **Performance limit:** at full strength the blur may add at most **15 % to the frame time** of the same view without it (target: about 1 ms on the 1470 × 830 Retina reference screen). When the slow-machine quality drop lowers the tilted image quality (`TILT.q` below 1, §11a), speed blur is switched off for the rest of the session, before that it counts in the frame time like everything else.
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
| Pit service panel, start lights, centre messages | As in §11 | Unchanged |

- Nothing on the phone layout is drawn over the touch halves' labels at the bottom edge.
- Fuel is not shown on the phone HUD. Pit decisions still need it, so a centre message warns when fewer than 3 laps of fuel are left (see open question 2).

### Open questions for 1.19.0 (recommended answer in bold; the design above uses it)

1. The coloured racing line on the track (§9) on phones: keep or remove? **Keep**, because it is on the track, not in the HUD. Remove the panel only.
2. Fuel is removed from the HUD. How is a low tank warned? **Centre message "FUEL 3 LAPS" once when fewer than 3 laps are left**, and again at 1 lap.
3. Minimap on phones: keep its size or make it smaller? **About 140 px**, so the timing tower and the minimap do not crowd the top corners.
4. Lean as a number in the speedometer, or a bar? **A bar** (Petr, 2026-10-28), with the angle in degrees centred right above it and no "LEAN" label (Petr, 2026-10-28).

## 12. Track and graphics

- Centreline from the TUMFTM racetrack-database (LGPL-3.0), resampled every ~2 m (5 888 m, 2 944 points); start line at the real finish line.
- Racing line from curvature relaxation; ideal speed profile from forward/backward acceleration passes (ideal lap ≈ 2:08).
- Track: asphalt texture, white lines, red/white kerbs, tarmac run-off, gravel traps, grass, walls, start grid boxes, braking boards and corner names.
- Kerb ends (since 1.11.3): kerbs run along corners on both sides of the track. Each kerb narrows to nothing over its first and last 8 m, instead of ending square. Before, both kerbs ended on the same line across the track and the run-off and gravel edges next to them jumped sideways by the kerb width, which looked like a horizontal cut through the screen. The kerb surface (grip, braking) follows the same narrowing.
- No square ends beside the track (since 1.11.4): run-off areas narrow at their ends, and where gravel meets tarmac run-off, by at most 1.5 m per track point (~2 m). Walls change their distance from the track by at most 1.2 m per track point (before, the walls stepped by up to 4 m at the pit zone). The pit lane entry and exit merge into the track edge over 20 m instead of ending square, and the pit lane never covers the track's white edge line. These square ends caused the same horizontal cut through the screen at the pit exit before Abbey, in live riding and in replay.
- Scenery: grandstands, Wing pit building, garages, trees.
- Bikes: detailed top-down sprites in team livery with rider and number, lean and shadow.
- Effects: tyre marks, smoke, sparks, debris, dust on grass and gravel; speed blur of the surroundings at top speed in the tilted cameras (§11f, since 1.17.0).
- Sound: synthesised engine (rpm and gear), shifts, impacts, pit.

## 13. Technical design

- Single HTML file; no external code, only Google Fonts (Saira Condensed, Barlow). The built file is ASCII-only so it opens correctly from disk.
- Source in `src/` (`head.html`, `core.js`, `world.js`, `replay.js`, `render.js`, `ui.js`, `track.txt`), joined by `tools/build.py` into `index.html`.
- Performance:
  - static world baked into 512 px tiles of 40 m (LRU cache of 160);
  - device pixel ratio capped at 1.5, dropping to 1 when frames are slow;
  - only dynamic things are drawn each frame;
  - speed blur (§11f) works on a ¼-resolution copy of the screen, costs at most 15 % of the frame time and is switched off by the slow-machine quality drop;
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
  - **Frame cost:** over 300 frames at 340 km/h (1470×830, 2× pixels, CLOSE) the median time of drawing the world plus the blur is at most 15 % above the same with blur Off.
  - v1.16.0 fails it (no blur at top speed).
- Since 1.17.0 `tilt_seam.test.js` and `camera_shake.test.js` run with Speed blur Off, so their measurements stay as before; `camera_tuning.test.js` expects 15 sliders (the three blur sliders added) and checks that they are saved per camera and reset by Reset to defaults.
- `npm test` runs all tests (needs `npm install` and `npx playwright install chromium` once).

## 14. Change process

1. Create a feature branch from `main`: `git checkout -b feature/<short-name>`.
2. **Update this GDD first** (and bump the version at the top) and commit it.
3. Change the code in `src/`, run `python3 tools/build.py`, test, commit.
4. Add an entry to `CHANGELOG.md`.
5. Merge into `main` with `--no-ff` and tag `vMAJOR.MINOR.PATCH`.
   - MINOR for features.
   - PATCH for fixes.
   - MAJOR for big redesigns.

After tagging, push `main`, the tag and the feature branch to GitHub (`p3trk/motogp`).

## 15. Deviations from real MotoGP (intentional)

- Fictional teams and riders.
- Mid-race refuelling (real MotoGP has no pit refuelling).
- No tyre compound choice, flag-to-flag bike swap, long-lap or track-limits penalties.
- No weather.
- Simplified 2D physics: no suspension and no separate front/rear tyre model.

## 16. Version history

See `CHANGELOG.md`. Current: **1.19.0** (phone HUD: compact speedometer and stopwatch, next corner at the top centre, bottom-right panel, speed guide and "Your laps" removed on phones; §11g). Previous: **1.18.0** (mobile controls: touch brake on the left half and throttle on the right, lean by rotating the phone, automatic gearbox only, in landscape; §3a).

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
