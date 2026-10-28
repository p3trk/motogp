# Changelog

## v1.8.0 (2026-10-28)
- Every session is recorded (10 Hz positions plus laps, race start and finish) and kept when it has a timed lap or a race start.
- New menu panel **Recordings & ghosts**: list, export to JSON, import JSON files, delete, and pick up to 4 recordings as ghost opponents.
- `saved_tracks/` folder: Chrome/Edge link it once with **Open saved_tracks folder…**, then **Reload saved_tracks** re-reads it and new sessions are saved into it automatically. Safari/Firefox read it with a folder picker. Over http(s), `saved_tracks/index.json` (made by `tools/index_saved_tracks.py`) loads automatically.
- **Export session** in the pause menu and on the results screen.
- Ghosts: translucent bikes with a GHOST tag and hollow minimap dots, no collisions. In Practice they replay their best lap from the start of each of your timed laps. In races each ghost takes the place of one of the slowest AI riders and counts in positions, gaps, the timing tower and results.

## v1.7.2 (2026-10-28)
- The start-light countdown begins immediately when a race starts or restarts, with no 2.5 s grid wait. The first light is on at once.

## v1.7.1 (2026-10-28)
- Behind camera sits closer at high speed (about 1.3× closer at 300 km/h) for a stronger feel of speed. It still shows about 200 m of road ahead.
- The built game file is now `index.html` (was `motogp.html`).

## v1.7.0 (2026-10-28)
- New default **Behind** camera: a chase view from behind the bike with the track tilted back 40° in perspective, a sky and horizon haze. Corners show up much further down the road while the near track keeps the feel of speed.
- C switches between Behind and Top-down, and the menu has a Camera option again.
- The HUD is drawn on its own layer, and rider name tags follow the perspective.
- Bikes are drawn larger when zoomed out in Behind view. Resolution drops automatically on slow machines.

## v1.6.1 (2026-10-28)
- Corner countdown made compact: the panel is about 250 × 44 px instead of 380 × 74 px, with smaller boards and pictogram.

## v1.6.0 (2026-10-28)
- Corner countdown on the HUD: 300 / 200 / 100 / 50 m marks before every braking corner, with a pictogram of the corner shape, your position, the corner name and the distance.
- Removed the Look-ahead and North-up cameras (the Look-ahead camera lost the feel of speed). Rotating is the only camera; the camera option and the C key are gone.

## v1.5.0 (2026-10-28)
- New default **Look-ahead camera**: the bike sits low on screen, the zoom is based on stopping distance (up to 220 m ahead at top speed), and the view turns towards the track ahead so corners show up early.
- C now cycles through Look-ahead, Rotating and North up. Saved options switch once to the new camera.
- Rotating camera: the bike no longer drops off the bottom of the screen at top speed.
- Bikes are drawn larger when zoomed out. Coarser world tiles keep the zoomed-out view at 60 fps.

## v1.4.0 (2026-10-28)
- Game design document (`docs/GDD.md`), source split into `src/`, `tools/build.py`.
- Speed guide panel moved directly under the lap stopwatch.

## v1.3.0 (2026-10-26)
- Player laps saved between sessions ("Your laps" panel, best per mode, all-time row in practice).
- Practice speed guide option: recommended speed, next braking point, coloured line ahead.

## v1.2.0 (2026-10-25)
- Performance: static world baked into tiles, capped and adaptive pixel ratio, no backdrop blur.

## v1.1.0 (2026-10-25)
- Fixed garbled text when opening the file from disk (ASCII-only build with charset).

## v1.0.0 (2026-10-25)
- First version: Silverstone, 22 riders, practice / 10 laps / GP with qualifying, physics, collisions, damage, fuel and pit stops, automatic transmission.
