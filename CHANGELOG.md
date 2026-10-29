# Changelog

## v1.19.7 (2026-10-29)
- Fix: on iPhone browsers, including Brave, holding or double-tapping the brake and throttle halves no longer selects text, shows the magnifier or zooms the page, during play or in replay. The touch layer now cancels the touch events themselves; iPhone WebKit ignored the cancelled pointer press. Text selection and the long-press menu are blocked while playing (GDD 3a).
- Tests: tests/mobile_controls.test.js checks that the touch events are cancelled and the brake still works. The iPhone behaviour itself still needs a check on a phone.

## v1.19.6 (2026-10-29)
- The version number shows next to the menu title (GDD 11). It is read from the newest heading in this file when `tools/build.py` writes `index.html`, so it always matches the changelog. Not shown during play, pause or results.
- Tests: tests/menu_version.test.js checks the menu label against this file; it is in `npm test`.

## v1.19.5 (2026-10-29)
- Fix: on iPhone browsers, including Brave, a double tap on a menu, the pause screen or the results screen no longer zooms the page, and text on the page can no longer be selected by a press or long press. Form fields keep their selection (GDD 3a, §16).
- Tests: tests/mobile_controls.test.js checks the menu overlay and the page body for these rules.

## v1.19.4 (2026-10-29)
- Fix: the race result table lists riders a lap down below every rider on the lead lap. Before, a lapped rider who crossed the line after the chequered flag could be listed above a lead-lap rider still on the last lap, so a "+1 lap" row came before a "+NN.MMM" row (GDD 11, §16). Finishers are now ranked by laps completed first, then by the order they crossed the line.
- Tests: tests/race_result_order.test.js checks the ranking with a lapped rider crossing first; it is in `npm test`.

## v1.19.3 (2026-10-29)
- Phones: the browser no longer zooms the page when you press the throttle or brake halves. Pinch zoom and double-tap zoom are off (viewport setting in the build, touch rules on the game and the menus, and a block on the iPhone pinch gesture). Menus still scroll with a finger.
- Tests: tests/mobile_controls.test.js checks the viewport setting and the touch rule on the game.

## v1.19.2 (2026-10-28)
- Tilt lean on phones (GDD 3a): the dead zone is 12 degrees (was 8).
- Tilt sensitivity: Very low (full lean at 75 degrees), Low (60 degrees, default), High (35 degrees). The Normal option is removed.
- Tests: the tilt check in tests/mobile_controls.test.js uses 45 degrees with the Low setting.

## v1.19.1 (2026-10-28)
- Tilt lean on phones (GDD 3a): the dead zone is 8 degrees (was 3), so the bike stays straight until the phone is turned past 8 degrees, and then leans smoothly.
- Tilt sensitivity has a new Very low option (full lean at 60 degrees). The default is Low (45 degrees) instead of Normal (35 degrees). Settings saved before this version keep their saved choice.
- Tests: the tilt check in tests/mobile_controls.test.js uses the Low setting.

## v1.19.0 (2026-10-28)
- Phone HUD (GDD 11g): on phones (touch controls on) the HUD is compacted. The fuel, engine, aero and chassis panel at the bottom right is removed; the status tags (pit limiter, slipstream, cold tyres, no fuel, over-rev) move to the right above it.
- Speedometer at the bottom left is smaller: speed, gear, rpm bar, and a lean bar with the angle. The brake and gas bars are removed.
- Lap stopwatch moved to the top left and made compact: position and lap, the lap time with the delta to the best lap, last and best lap. Sectors are not shown on phones.
- Next corner countdown moved to the top centre, with the corner name and the race gaps under it.
- Speed guide panel removed on phones. The coloured line on the track stays.
- The "Your laps" list is removed from the HUD in practice on phones. Qualifying keeps its timing list.
- Race timing tower sits under the stopwatch with shorter rows; the minimap is about 140 px on phones.
- Fuel warning on phones: centre message "3 LAPS LEFT" and "1 LAP LEFT".
- Desktop HUD is unchanged.
- Tests: `npm test` passes. The phone layout was checked on screenshots, not on a real phone.

## v1.18.0 (2026-10-28)
- Mobile controls (GDD 3a): on a phone or tablet with a touch screen, the left half of the screen brakes and the right half throttles. If both are pressed, brake wins. Lean follows the phone's roll angle in landscape: turning the phone like a steering wheel leans the bike the same way. A 3 degree dead zone, and the zero point is set at each start.
- Phones always use the automatic gearbox; the Transmission option is hidden there.
- Options on the start screen: Controls (Auto / Touch / Keyboard), Left side of the screen (Brake / Throttle), Tilt sensitivity (Low 45 / Normal 35 / High 25 degrees). Re-centre tilt in the pause menu.
- Pause button at the bottom centre during play; in replay the left and right thirds seek 5 s and the middle third plays or pauses.
- Portrait: the game shows "Turn your phone sideways" and pauses until the phone is turned.
- Keyboard play is unchanged. Motion access on iPhone is asked for at the Go tap.
- Tests: new `tests/mobile_controls.test.js` (in `npm test`) checks the phone menu, automatic gearbox, both halves, brake wins, swapped sides, tilt dead zone and lean, re-centre, portrait prompt, and the desktop menu.
- Not yet checked on a real phone: the tilt direction and the landscape angle mapping, iPhone motion permission, and HTTPS access. The test fakes motion events.

## v1.17.0 (2026-10-28)
- Speed blur: close to top speed the surroundings (grass, gravel, run-off, pit lane, walls, boards, trees, grandstands, buildings, smoke and dust) smear into zoom streaks running outward from the horizon point straight ahead, in the Behind and CLOSE cameras only. Strength fades in from 260 km/h and is full from 330 km/h, so braking zones and corners stay sharp. The road stays sharp with its borders (asphalt, white lines, kerbs, grid boxes, painted names, tyre marks, up to 0.3 m beyond the kerb), and so do the bike, ghosts and other riders, also off the road. Top-down is never blurred.
- In replay the blur follows the followed bike's recorded speed, also paused and in slow motion.
- Built cheaply on a 1/4 resolution copy of the screen (three zoomed copies, road and bikes cut out, drawn back with the strength as alpha); no `ctx.filter`. Switched off for the session when the slow-machine quality drop lowers the tilted image quality.
- Speed blur On / Off on the start screen (default On, saved in `sgp_opts`). Camera tuning has three more sliders per camera: Blur start speed (260), Blur full speed (330, kept at least 10 km/h above the start) and Blur strength (Behind 20 px, CLOSE 24 px; 0 turns it off for that camera). Older saved camera values get these defaults.
- Tests: new `tests/speed_blur.test.js` (in `npm test`); `tilt_seam` and `camera_shake` run with Speed blur Off; `camera_tuning` expects 15 sliders and checks the blur sliders per camera, their 10 km/h link and Reset.

## v1.16.0 (2026-10-28)
- Practice starts on the grid: with Curve training Off the bike stands on the slot chosen with Starting position (Pole / Front row / Mid-pack / Back, one setting shared with the 10 lap race, shown for Practice only with Curve training Off), exactly where it stands in the race. No start lights; the bike is held until the first W, S, A or D press, and lap 1 is a timed standing-start lap from that moment (saved like any lap). The pit box still works for refuelling. Qualifying still starts from the box.
- R works in all practice: back to the grid slot, or to the training spot with Curve training On; Restart session does the same.
- Ghosts start with the player. A standing-start recording (a race, or a 1.16.0 practice grid start) stands on its own grid slot and launches at the first input, with the lights and reaction time cut, then plays the whole recording (its laps shown in the timing tower) and disappears at its end. Other recordings wait for the first line crossing on a grid start.
- Curve training: the reference ghost stands on the spot with the player and both start at the first input; other ghosts are placed by lap time relative to it. The start message names the reference ghost's speed at the spot. This replaces the 1.15.0 rule (no ghost before the line).
- Choosing the reference: Sync button on Ghost rows in Recordings (saved in `sgp_ghost_sync`) and a Sync ghosts to list in the practice pause menu with 2 or more ghosts. R, Restart and Go to spot re-sync all ghosts.
- Recordings have an optional `start` field (`grid` / `spot` / `box`, start moment, slot or spot); files without it still load (a race with lights out reads as a grid start, anything else as a box start).
- Tests: new `tests/practice_start.test.js` (25 checks, in `npm test`); `practice_ghosts` now checks a ghost without a standing start from the first line crossing on a grid start; tests that recorded a lap from the pit box now use qualifying (still box start).

## v1.15.0 (2026-10-28)
- Ghosts in curve training: selected ghosts now ride with you once you cross the line and start a normal timed lap, starting with that lap as in practice. They are not shown while riding from the training spot to the line, and R hides them again until the next timed lap. The Recordings panel hint says so.
- GDD: the minimap ring that marks your own pit box (team colour, blinks every 0.3 s) is now documented.
- New test `tests/practice_ghosts.test.js` (in `npm test`): with Curve training On no ghost before the line and a ghost on the first timed lap; with Curve training Off as before. v1.14.0 fails it.

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
