# Silverstone GP — Game Design Document

**Version:** 1.6.0 · **Last updated:** 2026-10-28 · **Owner:** Petr

This document is the source of truth for how the game should work. Every
change starts here: update the GDD on a feature branch first, then change the
code to match (see [§14 Change process](#14-change-process)).

---

## 1. Overview

| | |
|---|---|
| Genre | 2D top-down motorcycle racing sim |
| Platform | Desktop browser, single self-contained HTML file (`motogp.html`), keyboard only |
| Track | Silverstone Grand Prix circuit, 5.89 km, 18 turns |
| Player fantasy | Ride a MotoGP prototype around a realistic Silverstone against a full grid, manage fuel and damage, and chase lap records |
| Pillars | Believable physics · readable top-down racing · full race weekend feel · fast to start, nothing to install |

Teams, riders and liveries are **fictional**; no real MotoGP names or branding.

## 2. Game modes

| Mode | Grid | Length | Notes |
|---|---|---|---|
| **Practice** | Player alone | Unlimited | Starts from the pit box. Lap and sector times, pit stops, optional speed guide (§9). Laps are saved (§10). |
| **10 Lap Race** | 22 riders | 10 laps | Player picks the starting slot (pole / front row / mid-pack / back of the grid). |
| **Grand Prix + Qualifying** | 22 riders | Qualifying, then 20 laps | Qualifying: out lap + 3 flying laps, best lap sets the grid. AI quali times are simulated from their pace. Player can end qualifying early from the pause menu. |

Race flow: grid → start lights (the lights label shows the lap count) → race →
chequered flag → results table (positions, gaps, best laps, DNFs).

## 3. Controls

| Key | Action |
|---|---|
| W | Throttle (also leaves the pit box after service) |
| S | Brake |
| A / D | Lean left / right |
| O / L | Shift up / down (ignored in automatic) |
| M | Mute / unmute sound |
| Esc | Pause menu (resume, restart, end qualifying, quit) |

## 4. Options (menu)

Stored in `localStorage` key `sgp_opts`.

| Option | Values | Default |
|---|---|---|
| Transmission | Manual / Automatic | Manual |
| Rider aids (lean limiter + traction control) | On / Off | On |
| AI level | Rookie (0.905) / Pro (0.955) / Legend (0.99) of ideal pace | Pro |
| Speed guide (practice only) | On / Off | On |
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

There is one camera, **Rotating (chase)**. It rotates with the bike's heading,
zooms out with speed and looks ahead along the heading, so the feel of speed is kept.
- Look-ahead is limited so the bike always stays on screen at top speed.
- There is no camera key and no camera option.

Removed in 1.6.0:
- **Look-ahead camera:** its far zoom took away the feel of speed.
- **North-up camera.**

Corners are read early through the corner countdown (§11b) instead.

## 11b. Corner countdown (HUD)

The corner countdown appears in every mode when the player approaches a braking
corner. It uses the same corners that have braking boards on track: any corner
where the ideal speed drops by more than 80 km/h.

- **When:** it appears ~400 m before the corner's braking reference point. It disappears just after the corner entry. It is hidden in the pit lane and while crashed.
- **Where:** top centre, directly under the lap stopwatch (under the speed guide when that is shown). The section name moves below it.
- **Marks:** four board tiles **300 · 200 · 100 · 50**, measured to the same point as the trackside boards.
  - Upcoming tiles are drawn as white boards.
  - The next tile to pass is highlighted and grows as it gets closer.
  - Passed tiles turn dark.
  - A thin bar under the tiles counts down the distance.
- **Pictogram:** a small diagram of the corner's shape, about 250 m of track from just before the 50 board to the exit. It is turned so the approach points up, with an arrow at the exit and a dot for the player's position. It is drawn next to the tiles with the corner name.

## 12. Track and graphics## 12. Track and graphics

- Centreline from the TUMFTM racetrack-database (LGPL-3.0), resampled every ~2 m (5 888 m, 2 944 points); start line at the real finish line.
- Racing line from curvature relaxation; ideal speed profile from forward/backward acceleration passes (ideal lap ≈ 2:08).
- Track: asphalt texture, white lines, red/white kerbs, tarmac run-off, gravel traps, grass, walls, start grid boxes, braking boards and corner names.
- Scenery: grandstands, Wing pit building, garages, trees.
- Bikes: detailed top-down sprites in team livery with rider and number, lean and shadow.
- Effects: tyre marks, smoke, sparks, debris, dust on grass and gravel.
- Sound: synthesised engine (rpm and gear), shifts, impacts, pit.

## 13. Technical design

- Single HTML file; no external code, only Google Fonts (Saira Condensed, Barlow). The built file is ASCII-only so it opens correctly from disk.
- Source in `src/` (`head.html`, `core.js`, `world.js`, `render.js`, `ui.js`, `track.txt`), joined by `tools/build.py` into `motogp.html`.
- Performance:
  - static world baked into 512 px tiles of 40 m (LRU cache of 160);
  - device pixel ratio capped at 1.5, dropping to 1 when frames are slow;
  - only dynamic things are drawn each frame;
  - target 60 fps.

## 14. Change process

1. Create a feature branch from `main`: `git checkout -b feature/<short-name>`.
2. **Update this GDD first** (and bump the version at the top) and commit it.
3. Change the code in `src/`, run `python3 tools/build.py`, test, commit.
4. Add an entry to `CHANGELOG.md`.
5. Merge into `main` with `--no-ff` and tag `vMAJOR.MINOR.PATCH`.
   - MINOR for features.
   - PATCH for fixes.
   - MAJOR for big redesigns.

The repository is local only (no remote push).

## 15. Deviations from real MotoGP (intentional)

- Fictional teams and riders.
- Mid-race refuelling (real MotoGP has no pit refuelling).
- No tyre compound choice, flag-to-flag bike swap, long-lap or track-limits penalties.
- No weather.
- Simplified 2D physics: no suspension and no separate front/rear tyre model.

## 16. Version history

See `CHANGELOG.md`. Current: **1.6.0**.
