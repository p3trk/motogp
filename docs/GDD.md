# Silverstone GP — Game Design Document

**Version:** 1.14.0 · **Last updated:** 2026-10-28 · **Owner:** Petr

This document is the source of truth for how the game should work. Every
change starts here: update the GDD on a feature branch first, then change the
code to match (see [§14 Change process](#14-change-process)).

---

## 1. Overview

| | |
|---|---|
| Genre | 2D top-down motorcycle racing sim |
| Platform | Desktop browser, single self-contained HTML file (`index.html`), keyboard only |
| Track | Silverstone Grand Prix circuit, 5.89 km, 18 turns |
| Player fantasy | Ride a MotoGP prototype around a realistic Silverstone against a full grid, manage fuel and damage, and chase lap records |
| Pillars | Believable physics · readable top-down racing · full race weekend feel · fast to start, nothing to install |

Teams, riders and liveries are **fictional**; no real MotoGP names or branding.

## 2. Game modes

| Mode | Grid | Length | Notes |
|---|---|---|---|
| **Practice** | Player alone | Unlimited | Starts from the pit box, or from a chosen spot with Curve training (§11d). Lap and sector times, pit stops, optional speed guide (§9). Laps are saved (§10). |
| **10 Lap Race** | 22 riders | 10 laps | Player picks the starting slot (pole / front row / mid-pack / back of the grid). |
| **Grand Prix + Qualifying** | 22 riders | Qualifying, then 20 laps | Qualifying: out lap + 3 flying laps, best lap sets the grid. AI quali times are simulated from their pace. Player can end qualifying early from the pause menu. |

Start lights (since 1.7.2): when a race starts or is restarted, the countdown begins immediately with no grid wait.
- The first red light is on at once, and one more comes on every 0.9 s up to five.
- After that, the lights go out following a random hold of 0.6–2.4 s.
- The lights label shows the lap count.

Race flow: grid → start lights → race →
chequered flag → results table (positions, gaps, best laps, DNFs).

## 3. Controls

| Key | Action |
|---|---|
| W | Throttle (also leaves the pit box after service) |
| S | Brake |
| A / D | Lean left / right |
| O / L | Shift up / down (ignored in automatic) |
| M | Mute / unmute sound |
| C | Switch camera: Behind → CLOSE → Top-down → Behind (§11a) |
| R | Curve training only: back to the training spot at once (§11d) |
| Space, ←/→, ↓/↑, [ ], Tab | Replay viewer only: play/pause, jump 5 s, speed, lap, followed bike (§11e) |
| Esc | Pause menu (resume, restart, end qualifying, quit). In Practice it also shows the Curve training map (§11d) |

## 4. Options (menu)

Stored in `localStorage` key `sgp_opts`. The camera choice is remembered for all three cameras (before 1.14.0 only Top-down was kept; a saved Behind was dropped and fell back to the default, which was also Behind).

| Option | Values | Default |
|---|---|---|
| Transmission | Manual / Automatic | Manual |
| Rider aids (lean limiter + traction control) | On / Off | On |
| AI level | Rookie (0.905) / Pro (0.955) / Legend (0.99) of ideal pace | Pro |
| Camera | Behind (tilted) / CLOSE (tilted, low and close, since 1.14.0) / Top-down | Behind |
| Speed guide (practice only) | On / Off | On |
| Curve training (practice only) | Off / On toggle, plus spot on track and start speed 0–300 km/h | **On** (since 1.10.0), spot 350 m before Abbey, guide speed |
| Starting fuel (races) | 25–100 % of tank, step 5 | 100 % |
| Starting position (10 lap race) | Pole / Front row / Mid-pack / Back | Mid-pack |
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

## 10. Saved laps (records)

Stored in `localStorage` key `sgp_records`, format `{v:1, laps, best, trace, traceT}`.

- Every completed player lap is saved (newest 300 kept) with the mode, time, sectors and date.
- Best lap per mode is kept; the all-time best lap trace is kept for comparison.
- Menu panel **"Your laps"** lists the best and recent laps, with a *Clear* button.
- In practice, the timing tower shows an **ALL-TIME** best row.
- Laps driven by autopilot (e.g. while the crew is servicing) are not saved.

## 11. HUD and screens

- **Top left:** timing tower (positions and gaps; in practice, session and all-time bests).
- **Top centre:** lap stopwatch, last/best lap, sector splits; speed guide panel below it (§9).
- **Bottom:** speedometer, rpm bar with shift light, gear, fuel (litres and laps left), damage bars, status tags.
- **Top right:** minimap of Silverstone with all riders.
- Centre messages for start, pit, flags and session events.
- Screens: menu, loading, pause, results.

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
- A session is kept when the player completed at least one timed lap, or started a race.

**Recording file (JSON, `format: "silverstone-gp-session"`, `version: 1`)**
```
{ format, version, game, track: "silverstone", id, date,
  kind: "practice|quali|sprint|gp", mode: "practice|quali|race", totalLaps,
  rider: { name, num, team, short }, aids, auto,
  laps: [ { start, end, time } ], bestLap, raceStart, finishT, position,
  samples: { dt: 0.1, x: [], y: [], h: [], v: [], lean: [], s: [], p: [] } }
```
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
- **Practice:** each ghost replays the best lap of its recording. It starts together with the player each time the player starts a timed lap (crossing the line after the out lap, or completing a lap), and disappears at the end of its lap. The timing tower lists each ghost's best lap.
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
- Turning the toggle Off and pressing **Restart session** starts normal practice from the pit box.

**Session**
- The bike starts on the spot, always in the **centre of the road** (lateral offset 0), pointing along the track, at the chosen speed and in the matching gear. The tank is full and the tyres are warm.
- The bike waits on the spot, frozen, until the player presses W, S, A or D, then rides off at the chosen speed. "CURVE TRAINING · press W, S, A or D to go" is shown meanwhile.
- **Restart session** (pause menu) and the **R** key put the bike back on the same spot at the same speed, with no delay.
- Riding on past the line starts normal timed laps, as in practice. Ghosts (§11c) are not shown in curve training.
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

## 12. Track and graphics

- Centreline from the TUMFTM racetrack-database (LGPL-3.0), resampled every ~2 m (5 888 m, 2 944 points); start line at the real finish line.
- Racing line from curvature relaxation; ideal speed profile from forward/backward acceleration passes (ideal lap ≈ 2:08).
- Track: asphalt texture, white lines, red/white kerbs, tarmac run-off, gravel traps, grass, walls, start grid boxes, braking boards and corner names.
- Kerb ends (since 1.11.3): kerbs run along corners on both sides of the track. Each kerb narrows to nothing over its first and last 8 m, instead of ending square. Before, both kerbs ended on the same line across the track and the run-off and gravel edges next to them jumped sideways by the kerb width, which looked like a horizontal cut through the screen. The kerb surface (grip, braking) follows the same narrowing.
- No square ends beside the track (since 1.11.4): run-off areas narrow at their ends, and where gravel meets tarmac run-off, by at most 1.5 m per track point (~2 m). Walls change their distance from the track by at most 1.2 m per track point (before, the walls stepped by up to 4 m at the pit zone). The pit lane entry and exit merge into the track edge over 20 m instead of ending square, and the pit lane never covers the track's white edge line. These square ends caused the same horizontal cut through the screen at the pit exit before Abbey, in live riding and in replay.
- Scenery: grandstands, Wing pit building, garages, trees.
- Bikes: detailed top-down sprites in team livery with rider and number, lean and shadow.
- Effects: tyre marks, smoke, sparks, debris, dust on grass and gravel.
- Sound: synthesised engine (rpm and gear), shifts, impacts, pit.

## 13. Technical design

- Single HTML file; no external code, only Google Fonts (Saira Condensed, Barlow). The built file is ASCII-only so it opens correctly from disk.
- Source in `src/` (`head.html`, `core.js`, `world.js`, `replay.js`, `render.js`, `ui.js`, `track.txt`), joined by `tools/build.py` into `index.html`.
- Performance:
  - static world baked into 512 px tiles of 40 m (LRU cache of 160);
  - device pixel ratio capped at 1.5, dropping to 1 when frames are slow;
  - only dynamic things are drawn each frame;
  - target 60 fps.
- Smooth motion (since 1.11.2): physics runs at 120 Hz, the screen at its own rate. Riders are drawn between the last two physics steps, so the camera does not stutter when the frame clock and the physics drift apart.
- Tests: `node tests/camera_shake.test.js [index.html]` (needs Playwright with Chromium) drives the real game loop with a fake frame clock (about 60 fps with ±1.5 ms jitter) and records the camera every frame.
  - Cases: live riding and replay at 0.25×, 1× and 4×, each with the Behind and Top-down cameras, and since 1.14.0 also with CLOSE.
  - Measured against a 0.4 s moving average (in game time): camera speed, camera turn rate, direction of camera travel, and the bike's position on screen.
  - Limits: speed 2 %, turn rate 0.08 rad/s, direction 0.08 rad/s, screen position 2 px (RMS). The test exits with an error if any case is over.
- Tests: `node tests/tilt_seam.test.js [index.html]` draws a pattern of straight lines through the real Behind camera projection, in live riding and in replay, at 1280×800, 1470×830 (2× pixels) and 1024×700, and fails if a line bends by more than 0.5 px from one screen row to the next (v1.11.4 fails with about 1 px). It also measures how sharp the lines are on each screen row and fails if the sharpness changes by more than 15 % between the 8 px above and the 8 px below any row (since 1.11.6; v1.11.5 fails with a 25 % step where the near and far bands join, v1.11.6 measures 5–6 %). Since 1.13.0 it also runs at 1470×830 (2× pixels) with the Close camera profile (since 1.14.0: the CLOSE camera).
- Tests: `node tests/track_edges.test.js [index.html]` checks that no outline beside the track ends square or jumps sideways between two neighbouring track points (~2 m apart). Limits: kerb width 0.45 m, run-off outer edge 2 m, wall 1.5 m, pit lane edges 1.5 m. Live riding and replay draw the same geometry, so this covers both; the test also draws the pit exit in both modes. v1.11.2 fails the kerb check (68 square ends); v1.11.3 fails run-off, wall and pit lane.
- Tests: `node tests/camera_tuning.test.js [index.html]` checks the Behind camera tuning panel: 12 sliders in the pause menu, values applied, kept after a reload (localStorage), Reset to defaults, hidden with Top-down; since 1.13.0 also the profile list (Close sets its values, a moved slider shows Custom, the profile is kept after a reload, Reset to defaults gives Standard). Since 1.14.0 the profile checks are replaced by CLOSE camera checks: CLOSE can be chosen on the start screen and is remembered after a reload; C cycles Behind → CLOSE → Top-down → Behind (in a session and in replay); CLOSE starts with the Close values (tilt 55, distance 1.8, depth 6, far quality 0.7, …); the panel is shown for CLOSE with its title; values tuned on CLOSE do not change Behind and are kept after a reload (`sgp_cam_close`); Reset to defaults on CLOSE gives the Close values and on Behind the Behind values; an old `sgp_cam` saved with profile Close gives Behind its defaults. The sky check (at most 12 % on a straight at speed, 1470×830 @2×) uses the CLOSE camera. `npm test` runs all tests (needs `npm install` and `npx playwright install chromium` once).

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

See `CHANGELOG.md`. Current: **1.14.0** (CLOSE as its own camera on the start screen).
