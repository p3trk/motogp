# Silverstone GP — Game Design Document

**Version:** 1.11.4 · **Last updated:** 2026-10-28 · **Owner:** Petr

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
| C | Switch camera: Behind ↔ Top-down (§11a) |
| R | Curve training only: back to the training spot at once (§11d) |
| Space, ←/→, ↓/↑, [ ], Tab | Replay viewer only: play/pause, jump 5 s, speed, lap, followed bike (§11e) |
| Esc | Pause menu (resume, restart, end qualifying, quit). In Practice it also shows the Curve training map (§11d) |

## 4. Options (menu)

Stored in `localStorage` key `sgp_opts`.

| Option | Values | Default |
|---|---|---|
| Transmission | Manual / Automatic | Manual |
| Rider aids (lean limiter + traction control) | On / Off | On |
| AI level | Rookie (0.905) / Pro (0.955) / Legend (0.99) of ideal pace | Pro |
| Camera | Behind (tilted) / Top-down | Behind |
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

Two cameras, switched with **C** or in the menu.

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
  - Far band: the rest, up to ~2.6 screen heights, at 0.4 × resolution.
  - Both are projected onto the screen in 3 px horizontal strips, each scaled by the perspective factor.
  - A sky gradient fills the space above the far edge, and haze fades the far ground into it.
  - On slow machines the resolution of both bands drops by a further 20 %.
- **Tuning:** the tilt is **40°** with a camera distance of 1.3 × screen height. The plane is 2.3 × screen width and 2.6 × screen height.

**Top-down (Rotating)**
- The pre-1.7 camera. Top-down, rotates with the bike's heading, zooms out with speed and looks ahead along the heading.
- Look-ahead is limited so the bike always stays on screen at top speed.

**Removed in 1.6.0**
- Look-ahead camera: its far zoom took away the feel of speed.
- North-up camera.

The corner countdown (§11b) works with both cameras.

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
- The normal cameras (Behind / Top-down, C to switch) follow the followed bike.
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
  - Cases: live riding and replay at 0.25×, 1× and 4×, each with the Behind and Top-down cameras.
  - Measured against a 0.4 s moving average (in game time): camera speed, camera turn rate, direction of camera travel, and the bike's position on screen.
  - Limits: speed 2 %, turn rate 0.08 rad/s, direction 0.08 rad/s, screen position 2 px (RMS). The test exits with an error if any case is over.
- Tests: `node tests/track_edges.test.js [index.html]` checks that no outline beside the track ends square or jumps sideways between two neighbouring track points (~2 m apart). Limits: kerb width 0.45 m, run-off outer edge 2 m, wall 1.5 m, pit lane edges 1.5 m. Live riding and replay draw the same geometry, so this covers both; the test also draws the pit exit in both modes. v1.11.2 fails the kerb check (68 square ends); v1.11.3 fails run-off, wall and pit lane.

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

See `CHANGELOG.md`. Current: **1.11.4**.
