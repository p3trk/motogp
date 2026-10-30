// Unit tests for src/ui.js (GDD 13b): HUD state and drawing, speed guide, corner countdown, sound, input, touch and
// tilt, menus, replay bar, results, main loop and boot. HUD drawing is checked on a recording canvas: what is drawn,
// and that every text and panel is inside the screen.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, makeCtx, makeRec, ops, texts, placeAt } = require('./load');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const rec = G => { const c = makeCtx({ width: G.VW, height: G.VH }); G.ctx = c; return c; };
function play(kind, lo, extra) {
  const g = load(lo); g.G.UI.opts.train = 'off'; g.G.UI.launch(kind, extra || {});
  return Object.assign(g, { W: g.G.W, b: g.G.W.player, T: g.G.T, $: id => g.env.doc.getElementById(id) });
}
// every text, rectangle and arc of a HUD drawing is on the screen (css px)
function inScreen(G, c) {
  const bad = [];
  for (const o of c.calls) {
    if (o[0] === 'fillText' && (o[2] < 0 || o[2] > G.VW || o[3] < 0 || o[3] > G.VH)) bad.push(o.slice(0, 4));
    if ((o[0] === 'fillRect' || o[0] === 'roundRect') && (o[1] < -3 || o[2] < -3 || o[1] + o[3] > G.VW + 3 || o[2] + o[4] > G.VH + 3)) bad.push(o.slice(0, 5));
  }
  assert.deepEqual(bad, [], 'drawn outside the screen');
}
const curve = (G, name) => G.T.corners.find(c => c.name === name);

// --- HUD state -------------------------------------------------------------
test('HUD.reset, HUD.msg, HUD.ticker, HUD.sector, HUD.lap: HUD state', () => {
  const { G } = load(); const H = G.HUD;
  H.msg('A', 'b', '#fff', 2, true); assert.deepEqual({ ...H.m }, { t: 'A', sub: 'b', col: '#fff', dur: 2, age: 0, hold: true });
  for (const t of ['1', '2', '3', '4']) H.ticker(t); assert.deepEqual(H.tick.map(q => q.t), ['4', '3', '2']);
  H.sector(1, 40, 41); assert.equal(H.secFlash[1].pb, true); H.sector(0, 42, 41); assert.equal(H.secFlash[0].pb, false); H.sector(2, 42, 0); assert.equal(H.secFlash[2].pb, true);
  H.lap(130, true, false, false); assert.equal(H.lapFlash.t, 130);
  H.shake = 1; H.reset(); assert.equal(H.m, null); assert.equal(H.tick.length, 0); assert.equal(H.lapFlash, null); assert.equal(H.shake, 0);
});
test('HUD.step: messages and flashes age out; a held message waits for the first input', () => {
  const { G, b } = play('practice'); const H = G.HUD;
  H.msg('X', '', '#fff', 2, true); b.trainHold = true; for (let k = 0; k < 10; k++) H.step(0.5); assert.ok(H.m, 'held');
  b.trainHold = false; H.step(1.5); assert.equal(H.m, null);
  H.ticker('t'); H.lap(1, false, false, false); H.shake = 1; H.step(5.5); assert.equal(H.lapFlash, null); assert.equal(H.shake, 0); H.step(1); assert.equal(H.tick.length, 0);
});
test('panel, txt: HUD panels and text', () => {
  const { G } = load(); const c = rec(G);
  G.panel(1, 2, 30, 40); assert.deepEqual(ops(c, 'roundRect')[0].slice(1), [1, 2, 30, 40, 6]); assert.equal(c.calls.find(o => o[0] === '=fillStyle')[1], 'rgba(9,13,16,0.8)');
  G.txt('Hi', 5, 6, 12, '#abc', 600, 'right', true);
  assert.equal(c.font, 'italic 600 12px ' + G.FD); assert.equal(c.textAlign, 'right'); assert.deepEqual(ops(c, 'fillText')[0].slice(1), ['Hi', 5, 6]);
});
test('buildMinimap: the track map fits the 190 px square', () => {
  const { G } = load(); const M = G.HUD.mini, bb = G.T.bbox;
  assert.equal(M.S, 190); assert.equal(M.c.width, 380);
  for (const [x, y] of [M.tf(bb.minx, bb.miny), M.tf(bb.maxx, bb.maxy)]) assert.ok(x >= 9.99 && x <= 180.01 && y >= 9.99 && y <= 180.01);
});
test('drawTags: pit limiter, slipstream, cold tyres, no fuel, over-rev', () => {
  const { G, b } = play('practice'); G.W.phase = 'run';
  Object.assign(b, { limiter: true, draft: 0.5, dist: 0, fuel: 0, overrev: 1 }); const c = rec(G);
  G.drawTags(b, 100, 500, 200);
  assert.deepEqual(texts(c), ['PIT LIMITER', 'SLIPSTREAM', 'COLD TYRES', 'NO FUEL', 'OVER-REV BLOCKED']);
  Object.assign(b, { limiter: false, draft: 0, dist: 5000, fuel: 5, overrev: 0 }); const d = rec(G); G.drawTags(b, 100, 500, 200); assert.equal(texts(d).length, 0);
});
test('fuelWarn: phone fuel messages at 3 laps and 1 lap left, once each', () => {
  const { G, b } = play('practice'); b.fuelPerLap = 1;
  b.fuel = 2.5; G.fuelWarn(b); assert.equal(G.HUD.m.sub, '3 LAPS LEFT');
  G.HUD.m = null; G.fuelWarn(b); assert.equal(G.HUD.m, null, 'only once');
  b.fuel = 0.6; G.fuelWarn(b); assert.equal(G.HUD.m.sub, '0.6 LAP LEFT');
  b.fuel = 20; G.fuelWarn(b); assert.equal(b.fuelWarned.three, false, 'reset after a restart');
});

// --- HUD drawing -----------------------------------------------------------
test('drawPhoneDash: speed, gear, lean and slide on the phone dashboard', () => {
  const { G, b } = play('practice', { width: 844, height: 390 });
  Object.assign(b, { v: 50, gear: 4, lean: 0.5, slip: 0.1, rpmVis: 18000 }); const c = rec(G);
  G.drawPhoneDash(b); const t = texts(c);
  assert.ok(t.includes('180') && t.includes('4') && t.includes('29°') && t.includes('SLIDE') && t.includes('KM/H')); inScreen(G, c);
});
test('drawPhoneTop: lap clock, next corner and lap flash on phones', () => {
  const { G, b, W } = play('quali', { width: 844, height: 390 }); const c = rec(G);
  G.drawPhoneTop(b, G.standings(), 1); assert.ok(texts(c).includes('OUT LAP'));
  b.outLap = false; b.lapStartT = 0; W.time = 65.5; G.HUD.lap(130, true, true, false); const d = rec(G);
  G.drawPhoneTop(b, G.standings(), 1); const t = texts(d);
  assert.ok(t.includes('LAP 1/3') && t.includes('1:05.500') && t.includes('NEW ALL-TIME BEST  2:10.000')); inScreen(G, d);
  const r = play('sprint', { width: 844, height: 390 }); r.b.pen = 2; const e = rec(r.G); r.G.drawPhoneTop(r.b, r.G.standings(), 12);
  assert.ok(texts(e).includes('P12  LAP 1/10') && texts(e).includes('PEN +2.0'));
});
test('drawHUD: practice dashboard, fuel panel, timing, corner name, lap list', () => {
  const { G, b } = play('practice'); const c = rec(G); G.drawHUD(1 / 60); const t = texts(c);
  for (const s of ['PRACTICE', 'KM/H', 'FUEL', 'ENGINE', 'YOUR LAPS', 'LAP 1', '22.0 L']) assert.ok(t.includes(s), s);
  assert.ok(t.some(x => x.startsWith('Press W, S, A or D to go')), 'grid hold hint'); inScreen(G, c);
});
test('drawHUD: race position, start lights, pit stop panel and messages', () => {
  const { G, b, W } = play('sprint'); const c = rec(G); G.drawHUD(1 / 60); const t = texts(c);
  assert.ok(t.includes('/22') && t.includes('10 LAPS · BRITISH GRAND PRIX') && t.includes('1/10')); inScreen(G, c);
  W.phase = 'run'; b.service = true; b.serviceT = 2.34; G.HUD.msg('BOX', 'sub', '#fff', 2); G.HUD.m.age = 1; const d = rec(G); G.drawHUD(1 / 60);
  assert.ok(texts(d).includes('PIT STOP') && texts(d).includes('2.3 s') && texts(d).includes('BOX')); inScreen(G, d);
});
test('drawHUD: wrong way after a second, name tags for riders nearby', () => {
  const { G, b, W, T } = play('sprint'); W.phase = 'run'; for (const x of W.bikes) x.held = false;
  const o = W.bikes[1]; placeAt(G, b, 800, 0); placeAt(G, o, 820, 0); G.updateCamera(0.01);
  b.h += Math.PI; b.v = 10; let c; for (let k = 0; k < 70; k++) { c = rec(G); G.drawHUD(1 / 60); }
  assert.ok(texts(c).includes('WRONG WAY')); assert.ok(texts(c).includes('#' + o.num + ' ' + o.short), 'name tag');
});
test('drawHUD: phones get the phone dashboard and no fuel panel', () => {
  const { G } = play('practice', { width: 844, height: 390, coarse: true }); G.Touch.sync(); const c = rec(G); G.drawHUD(1 / 60);
  assert.ok(!texts(c).includes('FUEL')); assert.ok(texts(c).includes('KM/H')); inScreen(G, c);
});
test('drawReplayHUD: gap panel, followed rider, speed and lean', () => {
  const g = load(); const { G } = g; G.RP.open([makeRec(G, { id: 'a', laps: 2 }), makeRec(G, { id: 'b', v: 55, laps: 2 })], 'menu');
  G.RP.seek(30); G.updateCamera(0.01); const c = rec(G); G.drawReplayHUD(); const t = texts(c);
  assert.ok(t.includes('REPLAY · BEST LAPS') && t.includes('REF') && t.includes('#7 GHOST RIDER') && t.includes('LAP 1')); inScreen(G, c);
});

// --- speed guide and corner countdown ----------------------------------------
test('guideSpeed: 96 % of the ideal speed', () => {
  const { G } = load(); near(G.guideSpeed(123), G.T.VP[123] * 0.96, 1e-12);
});
test('nextBrake: the next apex slower than the bike, null when there is none', () => {
  const { G, b } = play('practice'); const st = curve(G, 'Stowe');
  placeAt(G, b, st.s - 300, 0); b.v = 85; const nb = G.nextBrake(b);
  assert.ok(nb && nb.dist > 100 && nb.dist < 520 && nb.v < 85 - 3); assert.equal(G.T.cornerAt(nb.k * G.T.DS), 'Stowe');
  b.v = 0; assert.equal(G.nextBrake(b), null);
});
test('cornerAhead: the braking zone within 400 m', () => {
  const { G, b } = play('practice'); const z = G.T.zones[3];
  b.s = G.T.wrapS(z.zi * G.T.DS - 100); const c = G.cornerAhead(b); assert.equal(c.z, z); near(c.d, 100, 1e-6);
  b.s = G.T.wrapS(z.zi * G.T.DS + 50); assert.notEqual(G.cornerAhead(b)?.z, z);
});
test('cornerShape: the corner pictogram, cached on the zone', () => {
  const { G } = load(); const z = G.T.zones[0]; const S = G.cornerShape(z);
  assert.equal(G.cornerShape(z), S); assert.equal(S.pts.length, Math.floor(S.n / 2) + 1); assert.ok(S.x1 > S.x0 && S.y1 > S.y0); near(S.pts[0][0], 0, 1e-9);
  assert.equal(S.name, G.T.cornerAt(z.k * G.T.DS));
});
test('drawCountdown: marks 300 to 50, distance and turn in', () => {
  const { G, b } = play('practice'); const z = G.T.zones[2]; let c = rec(G);
  G.drawCountdown(b, { z, d: 180 }, 100, 100, 250); assert.ok(['300', '200', '100', '50', '180 m'].every(s => texts(c).includes(s)));
  c = rec(G); G.drawCountdown(b, { z, d: -5 }, 100, 100, 250); assert.ok(texts(c).includes('TURN IN'));
});
test('drawGuide: recommended speed and where to brake', () => {
  const { G, b } = play('practice'); const st = curve(G, 'Stowe');
  placeAt(G, b, st.s - 300, 0); b.v = 85; let c = rec(G); G.drawGuide(b, 100, 100, 380);
  assert.ok(texts(c).includes('RECOMMENDED') && texts(c).some(s => /^Brake in \d+ m · Stowe/.test(s)));
  placeAt(G, b, st.s - 120, 0); b.v = 85; c = rec(G); G.drawGuide(b, 100, 100, 380); assert.ok(texts(c).some(s => s.startsWith('BRAKE NOW')));
  b.v = 0; c = rec(G); G.drawGuide(b, 100, 100, 380); assert.ok(texts(c).includes('Full throttle'));
});
test('drawTower: race order, qualifying times, practice laps; none on phones in practice', () => {
  const r = play('sprint'); let c = rec(r.G); r.G.drawTower(r.G.standings(), r.b);
  assert.ok(texts(r.G.ctx).includes('LAP 1/10') && texts(c).includes('Leader'));
  const q = play('quali'); c = rec(q.G); q.G.drawTower([], q.b); assert.ok(texts(c).includes('QUALIFYING') && texts(c).includes('NO TIME'));
  const p = play('practice'); p.b.laps = [131, 129]; p.b.lapsInv = [true, false]; p.b.bestLap = 129; c = rec(p.G); p.G.drawTower([], p.b);
  assert.ok(texts(c).includes('LAP 1 INV') && texts(c).includes('2:09.000'));
  p.G.Touch.on = true; c = rec(p.G); p.G.drawTower([], p.b); assert.equal(c.calls.length, 0);
});
test('penCell: penalties in the results', () => {
  const { G } = load(); assert.equal(G.penCell({}), '');
  assert.equal(G.penCell({ pen: 2, llGiven: 1, dropBehind: {}, dropPen: 0.3 }), '+2.0 s · 1 LL · −1 pos');
});
test('drawLongLapBoard: shown above the dashboard while a Long Lap is pending', () => {
  const { G, b } = play('sprint'); let c = rec(G); G.drawLongLapBoard(b, 600); assert.equal(c.calls.length, 0);
  b.llPend = [{ until: 2 }, { until: 4 }]; b.lap = 1; c = rec(G); G.drawLongLapBoard(b, 600);
  assert.deepEqual(texts(c), ['LONG LAP ×2', 'Stowe · 1 lap left']);
});
test('drawMinimap: map, every rider and the ghosts', () => {
  const { G, W, b } = play('sprint'); const c = rec(G); G.drawMinimap(b);
  assert.ok(ops(c, 'drawImage').some(o => o[1] === G.HUD.mini.c)); assert.ok(ops(c, 'arc').length >= W.bikes.length);
});

// --- sound -----------------------------------------------------------------
function fakeAudio() {
  const made = [];
  const param = v => ({ value: v, setTargetAtTime(x) { this.last = x; }, setValueAtTime(x) { this.last = x; }, exponentialRampToValueAtTime() { } });
  const node = o => Object.assign({ connect() { }, start() { }, stop() { } }, o);
  class AC {
    constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; this.resumed = 0; made.push(this); }
    createGain() { return node({ gain: param(1) }); } createOscillator() { return node({ frequency: param(440) }); }
    createBiquadFilter() { return node({ frequency: param(350), Q: param(1) }); }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; } createBufferSource() { return node({}); } resume() { this.resumed++; }
  }
  return { AC, made };
}
test('Sound.start, Sound.update, Sound.hit, Sound.pit: engine follows the rpm, effects play', () => {
  const A = fakeAudio(); const { G, b } = play('practice', { window: {} });
  G.window.AudioContext = A.AC; G.Sound.start(); assert.ok(G.Sound.ac); G.Sound.start(); assert.equal(A.made[0].resumed, 1, 'second start resumes');
  b.rpmVis = 12000; b.ctl.thr = 1; G.Sound.update(b); assert.equal(G.Sound.n.o1.frequency.last, 400); assert.equal(G.Sound.master.gain.last, 0.45);
  G.W.paused = true; G.Sound.update(b); assert.equal(G.Sound.master.gain.last, 0);
  G.Sound.hit(1); G.Sound.pit(); G.Sound.on = false; G.Sound.hit(1);
  const n = play('practice').G; n.Sound.update(n.W.player); n.Sound.hit(1); n.Sound.pit(); // no audio: nothing happens
});

// --- input -----------------------------------------------------------------
test('camCycle: Behind, CLOSE, Top-down, Behind; remembered on the start screen', () => {
  const { G } = play('practice'); G.setCamMode('behind');
  G.camCycle(); assert.equal(G.CAM.mode, 'close'); assert.equal(G.UI.opts.cam, 'close'); assert.equal(G.HUD.m.sub, 'CLOSE');
  G.camCycle(); assert.equal(G.CAM.mode, 'chase'); G.camCycle(); assert.equal(G.CAM.mode, 'behind');
});
test('keys in play: manual shifts, camera, pause, restart and mute', () => {
  const { G, env, b } = play('practice'); b.auto = false; b.gear = 2; b.v = 20;
  env.fireWin('keydown', { code: 'KeyO' }); assert.equal(b.gear, 3); env.fireWin('keydown', { code: 'KeyL' }); assert.equal(b.gear, 2);
  assert.equal(env.fireWin('keydown', { code: 'KeyW' }).defaultPrevented, true); assert.equal(G.Input.k.KeyW, true);
  env.fireWin('keyup', { code: 'KeyW' }); assert.equal(G.Input.k.KeyW, false);
  env.fireWin('keydown', { code: 'KeyC' }); assert.equal(G.CAM.mode, 'close');
  env.fireWin('keydown', { code: 'KeyM' }); assert.equal(G.Sound.on, false);
  const w = G.W.player; env.fireWin('keydown', { code: 'KeyR' }); assert.notEqual(G.W.player, w, 'R restarts practice');
  env.fireWin('keydown', { code: 'Escape' }); assert.equal(G.W.paused, true);
  env.fireWin('keydown', { code: 'KeyW', target: { tagName: 'INPUT' } }); assert.notEqual(G.Input.k.KeyW, true, 'typing in a field');
});
test('keys in replay: play, seek, speed, laps, follow, camera and exit', () => {
  const { G, env } = load(); G.RP.open([makeRec(G, { laps: 2 }), makeRec(G, { id: 'b', v: 50, laps: 2 })], 'menu'); const RP = G.RP; RP.setAlign('start');
  env.fireWin('keydown', { code: 'Space' }); assert.equal(RP.playing, false);
  env.fireWin('keydown', { code: 'ArrowRight' }); assert.equal(RP.t, 5); env.fireWin('keydown', { code: 'ArrowLeft' }); assert.equal(RP.t, 0);
  env.fireWin('keydown', { code: 'ArrowUp' }); assert.equal(RP.speed, 2); env.fireWin('keydown', { code: 'ArrowDown' }); assert.equal(RP.speed, 1);
  env.fireWin('keydown', { code: 'BracketRight' }); assert.ok(RP.t > 0); env.fireWin('keydown', { code: 'Tab' }); assert.equal(RP.follow, 1);
  env.fireWin('keydown', { code: 'KeyC' }); assert.equal(G.CAM.mode, 'close');
  assert.equal(env.fireWin('keydown', { code: 'KeyQ' }).defaultPrevented, false);
  env.fireWin('keydown', { code: 'Escape' }); assert.equal(G.UI.state, 'menu');
});
test('window blur and gestures: keys cleared and paused; pinch zoom cancelled', () => {
  const { G, env } = play('practice'); G.Input.k.KeyW = true; G.Touch.pts.set(1, 'gas');
  env.fireWin('blur'); assert.deepEqual(G.Input.k, {}); assert.equal(G.Touch.pts.size, 0); assert.equal(G.W.paused, true);
  assert.equal(env.doc.fire('gesturestart').defaultPrevented, true);
});

// --- touch and tilt (GDD 3a) ---------------------------------------------
test('Touch.want: touch controls by option or on a coarse pointer', () => {
  const p = load({ coarse: true }).G, k = load().G;
  assert.equal(p.Touch.want(), true); assert.equal(k.Touch.want(), false);
  p.UI.opts.controls = 'keys'; assert.equal(p.Touch.want(), false); k.UI.opts.controls = 'touch'; assert.equal(k.Touch.want(), true);
});
test('Touch.zone, Touch.sens, Touch.angle: screen halves, tilt sensitivity, screen angle', () => {
  const { G, env } = load({ width: 1000 }); const Tc = G.Touch;
  assert.equal(Tc.zone(100), 'brk'); assert.equal(Tc.zone(900), 'gas'); G.UI.opts.side = 'gas'; assert.equal(Tc.zone(100), 'gas');
  for (const [o, v] of [['verylow', 75], ['low', 60], ['high', 35], ['x', 60]]) { G.UI.opts.tilt = o; assert.equal(Tc.sens(), v); }
  env.win.screen.orientation.angle = 90; assert.equal(Tc.angle(), 90);
});
test('Touch.press, Touch.release, Touch.refresh, Touch.reset: fingers on the halves', () => {
  const { G } = play('practice', { width: 1000 }); const Tc = G.Touch; let prevented = 0; const ev = (id, x) => ({ pointerId: id, clientX: x, preventDefault() { prevented++; } });
  Tc.press(ev(1, 100)); assert.equal(Tc.brk, true); Tc.press(ev(2, 900)); assert.equal(Tc.gas, true); assert.equal(prevented, 2);
  Tc.release(ev(1)); assert.equal(Tc.brk, false); assert.equal(Tc.gas, true);
  Tc.pts.set(9, 'brk'); Tc.refresh(); assert.equal(Tc.brk, true); Tc.reset(); assert.equal(Tc.gas || Tc.brk, false);
  G.W.paused = true; Tc.press(ev(3, 900)); assert.equal(Tc.gas, false, 'paused: ignored');
});
test('Touch.press: in the replay the thirds seek and pause', () => {
  const { G } = load({ width: 900 }); G.RP.open([makeRec(G, { laps: 1 })], 'menu'); G.RP.seek(20); const ev = x => ({ clientX: x, preventDefault() { } });
  G.Touch.press(ev(100)); assert.equal(G.RP.t, 15); G.Touch.press(ev(800)); assert.equal(G.RP.t, 20); G.Touch.press(ev(450)); assert.equal(G.RP.playing, false);
});
test('Touch.motion, Touch.recentre: roll angle with a 12 degree dead zone', () => {
  const { G, env } = load(); const Tc = G.Touch; Tc.rollSeen = false;
  const roll = deg => { const r = deg * Math.PI / 180; for (let k = 0; k < 60; k++) Tc.motion({ accelerationIncludingGravity: { x: -Math.sin(r) * 9.81, y: Math.cos(r) * 9.81 } }); };
  roll(0); assert.equal(Tc.tilt, 0); roll(10); assert.equal(Tc.tilt, 0, 'dead zone'); roll(36); near(Tc.tilt, (36 - 12) / 48, 1e-3); roll(-80); near(Tc.tilt, -1, 1e-9);
  Tc.recentre(); assert.equal(Tc.tilt, 0); near(Tc.roll0, Tc.roll, 1e-12);
  env.win.screen.orientation.angle = 90; Tc.rollSeen = false; Tc.motion({ accelerationIncludingGravity: { x: 0, y: 9.81 } }); assert.equal(Tc.tilt, 0);
  Tc.motion({ accelerationIncludingGravity: { x: null } }); // no sensor data: ignored
});
test('Touch.enable: motion access asked once, listener added', async () => {
  assert.equal(await load().G.Touch.enable(), false, 'no motion sensor');
  const ok = load({ window: { DeviceMotionEvent: { requestPermission: async () => 'granted' } } });
  assert.equal(await ok.G.Touch.enable(), true); assert.equal(ok.G.Touch.tiltOk, true); assert.equal(ok.env.winL.devicemotion.length, 1);
  await ok.G.Touch.enable(); assert.equal(ok.env.winL.devicemotion.length, 1, 'listener added once');
  const no = load({ window: { DeviceMotionEvent: { requestPermission: async () => 'denied' } } }); assert.equal(await no.G.Touch.enable(), false);
  const err = load({ window: { DeviceMotionEvent: { requestPermission: () => Promise.reject(new Error('x')) } } }); assert.equal(await err.G.Touch.enable(), false);
});
test('Touch.opts: phone option rows and the labels of the halves', () => {
  const { G, env } = load({ coarse: true }); const $ = id => env.doc.getElementById(id);
  G.UI.opts.side = 'gas'; G.Touch.opts();
  assert.equal($('optTrans').closest('.opt').hidden, true); assert.equal($('optSideWrap').hidden, false);
  const z = $('touch').children; assert.equal(z[0].dataset.z, 'gas'); assert.equal(z[0].firstElementChild.textContent, 'Gas'); assert.equal(z[1].firstElementChild.textContent, 'Brake');
});
test('Touch.sync: touch layer in play, pause button, portrait prompt pauses', () => {
  const g = play('practice', { coarse: true }); const { G, $ } = g; G.Touch.sync();
  assert.equal($('touch').hidden, false); assert.equal($('touchPause').hidden, false); assert.equal($('turn').hidden, true);
  g.env.mq['(orientation: portrait)'].matches = true; G.Touch.sync(); assert.equal($('turn').hidden, false); assert.equal(G.W.paused, true);
  G.UI.toMenu(); G.Touch.pts.set(1, 'gas'); G.Touch.sync(); assert.equal($('touch').hidden, true); assert.equal(G.Touch.pts.size, 0);
});

// --- menus -----------------------------------------------------------------
test('$: element by id', () => {
  const { G, env } = load(); assert.equal(G.$('menu'), env.doc.getElementById('menu')); assert.equal(G.$('nope'), null);
});
test('UI.init: saved options, team list, option buttons and fields', () => {
  const { G, env } = load({ storage: { sgp_opts: { cam: 'drone', train: 'on', ai: 'legend', name: 'Kim' } } }); const $ = id => env.doc.getElementById(id);
  assert.equal(G.UI.opts.cam, 'behind', 'unknown camera dropped'); assert.equal(G.UI.opts.train, 'on', 'old saves without trainDef keep the default');
  assert.equal(G.UI.opts.ai, 'legend'); assert.equal(G.UI.opts.trainDef, 1);
  assert.equal($('optTeam').querySelectorAll('option').length, G.TEAMS.length);
  env.doc.querySelector('.mode[data-mode="gp"]').click(); assert.equal(G.UI.opts.mode, 'gp');
  $('optAids').querySelector('button[data-v="off"]').click(); assert.equal(G.UI.opts.aids, 'off');
  $('optName').fire('input', { target: { value: '  ' } }); assert.equal(G.UI.opts.name, 'Rider');
  $('optNum').fire('input', { target: { value: '300' } }); assert.equal(G.UI.opts.num, 99);
  $('optFuel').fire('input', { target: { value: '60' } }); assert.equal(G.UI.opts.fuel, 60);
  $('btnStart').click(); assert.equal(G.UI.state, 'play'); assert.equal(G.W.mode, 'quali', 'Grand Prix starts with qualifying');
});
test('UI.sync: buttons, fuel line and hint, rows per mode, saved', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id); Object.assign(G.UI.opts, { mode: 'gp', fuel: 50 }); G.UI.sync();
  assert.equal(env.doc.querySelector('.mode[data-mode="gp"]').getAttribute('aria-pressed'), 'true');
  assert.equal($('optFuelV').textContent, '11.0 L'); assert.match($('optFuelHint').textContent, /A 20 lap race needs at least 95 % of the tank/);
  assert.equal($('optGuideWrap').hidden, true); assert.equal(JSON.parse(env.ls.getItem('sgp_opts')).fuel, 50);
  G.UI.opts.mode = 'practice'; G.UI.sync(); assert.equal($('optFuelWrap').hidden, true); assert.equal($('optFuelHint').textContent, 'Practice starts with a full tank.');
});
test('UI.renderRecords: saved laps and bests, or a hint when there are none', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id);
  G.UI.renderRecords(); assert.match($('records').textContent, /No laps saved yet/); assert.equal($('btnClearRec').hidden, true);
  G.Records.add('practice', 130.5, G.makeBike({ lastSec: [40, 45, 45.5] }), null, false); G.UI.renderRecords();
  assert.match($('records').textContent, /Practice best2:10\.500/); assert.match($('records').textContent, /40\.00 \/ 45\.00 \/ 45\.50/); assert.equal($('btnClearRec').hidden, false);
});
test('UI.trainSpot: 350 m before the braking zone', () => {
  const { G } = load(); const z = G.T.zones[1]; near(G.UI.trainSpot(z), G.T.wrapS(z.zi * G.T.DS - 350), 1e-9);
});
test('UI.initTraining, UI.renderTraining: corner list, map pick and the info line', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id), o = G.UI.opts;
  assert.equal($('optTrainCorner').querySelectorAll('option').length, G.T.zones.length + 1);
  near(o.trainS, G.UI.trainSpot(G.T.zones[0]), 1e-9);
  $('optTrainCorner').value = '2'; $('optTrainCorner').fire('change'); near(o.trainS, G.UI.trainSpot(G.T.zones[2]), 1e-9);
  assert.match($('trainInfo').textContent, /^Start at .+, centre of the road\. Next corner .+ in \d+ m\. Guide speed here \d+ km\/h\.$/);
  const M = G.UI.tmap, cv = $('trainMap'); cv.style.width = M.W0 + 'px'; cv.style.height = M.H0 + 'px'; const i = 1000;
  cv.fire('pointerdown', { pointerId: 1, clientX: M.ox + G.T.X[i] * M.sc, clientY: M.oy + G.T.Y[i] * M.sc }); cv.fire('pointerup');
  near(o.trainS, Math.round(i * G.T.DS), 1); assert.equal($('optTrainCorner').value, 'x', 'picked on the map');
  assert.ok(ops(cv.getContext('2d'), 'stroke').length >= 2);
});
test('UI.rbarInit, UI.rbarOpen, UI.rbarClose, UI.rbarTicks, UI.rbarUpdate: the replay bar', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id);
  assert.ok($('rNorm'), 'normal speed button added');
  G.RP.open([makeRec(G, { laps: 3 })], 'menu');
  assert.equal($('rbar').hidden, false); assert.equal($('rLapN').querySelectorAll('option').length, 3); assert.equal($('rFollow').hidden, true);
  assert.equal($('rTicks').querySelectorAll('span').length, 3); assert.equal($('rPrev').disabled, false);
  $('rPlay').click(); assert.equal(G.RP.playing, false); $('rFf').click(); assert.equal(G.RP.speed, 2); $('rNorm').click(); assert.equal(G.RP.speed, 1);
  G.RP.speed = -2; G.RP.playing = false; G.RP.t = 65.25; G.UI.rbarUpdate();
  assert.equal($('rPlay').textContent, 'Play'); assert.equal($('rSpeed').textContent, '◀ 2×'); assert.match($('rTime').textContent, /^1:05\.2 \/ /);
  $('rAlign').fire('change', { target: { value: 'best', blur() { } } }); assert.equal(G.RP.align, 'best'); assert.equal($('rLapN').hidden, true); assert.equal($('rPrev').disabled, true);
  G.UI.rbarClose(); assert.equal($('rbar').hidden, true);
});
test('UI.renderLib: the recordings table and the ghost hint', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id);
  G.UI.renderLib(); assert.match($('recList').textContent, /No recordings yet/);
  G.Lib.add(makeRec(G, { id: 'x"1', laps: 1 }), 'auto'); G.Lib.toggleGhost('x"1');
  const bt = $('recList').querySelectorAll('button[data-act]'); assert.deepEqual(bt.map(b => b.dataset.act), ['ghost', 'sync', 'replay', 'cmp', 'export', 'del']);
  assert.equal(bt[0].dataset.id, 'x"1', 'ids are escaped in the markup'); assert.match($('recGhostHint').textContent, /^1 ghost selected/);
  bt[3].click(); assert.deepEqual(G.Lib.cmp, ['x"1']); assert.equal($('btnReplaySel').disabled, false);
});
test('UI.hideAll, UI.toMenu: overlays hidden, back to the menu', () => {
  const { G, env } = play('practice'); const $ = id => env.doc.getElementById(id); G.UI.togglePause();
  G.UI.hideAll(); assert.ok(['menu', 'pause', 'results'].every(id => $(id).hidden));
  G.UI.toMenu(); assert.equal(G.UI.state, 'menu'); assert.equal($('menu').hidden, false); assert.equal(G.W.paused, false);
});
test('UI.syncIn: "Sync ghosts to" with two or more ghosts in the practice pause menu', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id);
  G.UI.syncIn(true); assert.equal($('pauseSync').hidden, true);
  for (const id of ['a', 'b']) { G.Lib.add(makeRec(G, { id, laps: 1 }), 'auto'); G.Lib.toggleGhost(id); }
  G.UI.syncIn(true); assert.equal($('pauseSync').hidden, false); assert.equal($('optSync').querySelectorAll('option').length, 2);
  $('optSync').fire('change', { target: { value: 'b', blur() { } } }); assert.equal(G.Lib.sync, 'b');
});
test('UI.trainIn: curve training options move into the pause menu and back', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id);
  G.UI.trainIn(true); assert.equal($('optTrainWrap').parentNode, $('pauseTrain')); assert.equal($('btnTrainGo').hidden, false);
  G.UI.trainIn(false); assert.notEqual($('optTrainWrap').parentNode, $('pauseTrain')); assert.equal($('pauseTrain').hidden, true);
});
test('UI.camIn: camera tuning sliders for the tilted camera', () => {
  const { G, env } = play('practice'); const $ = id => env.doc.getElementById(id); G.W.paused = true;
  G.UI.camIn(true); const P = $('pauseCam'); assert.equal(P.hidden, false); assert.equal($('camTitle').textContent, 'Camera tuning (Behind)');
  assert.equal(P.querySelectorAll('input').filter(e => e.type === 'range').length, G.CAM_SET.length);
  const rg = $('cam_zMax'); rg.value = '25'; rg.fire('input'); assert.equal(G.TILT.zMax, 25); assert.equal(JSON.parse(env.ls.getItem('sgp_cam')).zMax, 25);
  P.querySelectorAll('button').at(-1).click(); assert.equal(G.TILT.zMax, 20, 'Reset to defaults');
  G.UI.camIn(false); assert.equal(P.hidden, true);
});
test('UI.start: sound on, the chosen session, and a warning when tilt is refused', async () => {
  const { G } = load({ coarse: true }); G.UI.opts.mode = 'sprint';
  G.UI.start(); assert.equal(G.W.kind, 'sprint'); await new Promise(r => setImmediate(r)); assert.equal(G.HUD.m.t, 'LEAN OFF');
});
test('UI.sessionOpts: session settings from the start screen', () => {
  const { G } = load(); Object.assign(G.UI.opts, { mode: 'practice', train: 'on', trainS: 500, trainV: 180, trans: 'manual', fuel: 40, aids: 'off' });
  const o = G.UI.sessionOpts({ gridPos: 'back' });
  assert.deepEqual(o.train, { s: 500, v: 50 }); assert.equal(o.auto, false); assert.equal(o.fuelPct, 0.4); assert.equal(o.aids, false); assert.equal(o.gridPos, 'back');
  G.UI.opts.mode = 'sprint'; assert.equal(G.UI.sessionOpts({}).train, null);
});
test('UI.launch: a new session with its recording', () => {
  const { G, env } = load(); G.UI.opts.train = 'off'; G.UI.launch('quali', {});
  assert.equal(G.UI.state, 'play'); assert.equal(G.W.mode, 'quali'); assert.ok(G.Rec.cur); assert.equal(env.doc.getElementById('btnEndQ').hidden, false);
  G.UI.launch('gp', { qualiGrid: [0] }); assert.equal(G.W.kind, 'gp'); assert.equal(G.W.totalLaps, 20); assert.equal(env.doc.getElementById('btnEndQ').hidden, true);
});
test('UI.togglePause: pause menu with the session line', () => {
  const { G, env } = play('sprint'); const $ = id => env.doc.getElementById(id);
  G.UI.togglePause(); assert.equal(G.W.paused, true); assert.equal($('pause').hidden, false); assert.equal($('pauseSub').textContent, 'Lap 1 of 10');
  assert.equal(env.doc.activeElement, $('btnResume')); G.UI.togglePause(); assert.equal($('pause').hidden, true);
  G.UI.state = 'menu'; G.UI.togglePause(); assert.equal(G.W.paused, false);
});
test('UI.finishQuali: qualifying classification, then the race from that grid', () => {
  const { G, env, b } = play('quali'); b.bestLap = 1; G.Rec.lap(0, 1, 1);
  G.UI.finishQuali(); const $ = id => env.doc.getElementById(id);
  assert.equal(G.UI.state, 'results'); assert.equal($('resTable').querySelectorAll('tr').length, 23); assert.match($('resSub').textContent, /P1$/);
  const acts = $('resActions').querySelectorAll('button'); assert.deepEqual(acts.map(a => a.textContent), ['Start the race', 'Watch replay', 'Export session', 'Back to menu']);
  acts[0].click(); assert.equal(G.W.kind, 'gp'); assert.equal(G.W.player.grid, 1, 'pole');
});
test('UI.raceResults: the field finishes and the result is shown', () => {
  const { G, env, W } = play('sprint'); W.phase = 'run'; W.raceStartT = 1; const $ = id => env.doc.getElementById(id);
  W.bikes.forEach((x, k) => Object.assign(x, { held: false, finished: true, lap: 10, finishT: 1300 + k, bestLap: 128 + k * 0.1 }));
  W.player.pen = 1.5; W.finishOrder = W.bikes.slice();
  G.UI.raceResults();
  assert.equal(G.UI.state, 'results'); assert.equal($('resTable').querySelectorAll('tr').length, 23);
  assert.match($('resSub').textContent, /^You finished P2 of 22\. Fastest lap: #/); assert.ok($('resTable').textContent.includes('+1.5 s'));
});
test('UI.results: table, actions and the results overlay', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id); let hit = 0;
  G.UI.results('E', 'T', 'S', ['Pos', 'Rider'], [{ me: true, cells: [1, '<b>'] }], [['Go', () => hit++], ['Ghost', () => { }, true]]);
  assert.equal($('resTitle').textContent, 'T'); assert.match($('resTable').innerHTML, /<tr class="me"><td class="pos">1<\/td><td class="num">&lt;b&gt;<\/td>/);
  const bt = $('resActions').querySelectorAll('button'); assert.equal(bt[1].className, 'btn ghost'); bt[0].click(); assert.equal(hit, 1); assert.equal($('results').hidden, false);
});
test('esc, sw, teamForId: markup helpers and the team of an AI rider', () => {
  const { G } = load(); assert.equal(G.esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(G.sw(0), '<span class="sw" style="background:#c8102e"></span>');
  const s = play('sprint'); for (const b of s.W.bikes.filter(x => !x.isPlayer)) assert.equal(s.G.teamForId(b.id, s.b.team), b.team);
});

// --- main loop, attract mode, boot ----------------------------------------
test('frame: physics at 120 Hz in play, HUD drawn, next frame asked', () => {
  const { G, env, W } = play('practice'); env.rafs.length = 0; G.last = 0; G.acc = 0; const t0 = W.time;
  G.frame(100); near(W.time - t0, 0.1, G.SUB + 1e-9); assert.equal(env.rafs.length, 1);
  assert.ok(ops(G.hudCtx, 'fillText').length > 10, 'HUD drawn');
  W.paused = true; const t1 = W.time; G.frame(200); assert.equal(W.time, t1, 'paused');
});
test('frame: race results when the end timer runs out; lower resolution on a slow machine', () => {
  const { G, W } = play('sprint'); W.endTimer = 0.05; W.bikes.forEach(x => Object.assign(x, { finished: true, lap: 10, finishT: 1300, bestLap: 128 })); G.last = 0;
  G.frame(100); assert.equal(G.UI.state, 'results');
  const s = play('practice', { dpr: 2 }); s.G.perfN = 0; s.G.last = 0; let t = 0;
  for (let k = 0; k < 200 && s.G.DPR_CAP > 1; k++) { t += 40; s.G.frame(t); }
  assert.equal(s.G.DPR_CAP, 1);
});
test('attractSession: AI field running behind the menu', () => {
  const { G } = load(); G.attractSession();
  assert.equal(G.W.kind, 'sprint'); assert.equal(G.W.player.autopilot, true); assert.equal(G.W.phase, 'run'); assert.ok(G.W.bikes.every(b => !b.held));
});
test('boot: menu shown, frames asked, the attract session runs in the menu', () => {
  const { G, env } = load(); const $ = id => env.doc.getElementById(id);
  assert.equal($('loading').hidden, true); assert.equal($('menu').hidden, false); assert.equal(env.rafs.length, 1); assert.equal(G.UI.state, 'menu');
  const t = G.W.time; env.advance(100); assert.ok(G.W.time > t);
  assert.ok(env.win.__sgp && env.win.__sgp.W === G.W, 'test hooks for the browser tests');
});
