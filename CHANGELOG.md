# Changelog

## v1.14.0 (2026-10-28)
- CLOSE is its own camera: the start screen Camera option has Behind / CLOSE / Top-down, and the choice is remembered after a reload for all three (before, only Top-down was kept). C switches Behind → CLOSE → Top-down → Behind in a session and in replay (also the replay Camera button) and updates the start-screen option. A replay opened from the start screen starts with the start-screen camera; from the pause menu or results it keeps the camera in use.
- Camera tuning per camera: the pause-menu panel is titled "Camera tuning (Behind)" or "Camera tuning (CLOSE)" and edits only that camera; C in the pause menu switches the panel (hidden for Top-down). Behind is saved in `sgp_cam`, CLOSE in `sgp_cam_close`; Reset to defaults resets only the current camera. CLOSE starts with the 1.13.1 Close values.
- The Profile list (Standard / Close / Custom) is gone. An old `sgp_cam` saved with the Close profile unchanged gives Behind its defaults; other saved values stay with Behind. The slow-machine quality drop applies to both tilted cameras.
- Tests: `camera_shake` also runs with CLOSE (12 cases), `tilt_seam` uses the CLOSE camera at 1470×830 @2x, `camera_tuning` checks CLOSE instead of the profiles.

## v1.13.1 (2026-10-28)
- Close camera sees further with much less sky: tilt 55° (was 60°), distance 1.8 × screen height (was 1.6), ground depth 6 × screen (was 5.5), far image 0.7 (was 0.6, keeps the near-to-far hand-over smooth at the lower tilt). Sky goes from about 31 % to about 8 % of the screen at 1470×830, the ground reaches about 10 % further ahead and the bike is about 20 % longer on screen (same zoom). `tests/camera_tuning.test.js` also checks that the Close sky is at most 12 % of the screen on a straight (16 checks).

## v1.13.0 (2026-10-28)
- Camera profiles: the Camera tuning panel (pause menu, Behind camera) has a Profile list, Standard (the 1.12.0 defaults) and Close. A profile sets all sliders; moving a slider afterwards shows Custom. The profile is saved with the other settings, and settings saved by 1.12.0 still load. Reset to defaults = Standard.
- Close camera, closer to what a rider sees: tilt 60°, distance 1.6 × screen height, bike 8 % above the bottom edge, zoom 30 px/m max / 12 m base / 0.4 speed factor, ground 3.5 × 5.5 screens, near image 1.5 and far image 0.6. On Retina screens, near quality above 1.0 now really draws the tilted view with more pixels. The horizon sits about a third of the way down the screen.
- Wider slider ranges: tilt up to 70°, distance from 0.5, bike height from 5 %, near quality up to 2.0, ground depth up to 6, zoom base from 10 m, zoom speed factor from 0.3.
- Tests: `tests/camera_tuning.test.js` also checks the profiles (15 checks). `tests/tilt_seam.test.js` also runs with the Close profile at 1470×830 @2x.
## v1.12.0 (2026-10-28)
- Behind camera tuning: with the Behind camera, the pause menu has a Camera tuning panel with a slider and number for every setting in GDD 11a (tilt, distance, bike height, zoom, ground area, image quality, minimum bike length), Reset to defaults, saved in the browser.

## v1.11.6 (2026-10-28)
- Behind camera: the upper part of the picture is no longer suddenly blurrier than the lower part. The sharper near image fades into the far image over a band instead of switching on one row, and the far image has a little more resolution (0.45 instead of 0.4).
- `tests/tilt_seam.test.js` also checks for a step in sharpness (live and replay, three screen sizes). v1.11.5 fails it with a 25 % step; v1.11.6 passes (5–6 %).

## v1.11.5 (2026-10-28)
- Behind camera: the tilted view is drawn one screen row at a time instead of in 3 px strips. Track edges and kerbs no longer show small steps and a kink across the screen (live and replay).
- New automated test `tests/tilt_seam.test.js`: straight lines through the Behind camera projection must stay straight (live and replay, three screen sizes). v1.11.4 fails it; v1.11.5 passes.

## v1.11.4 (2026-10-28)
- No more horizontal cut at the pit exit before Abbey (live and replay): the pit lane entry and exit merge into the track edge over 20 m, run-off areas narrow gradually at their ends, and walls no longer step by up to 4 m at the pit zone.
- `tests/kerb_ends.test.js` became `tests/track_edges.test.js`: it now also checks run-off, walls and the pit lane ends. v1.11.3 fails it; v1.11.4 passes.

## v1.11.3 (2026-10-28)
- Kerbs narrow to nothing over their first and last 8 m instead of ending square, so kerb ends (and the gravel and run-off edges next to them) no longer look like a horizontal cut across the screen.
- New automated test `tests/kerb_ends.test.js`: fails if any kerb ends square (v1.11.2 had 68 such ends).

## v1.11.2 (2026-10-28)
- Replay no longer shakes: the replayed path is a smooth curve through the recorded samples, and new recordings take their samples exactly every 0.1 s.
- Live riding: riders are drawn between physics steps, which removes a small stutter of the Behind camera when the frame rate and the 120 Hz physics drift apart.
- New automated test `tests/camera_shake.test.js` for camera shake in live riding and replay (0.25×, 1×, 4×), Behind and Top-down cameras. v1.11.1 failed 4 of 8 cases; v1.11.2 passes all 8.

## v1.11.1 (2026-10-28)
- Replay: the Play/Pause button works reliably (the labels are no longer rewritten every frame, which could swallow clicks in Safari).
- Replay: new **1×** button, and clicking the speed readout, return to normal speed.
- Replay: after using the Align list, Space and the arrow keys control the replay again.

## v1.11.0 (2026-10-28)
- **Session replay**: a Replay button on every recording, plus Watch replay on the results screen and in the pause menu.
- Timeline along the bottom: drag to jump, lap marks (best lap in purple), play/pause, rewind 1–8×, slow motion 0.25× / 0.5×, fast forward 2–8×, previous / next lap, camera switch.
- **Compare**: tick up to 6 recordings and replay them together. Align them by best lap (default), lap N or session start. A gap panel shows each bike's live gap to the reference; Tab switches the followed bike.
- Keys in the replay: Space, arrows, [ ], Tab, C, Esc.

## v1.10.0 (2026-10-28)
- Curve training is On by default (older saved options switch to On once).
- In Practice the pause menu (Esc) shows the Curve training toggle, map, corner list and speed. **Go to spot** puts you on the new spot at once; Resume keeps riding and the change applies from the next restart or R.

## v1.9.1 (2026-10-28)
- Recordings are kept in `localStorage` (key `sgp_sessions`): the last 10 sessions, the oldest dropped automatically. A compact encoding makes a 20-lap race about 0.4 MB.
- Sessions from the old IndexedDB library are moved over once (newest 10).
- Imported and `saved_tracks/` files are loaded for the current visit only. Every row in the list keeps its own Export button.

## v1.9.0 (2026-10-28)
- **Curve training** (Practice only): pick a start spot on a clickable track map or from the corner list (350 m before the braking zone), and a start speed of 0–300 km/h (or the guide speed).
- The bike starts in the centre of the road at that speed in the right gear, with warm tyres, and waits until you press W, S, A or D.
- Restart session and the new **R** key put you back on the same spot at the same speed at once.

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
