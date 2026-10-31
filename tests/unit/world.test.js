// Unit tests for src/world.js (GDD 13b): effects, records, sessions, simulation step, timing, track limits, pits.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, placeAt, makeRec } = require('./load');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
function session(kind, extra, lo) {
  const g = load(lo); g.G.setupSession(kind, g.G.UI.sessionOpts(Object.assign({ train: null }, extra)));
  return Object.assign(g, { W: g.G.W, b: g.G.W.player, T: g.G.T, SURF: g.G.SURF });
}

// --- effects ---------------------------------------------------------------
test('FX.add: particles are capped at 1400', () => {
  const { G } = load(); G.FX.clear();
  for (let k = 0; k < 1500; k++) G.FX.add({ t: 'x', age: 0, life: 1, x: 0, y: 0, vx: 0, vy: 0 });
  assert.equal(G.FX.parts.length, 1400);
});
test('FX.spark, FX.smoke, FX.dust: particle kinds', () => {
  const { G } = load(); const F = G.FX; F.clear();
  F.spark(0, 0, 10, 0); assert.equal(F.parts.filter(p => p.t === 'spark').length, 2);
  F.smoke(0, 0, 0, 0); assert.equal(F.parts.at(-1).t, 'smoke'); assert.equal(F.parts.at(-1).a, 0.35);
  F.dust(0, 0, G.SURF.GRAVEL); assert.equal(F.parts.at(-1).t, 'dust');
  F.dust(0, 0, G.SURF.GRASS); assert.equal(F.parts.at(-1).t, 'grass');
});
test('FX.mark: tyre marks in a ring of 5000', () => {
  const { G } = load(); const F = G.FX; F.clear();
  F.mark(10, 20, 30, 0, 0.5);
  assert.deepEqual(Array.from(F.marks.slice(0, 6)), [10 - 0.6, 20, 10, 20, 0.5, 0].map(Math.fround));
  for (let k = 0; k < 5003; k++) F.mark(0, 0, 1, 0, 0.28);
  assert.equal(F.mn, 5000); assert.equal(F.mi, 5004 % 5000);
});
test('FX.step: particles move, slow down and expire', () => {
  const { G } = load(); const F = G.FX; F.clear();
  F.add({ t: 'smoke', x: 0, y: 0, vx: 10, vy: 0, life: 1, age: 0, r: 0.5 });
  F.step(0.1); const p = F.parts[0];
  assert.ok(p.x > 0.9 && p.vx < 10 && p.r > 0.5);
  F.step(1); assert.equal(F.parts.length, 0);
});
test('FX.clear: no particles, no marks', () => {
  const { G } = load(); G.FX.spark(0, 0, 1, 1); G.FX.mark(0, 0, 1, 0, 0.5); G.FX.clear();
  assert.equal(G.FX.parts.length, 0); assert.equal(G.FX.mn, 0);
});
test('W.event: messages for the player, ticker for riders nearby', () => {
  const { G, W, b } = session('sprint');
  const o = W.bikes[1]; o.x = b.x + 50; o.y = b.y;
  W.event(o, 'crash', 'lowside'); assert.match(G.HUD.tick[0].t, new RegExp('#' + o.num + ' ' + o.short + ' crashed at '));
  o.x = b.x + 1000; G.HUD.tick = []; W.event(o, 'crash', 'lowside'); assert.equal(G.HUD.tick.length, 0, 'too far away');
  W.event(o, 'dnf'); assert.match(G.HUD.tick[0].t, /retires/);
  W.event(b, 'dnf'); assert.equal(G.HUD.m.t, 'RETIRED');
  W.event(b, 'rejoin'); assert.equal(G.HUD.m.t, 'REJOIN');
  W.event(b, 'crash', 'gravel'); assert.equal(G.HUD.m.sub, 'Down in the gravel');
});

// --- records ---------------------------------------------------------------
const lapBike = (G, o) => G.makeBike(Object.assign({ assist: true, auto: false, lastSec: [40.1234, 45, 46] }, o));
test('Records.load: saved records of version 1, anything else ignored', () => {
  const ok = load({ storage: { sgp_records: { v: 1, laps: [{ t: 130 }], best: { practice: { t: 130 } }, trace: null, traceT: 130 } } }).G.Records;
  assert.equal(ok.d.laps.length, 1); assert.equal(ok.allBest(), 130);
  assert.equal(load({ storage: { sgp_records: { v: 2, laps: [{ t: 1 }] } } }).G.Records.d.laps.length, 0);
  assert.equal(load({ storage: { sgp_records: '{broken' } }).G.Records.d.laps.length, 0);
});
test('Records.save: written to localStorage, a full storage does not throw', () => {
  const { G, env } = load(); G.Records.d.laps.push({ t: 1 }); G.Records.save();
  assert.equal(JSON.parse(env.ls.getItem('sgp_records')).laps.length, 1);
  env.ls.full = true; G.Records.save();
});
test('Records.allBest: best time over all modes, 0 when none', () => {
  const { G } = load(); const R = G.Records;
  assert.equal(R.allBest(), 0);
  R.d.best = { practice: { t: 131 }, quali: { t: 129.5 }, race: null }; assert.equal(R.allBest(), 129.5);
});
test('Records.add: personal bests, all-time trace, invalid laps never a best', () => {
  const { G } = load(); const R = G.Records;
  const r1 = R.add('practice', 131.23456, lapBike(G), [1.234, 2.5], false);
  assert.deepEqual(r1, { pb: true, allPb: true }); assert.equal(R.d.best.practice.t, 131.235); assert.deepEqual(R.d.trace, [1.23, 2.5]);
  assert.deepEqual(R.d.laps[0].s, [40.123, 45, 46]); assert.equal(R.d.laps[0].aids, 1);
  assert.deepEqual(R.add('practice', 132, lapBike(G), [9], false), { pb: false, allPb: false });
  const inv = R.add('practice', 120, lapBike(G), [5], true);
  assert.deepEqual(inv, { pb: false, allPb: false }); assert.equal(R.d.laps.at(-1).inv, 1); assert.equal(R.d.traceT, 131.235);
  assert.deepEqual(R.add('quali', 131.5, lapBike(G), null, false), { pb: true, allPb: false });
  for (let k = 0; k < 310; k++) R.add('race', 140, lapBike(G), null, false);
  assert.equal(R.d.laps.length, 300);
});
test('Records.clear: everything gone and saved', () => {
  const { G, env } = load(); G.Records.add('practice', 130, lapBike(G), [1], false); G.Records.clear();
  assert.equal(G.Records.d.laps.length, 0); assert.equal(JSON.parse(env.ls.getItem('sgp_records')).laps.length, 0);
});

// --- sessions --------------------------------------------------------------
test('setupSession: practice starts alone on the grid, frozen until the first input', () => {
  const { W, b, G } = session('practice');
  assert.equal(W.mode, 'practice'); assert.equal(W.bikes.length, 1); assert.equal(W.totalLaps, 0);
  assert.equal(W.gridStart, true); assert.equal(W.gridSlot, 11); assert.equal(b.grid, 12); assert.equal(b.trainHold, true);
  assert.equal(b.fuel, G.PHYS.tank); assert.equal(G.HUD.m.t, 'FREE PRACTICE');
});
test('setupSession: races have 22 riders on the grid, laps and fuel', () => {
  const s = session('sprint', { fuelPct: 0.5, gridPos: 'pole' }), W = s.W;
  assert.equal(W.bikes.length, 22); assert.equal(W.totalLaps, 10); assert.equal(W.phase, 'grid');
  assert.ok(W.bikes.every(b => b.held && b.gridCross)); assert.equal(s.b.grid, 1); assert.equal(s.b.fuel, 11);
  assert.ok(W.bikes.filter(b => !b.isPlayer).every(b => Math.abs(b.fuel - (10 * s.G.PHYS.lapFuel + 0.6)) < 1e-9));
  assert.equal(session('gp').W.totalLaps, 20);
  const teams = {}; for (const b of W.bikes) teams[b.team] = (teams[b.team] || 0) + 1;
  assert.ok(Object.values(teams).every(n => n === 2), 'two riders per team');
});
test('setupSession: qualifying from the box with 12 L and simulated AI times', () => {
  const { W, b, G, T } = session('quali');
  assert.equal(W.mode, 'quali'); assert.equal(W.bikes.length, 1); assert.equal(b.outLap, true); assert.equal(b.fuel, 12);
  near(b.d, T.PIT.boxD - 0.5, 1e-9); assert.equal(W.qualiAI.length, 21); assert.equal(G.HUD.m.t, 'QUALIFYING');
});
test('setupSession: curve training on the spot; ghosts replace the slowest AI in a race', () => {
  const t = session('practice', { train: { s: 1000, v: 50 } });
  assert.ok(t.W.train); assert.equal(t.W.gridStart, false); near(t.b.s, 1000, 1.1); assert.equal(t.b.v, 50); assert.equal(t.G.HUD.m.t, 'CURVE TRAINING');
  const g = load(); const R = makeRec(g.G, { kind: 'sprint', raceStart: 1, stand: 1, laps: 1 });
  g.G.setupSession('sprint', g.G.UI.sessionOpts({ train: null, ghosts: [R] }));
  assert.equal(g.G.W.bikes.length, 21); assert.equal(g.G.W.ghosts.length, 1);
});
test('gridPose: three bikes per row, 9.5 m apart', () => {
  const { G } = load();
  const a = G.gridPose(0), b = G.gridPose(4);
  assert.equal(a.sr, -8); assert.equal(a.d, 3.9); near(b.sr, -8 - 9.5 - 2.4, 1e-9); assert.equal(b.d, 0);
  assert.equal(a.i, G.T.idx(-8));
});
test('placeGrid: standing on the slot, lap 1 from a standing start', () => {
  const { G } = load(); const b = G.makeBike({ v: 30 });
  G.placeGrid(b, 2); const p = G.gridPose(2);
  assert.equal(b.d, p.d); assert.equal(b.grid, 3); assert.equal(b.v, 0); assert.equal(b.gridCross, true); assert.equal(b.trainHold, true);
});
test('placeTraining: rolling on the spot in a gear below 15000 rpm', () => {
  const { G } = load(); const b = G.makeBike({});
  G.placeTraining(b, { s: 1000, v: 50 });
  assert.equal(b.gear, 3); assert.equal(b.d, 0); assert.equal(b.v, 50); assert.equal(b.dist, 3000); assert.equal(b.trainHold, true);
  assert.ok(G.rpmFor(50, 3) <= 15000 && G.rpmFor(50, 2) > 15000);
});
test('aiStartFuel: just enough for the race, at most a full tank', () => {
  const { G, W } = session('sprint');
  W.totalLaps = 10; near(G.aiStartFuel(W.bikes[1]), 10.6, 1e-9);
  W.totalLaps = 40; assert.equal(G.aiStartFuel(W.bikes[1]), G.PHYS.tank);
});
test('simulateQualiAI: 21 times near the AI pace, repeatable skills', () => {
  const { G } = load();
  const a = G.simulateQualiAI({ level: 'pro' }), b = G.simulateQualiAI({ level: 'pro' });
  assert.equal(a.length, 21); assert.deepEqual(a.map(q => q.sk), b.map(q => q.sk));
  for (const q of a) { const base = G.T.refLap * G.AI_REAL / (G.AI_LEVEL.pro * (0.972 + 0.028 * q.sk)); assert.ok(q.best > base * 0.99 && q.best < base * 1.03, q.name); }
  assert.ok(Math.min(...G.simulateQualiAI({ level: 'legend' }).map(q => q.best)) < Math.min(...a.map(q => q.best)));
});

// --- simulation step -------------------------------------------------------
test('simStep: start lights, lights out and the AI reaction', () => {
  const { G, W, b } = session('sprint');
  G.simStep(G.SUB); assert.equal(W.phase, 'lights');
  let t = 0; while (W.phase !== 'run' && t < 8) { G.simStep(G.SUB); t += G.SUB; if (W.phase === 'lights') assert.ok(W.lights >= 1 && W.lights <= 5); }
  assert.equal(W.phase, 'run'); assert.ok(t > 4.5 + 0.6 && t < 4.5 + 2.4 + 0.1, 'lights out after ' + t); assert.equal(W.lights, -1);
  assert.equal(b.held, false); assert.equal(G.HUD.m.t, 'GO!'); assert.ok(W.raceStartT > 0);
  for (let k = 0; k < 60; k++) G.simStep(G.SUB);
  assert.ok(W.bikes.every(x => !x.held), 'all riders released within 0.5 s');
});
test('simStep: time runs, bikes move and stay projected on the track', () => {
  const { G, W } = session('sprint');
  W.phase = 'run'; for (const x of W.bikes) x.held = false;
  for (let k = 0; k < 240; k++) G.simStep(G.SUB);
  near(W.time, 2, 1e-9);
  const ai = W.bikes.filter(x => !x.isPlayer);
  assert.ok(ai.filter(x => x.v > 10).length >= 15, 'AI riders under way (a few are boxed in)');
  for (const x of ai) { const o = {}; G.T.project(x.x, x.y, x.i, o); assert.equal(o.i, x.i); }
});
test('simStep: the practice bike waits for the first input, then starts the clock', () => {
  const { G, W, b } = session('practice');
  for (let k = 0; k < 60; k++) G.simStep(G.SUB);
  assert.equal(b.trainHold, true); assert.equal(W.startT, -1); assert.equal(b.v, 0);
  G.Input.k.KeyW = true; G.simStep(G.SUB);
  assert.equal(b.trainHold, false); near(W.startT, W.time, 1e-9); assert.ok(b.ctl.thr > 0);
});
test('startMoment: lap 1 timed from the first input on the grid; the recording learns it', () => {
  const { G, W, b } = session('practice'); G.Rec.start();
  W.time = 3.25; G.startMoment(b);
  assert.equal(W.startT, 3.25); assert.equal(b.lapStartT, 3.25); assert.equal(G.Rec.cur.start.t, 3.25);
  const t = session('practice', { train: { s: 1000, v: 50 } }); t.W.time = 2; t.b.lapStartT = 0; t.G.startMoment(t.b);
  assert.equal(t.b.lapStartT, 0, 'curve training: no lap timed from the spot');
});
test('playerControl: keys, touch halves, tilt, grid and pit limiter', () => {
  const { G, b } = session('practice'); const K = G.Input.k, c = b.ctl, dt = 0.05;
  K.KeyW = true; G.playerControl(b, dt); near(c.thr, 0.35, 1e-9);
  K.KeyW = false; K.KeyS = true; G.playerControl(b, dt); near(c.brk, 0.4, 1e-9); assert.equal(c.thr, 0);
  K.KeyS = false; K.KeyA = true; G.playerControl(b, dt); assert.equal(c.steer, -1); near(c.leanT, -G.PHYS.maxLean, 1e-9);
  K.KeyA = false; G.TouchCtl.on = true; G.TouchCtl.tilt = 0.5; G.playerControl(b, dt); assert.equal(c.steer, 0.5);
  c.thr = 0; G.TouchCtl.gas = true; G.TouchCtl.brk = true; G.playerControl(b, dt); assert.equal(c.thr, 0, 'on touch the brake wins');
  G.TouchCtl.gas = G.TouchCtl.brk = false; G.TouchCtl.on = false;
  K.KeyW = true; b.limiter = true; b.v = G.PHYS.pitLimit + 2; G.playerControl(b, dt); assert.equal(c.thr, 0); assert.ok(c.brk > 0);
  const r = session('sprint'); r.G.Input.k.KeyW = true; r.G.playerControl(r.b, dt); assert.equal(r.b.ctl.brk, 1, 'held on the grid');
});
test('playerControl: a pit stop ends on W after it was released', () => {
  const { G, b } = session('practice'); const K = G.Input.k;
  Object.assign(b, { service: true, needRelease: true });
  K.KeyW = true; G.playerControl(b, 0.01); assert.equal(b.service, true);
  K.KeyW = false; G.playerControl(b, 0.01); assert.equal(b.needRelease, false);
  K.KeyW = true; G.playerControl(b, 0.01); assert.equal(b.service, false); assert.equal(G.HUD.m.t, 'GO GO GO');
});
// a bike just inside the wall on the right of point i, heading into it at angle a
function atWall(G, b, i, v, a) {
  const T = G.T, wd = T.WALL[0][i];
  placeAt(G, b, i * T.DS, wd - 0.3); b.v = v; b.vs = 0;
  for (const h of [T.H[i] + a, T.H[i] - a]) { b.h = h; const [vx, vy] = G.bikeVel(b); if (vx * T.NX[i] + vy * T.NY[i] > 0) break; }
}
test('wallHit: a glancing hit bounces off with damage, a hard one crashes', () => {
  const { G, b, T } = session('practice'), i = T.idx(T.L / 2);
  atWall(G, b, i, 15, 0.25); b.d = T.WALL[0][i] + 0.2;
  G.wallHit(b);
  assert.equal(b.crashed, false); assert.ok(b.v < 15); assert.ok(b.dmg.a > 0); assert.ok(G.HUD.shake > 0);
  const o = {}; T.project(b.x, b.y, i, o); assert.ok(o.d < T.WALL[0][i], 'pushed back inside');
  atWall(G, b, i, 60, 0.6); b.d = T.WALL[0][i] + 0.2; G.wallHit(b);
  assert.equal(b.crashed, true); assert.equal(b.crash.why, 'wall');
});
test('pitWall: the pit wall cannot be crossed in the flat part of the lane', () => {
  const { G, b, T } = session('practice'), P = T.PIT, s = (P.flatIn + P.flatOut) / 2;
  placeAt(G, b, s, P.wallD + 0.3); b.v = 10;
  G.pitWall(b, P.wallD - 1);
  assert.equal(b.d, P.wallD - 0.45);
  placeAt(G, b, T.L / 2, P.wallD + 0.3); G.pitWall(b, P.wallD - 1); near(b.d, P.wallD + 0.3, 1e-9, 'not judged away from the pits');
});
test('pitLogic: pit lane, limiter zone and the stop in the box', () => {
  const { G, b, T } = session('practice'), P = T.PIT;
  placeAt(G, b, P.boxS(b.box), P.boxD); b.v = 1;
  G.pitLogic(b, 0.01);
  assert.equal(b.inPitLane, true); assert.equal(b.limiter, true); assert.equal(b.service, true); assert.equal(b.pits, 1); assert.equal(b.v, 0);
  assert.equal(G.HUD.m.t, 'BOX');
  G.pitLogic(b, 0.5); near(b.serviceT, 0.51, 1e-9);
  placeAt(G, b, T.L / 2, 0); b.service = false; G.pitLogic(b, 0.01); assert.equal(b.inPitLane, false); assert.equal(b.limiter, false);
});
test('endService: the stop ends and the next lap starts its fuel count', () => {
  const { G, b } = session('practice'); Object.assign(b, { service: true, fuel: 9 });
  G.endService(b); assert.equal(b.service, false); assert.equal(b.serviceDone, true); assert.equal(b.fuelLapStart, 9);
});

// --- timing ----------------------------------------------------------------
const cross = (b, from, to) => { b.prevS = from; b.s = to; };
test('timing: the out lap ends at the line, sectors at thirds, a lap at the line', () => {
  const { G, W, b, T } = session('quali'), L = T.L;
  W.time = 50; cross(b, L - 2, 1); G.timing(b);
  assert.equal(b.outLap, false); assert.equal(b.lapStartT, 50); assert.equal(G.HUD.m.t, 'TIMED LAP');
  W.time = 90; cross(b, L / 3 - 1, L / 3 + 1); G.timing(b); assert.equal(b.cp, 1); near(b.lastSec[0], 40, 1e-9);
  W.time = 130; cross(b, 2 * L / 3 - 1, 2 * L / 3 + 1); G.timing(b); assert.equal(b.cp, 2);
  W.time = 180; cross(b, L - 1, 2); G.timing(b);
  assert.equal(b.laps.length, 1); near(b.lastLap, 130, 1e-9); assert.equal(b.cp, 0);
  near(b.progress, L + 2, 1e-9);
});
test('timing: a missed sector makes the lap invalid; backwards over the line', () => {
  const { G, W, b, T } = session('quali'); b.outLap = false; b.gridCross = false; b.cp = 1;
  W.time = 10; cross(b, T.L - 1, 1); G.timing(b);
  assert.equal(b.laps.length, 0); assert.equal(G.HUD.m.sub, 'Missed a sector'); assert.equal(b.lapStartT, 10);
  cross(b, 1, T.L - 1); G.timing(b); assert.equal(b.cp, -1);
});
test('timing: race progress bins log when the leader passed', () => {
  const { G, W, b } = session('sprint'); W.phase = 'run'; b.gridCross = false; b.lap = 1;
  W.time = 12; cross(b, 100, 105); G.timing(b);
  assert.equal(W.passT[Math.floor((G.T.L + 105) / 10) + 150], 12);
});
test('completeLap: lap times, bests, records and the live trace', () => {
  const { G, W, b, env } = session('practice'); b.gridCross = false; b.outLap = false;
  b.lapStartT = 0; b.secStart = 80; W.time = 130; W.curTrace.fill(5);
  G.completeLap(b);
  assert.equal(b.lap, 1); assert.equal(b.bestLap, 130); assert.deepEqual(b.lapsInv, [false]);
  assert.equal(G.Records.d.laps.length, 1); assert.ok(W.bestTrace); assert.equal(W.curTrace[0], -1);
  assert.ok(env.ls.getItem('sgp_records')); assert.equal(G.HUD.lapFlash.pb, true);
  b.lapInv = true; W.time = 250; G.completeLap(b); assert.equal(b.bestLap, 130, 'invalid lap of 120 s is no best'); assert.equal(G.HUD.lapFlash.inv, true);
});
test('completeLap: the race finish and the chequered flag', () => {
  const { G, W, b } = session('sprint'); W.phase = 'run'; W.raceStartT = 5;
  b.lap = W.totalLaps - 2; W.time = 1000; G.completeLap(b); assert.equal(G.HUD.m.t, 'FINAL LAP');
  W.time = 1130; G.completeLap(b);
  assert.equal(b.finished, true); assert.equal(b.finishT, 1125); assert.equal(W.flag, true); assert.deepEqual(W.finishOrder, [b]);
  assert.equal(G.HUD.m.t, 'CHEQUERED FLAG'); assert.equal(W.endTimer, 4); assert.match(G.HUD.tick[0].t, /takes the chequered flag/);
});
test('completeLap: qualifying ends after three laps; fuel use per lap is learned', () => {
  const { G, W, b } = session('quali'); b.outLap = false; b.fuelPerLap = 1;
  for (let k = 1; k <= 3; k++) { b.fuelLapStart = b.fuel; b.fuel -= 1.4; W.time = 130 * k; G.completeLap(b); }
  assert.equal(W.endTimer, 3); assert.equal(G.HUD.m.t, 'SESSION COMPLETE'); assert.ok(b.fuelPerLap > 1.3 && b.fuelPerLap <= 1.4);
});
test('sector: sector times and the best of each', () => {
  const { G, W, b } = session('practice');
  b.secStart = 10; W.time = 50; G.sector(b, 0);
  assert.equal(b.lastSec[0], 40); assert.equal(b.bestSec[0], 40); assert.equal(b.cp, 1); assert.equal(G.HUD.secFlash[0].t, 40);
  b.lapInv = true; b.secStart = 50; W.time = 80; G.sector(b, 0); assert.equal(b.bestSec[0], 40, 'invalid lap keeps the best');
});

// --- track limits (GDD 6a) -------------------------------------------------
test('overLimit: run-off, gravel and grass count; kerbs, the pit strip and the Long Lap do not', () => {
  const { G, b, T, SURF } = session('sprint');
  const at = (surf, s, d) => { b.surf = surf; b.s = s; b.d = d; return G.overLimit(b); };
  assert.equal(at(SURF.GRAVEL, 1000, 20), true); assert.equal(at(SURF.GRASS, 1000, -20), true);
  assert.equal(at(SURF.KERB, 1000, 9), false); assert.equal(at(SURF.ASPH, 1000, 0), false);
  assert.equal(at(SURF.RUN, T.wrapS((T.PIT.flatIn + T.PIT.flatOut) / 2), 15), false);
  b.llPend = [{ until: 5 }]; const LL = T.LL;
  assert.equal(at(SURF.RUN, LL.sM, LL.sg * LL.off(LL.sM)), false);
});
test('trackLimits: practice, beyond the kerb makes the lap invalid', () => {
  const { G, b, SURF } = session('practice'); Object.assign(b, { trainHold: false, outLap: false });
  b.surf = SURF.GRAVEL; b.s = 1000; b.d = 20; G.trackLimits(b);
  assert.equal(b.lapInv, true); assert.equal(G.HUD.m.sub, 'Track limits');
  b.surf = SURF.ASPH; b.d = 0; G.trackLimits(b); assert.equal(b.offT, -1); assert.equal(b.pen, 0);
});
test('trackLimits: a race cut gives the gain back and counts', () => {
  const { G, W, b, SURF } = session('sprint'); W.phase = 'run'; b.lap = 2;
  const ref = G.limitRef(1000, 1100), visit = (dt, crash) => {
    W.time = 100; b.surf = SURF.GRAVEL; b.s = 1000; b.d = 25; G.trackLimits(b);
    if (crash) b.crashes++;
    W.time = 100 + dt; b.surf = SURF.ASPH; b.s = 1100; b.d = 0; G.trackLimits(b);
  };
  visit(ref - 0.34); near(b.pen, 0.4, 1e-9); assert.equal(b.tl, 1); assert.equal(G.HUD.m.t, 'TRACK LIMITS 1/3');
  visit(ref + 1); assert.equal(b.tl, 1, 'ran wide and lost time: no count');
  visit(ref - 2, true); assert.equal(b.tl, 1, 'a crash is no rejoin');
  visit(ref - 0.1); assert.equal(G.HUD.m.t, 'TRACK LIMITS WARNING');
  visit(ref - 0.1); assert.equal(b.tl, 0); assert.equal(b.llPend.length, 1, '3 infractions: Long Lap');
  visit(ref - 1.5); assert.equal(b.llPend.length, 2, 'clear advantage: Long Lap at once');
});
test('trackLimits: last lap, a rival close behind takes the place', () => {
  const { G, W, b, SURF } = session('sprint'); W.phase = 'run'; b.lap = W.totalLaps - 1;
  const o = W.bikes[1]; b.progress = 5000; o.progress = 4990; for (const x of W.bikes.slice(2)) x.progress = 0;
  const ref = G.limitRef(1000, 1100);
  W.time = 100; b.surf = SURF.GRAVEL; b.s = 1000; b.d = 25; G.trackLimits(b);
  W.time = 100 + ref - 0.2; b.surf = SURF.ASPH; b.s = 1100; b.d = 0; G.trackLimits(b);
  assert.equal(b.dropBehind, o); assert.match(G.HUD.m.sub, /drop one position/);
});
test('giveLongLap: three laps to serve it, or 3 s when too few laps are left', () => {
  const { G, W, b } = session('sprint'); b.lap = 2;
  G.giveLongLap(b, 'x'); assert.deepEqual(b.llPend, [{ until: 5 }]); assert.equal(b.llGiven, 1); assert.equal(G.HUD.m.t, 'LONG LAP');
  b.lap = W.totalLaps - 2; G.giveLongLap(b, 'x'); assert.equal(b.pen, 3); assert.equal(b.llPend.length, 1);
});
test('longLap: served through entry, apex and exit, topped up to 2.5 s', () => {
  const { G, W, b, T } = session('sprint'); const LL = T.LL; W.phase = 'run'; b.llPend = [{ until: 6 }];
  const ref = G.limitRef(LL.sA, LL.sB), step = (s0, s1, t, inLane) => { W.time = t; b.prevS = s0; b.s = s1; b.d = inLane ? LL.sg * LL.off(s1) : 0; G.longLap(b); };
  step(LL.sA - 1, LL.sA + 1, 10, true); assert.ok(b.llRun);
  for (const c of LL.cps) step(c - 1, c + 1, 11, true);
  step(LL.sB - 1, LL.sB + 1, 10 + ref + 1, true);
  assert.equal(b.llPend.length, 0); near(b.pen, 1.5, 1e-9); assert.equal(G.HUD.m.t, 'LONG LAP SERVED');
  b.llPend = [{ until: 6 }]; step(LL.sA - 1, LL.sA + 1, 20, true); step(LL.cps[0] - 1, LL.cps[0] + 1, 21, false); step(LL.sB - 1, LL.sB + 1, 30, true);
  assert.equal(b.llPend.length, 1, 'missed the lane at the entry');
  W.mode = 'practice'; b.llRun = {}; G.longLap(b); assert.equal(b.llRun, null);
});
test('inLongLap: the lane while a Long Lap is pending, then 40 m of run-off after the exit on the same lap', () => {
  const { G, b, T } = session('sprint'); const LL = T.LL, at = (s, d) => { b.s = s; b.d = d; return G.inLongLap(b); }; b.lap = 2;
  b.llPend = [{ until: 5 }]; assert.equal(at(LL.sM, 0), false); assert.equal(at(LL.sM, LL.sg * LL.off(LL.sM)), true);
  b.llPend = []; assert.equal(at(LL.sM, LL.sg * LL.off(LL.sM)), false, 'the lane is a trip again once nothing is pending');
  b.llExitLap = 2; assert.equal(at(LL.sB - 1, 0), false); assert.equal(at(LL.sB + 20, 0), true); assert.equal(at(LL.sB + 41, 0), false);
  b.lap = 3; assert.equal(at(LL.sB + 20, 0), false, 'the next lap');
});
test('trackLimits: back on track after a served Long Lap is not a track limits trip', () => {
  const { G, W, b, T, SURF } = session('sprint'); const LL = T.LL; W.phase = 'run'; b.lap = 2; b.llPend = [{ until: 5 }];
  const ref = G.limitRef(LL.sA, LL.sB), step = (s0, s1, t, surf, d) => { W.time = t; b.prevS = s0; b.s = s1; b.surf = surf; b.d = d; G.longLap(b); G.trackLimits(b); };
  step(LL.sA - 1, LL.sA + 1, 10, SURF.RUN, LL.sg * LL.off(LL.sA + 1));
  for (const c of LL.cps) step(c - 1, c + 1, 11, SURF.RUN, LL.sg * LL.off(c + 1));
  step(LL.sB - 1, LL.sB + 1, 10 + ref + 1, SURF.RUN, LL.sg * LL.off(LL.sB + 1));
  assert.equal(b.llPend.length, 0); const pen = b.pen;
  step(LL.sB + 1, LL.sB + 5, 30, SURF.RUN, LL.sg * (LL.off(LL.sB) + 3)); // off the exit, onto the run-off
  step(LL.sB + 5, LL.sB + 12, 31, SURF.ASPH, 0); // back on the track
  assert.equal(b.tl, 0); assert.equal(b.offT, -1); assert.equal(b.pen, pen); assert.equal(b.llPend.length, 0);
  assert.notEqual(G.HUD.m.t, 'TRACK LIMITS 1/3');
});
test('trackLimits: a trip that runs into the Long Lap from the run-off is not counted', () => {
  const { G, W, b, T, SURF } = session('sprint'); const LL = T.LL; W.phase = 'run'; b.lap = 2; b.llPend = [{ until: 5 }];
  const step = (s0, s1, t, surf, d) => { W.time = t; b.prevS = s0; b.s = s1; b.surf = surf; b.d = d; G.longLap(b); G.trackLimits(b); };
  // a quick run: the rejoin after the exit is faster than the reference time, so a counted trip would give a penalty
  step(LL.sA - 9, LL.sA - 6, 10, SURF.RUN, LL.sg * (LL.off(LL.sA) + 4)); // onto the run-off just before the lane, outside it
  assert.ok(b.offT >= 0, 'the trip starts');
  step(LL.sA - 6, LL.sA + 1, 10.2, SURF.RUN, LL.sg * LL.off(LL.sA + 1)); // into the lane
  for (const c of LL.cps) step(c - 1, c + 1, 10.3, SURF.RUN, LL.sg * LL.off(c + 1));
  step(LL.sB - 1, LL.sB + 1, 10.5, SURF.RUN, LL.sg * LL.off(LL.sB + 1));
  assert.equal(b.llPend.length, 0); const pen = b.pen;
  step(LL.sB + 1, LL.sB + 5, 11, SURF.RUN, LL.sg * (LL.off(LL.sB) + 3)); // off the exit, onto the run-off
  step(LL.sB + 5, LL.sB + 12, 11.5, SURF.ASPH, 0); // back on the track
  assert.equal(b.tl, 0); assert.equal(b.offT, -1); assert.equal(b.pen, pen); assert.equal(b.llGiven, 0);
});
test('longLapDue: not served in its laps: 5 s', () => {
  const { G, b } = session('sprint'); b.llPend = [{ until: 4 }, { until: 6 }]; b.lap = 4;
  G.longLapDue(b); assert.equal(b.pen, 5); assert.equal(b.llPend.length, 1); assert.equal(G.HUD.m.t, 'LONG LAP NOT SERVED');
});
test('applyDrop: placed just behind the rival on the same lap', () => {
  const { G, W, b } = session('sprint'); const o = W.bikes[1];
  Object.assign(b, { finished: true, finishT: 100, lap: 10, dropBehind: o }); Object.assign(o, { finished: true, finishT: 100.2, lap: 10 });
  G.applyDrop(b); near(b.dropPen, 0.201, 1e-9);
  o.lap = 9; G.applyDrop(b); assert.equal(b.dropPen, 0);
  o.lap = 10; o.finishT = 99; G.applyDrop(b); assert.equal(b.dropPen, 0, 'already behind');
});
test('penT: time penalty plus the drop', () => {
  const { G } = load(); assert.equal(G.penT({}), 0); assert.equal(G.penT({ pen: 2, dropPen: 0.5 }), 2.5);
});
test('limitRef: time between two points from the best lap or the guide pace', () => {
  const { G, W, T } = session('practice');
  assert.equal(G.limitRef(1100, 1000), null);
  W.bestTrace = null;
  let want = 0; for (let k = 0, i = T.idx(1000); k < Math.round(100 / T.DS); k++, i = (i + 1) % T.N) want += T.DS / Math.max(5, T.VP[i] * G.GUIDE_K);
  near(G.limitRef(1000, 1100), want, 1e-9);
  W.bestTrace = new Float32Array(W.curTrace.length).map((_, k) => k * 0.2); W.bestTrace[0] = 0.01;
  near(G.limitRef(1000, 1100), 2, 1e-5);
  near(G.limitRef(T.L - 50, 50), G.limitRef(T.L - 50, T.L + 50), 1e-9, 'over the line');
});

// --- effects, contact, standings -------------------------------------------
test('effects: tyre marks when skidding, dust off track, smoke from a broken engine', () => {
  const { G, b, SURF } = session('practice'); G.FX.clear();
  Object.assign(b, { skid: true, v: 30, slip: 0.1 }); G.effects(b, 0.01); assert.equal(G.FX.mn, 1);
  Object.assign(b, { skid: false, surf: SURF.GRAVEL }); for (let k = 0; k < 20; k++) G.effects(b, 0.01);
  assert.ok(G.FX.parts.some(p => p.t === 'dust'));
  G.FX.clear(); Object.assign(b, { surf: SURF.ASPH, v: 5 }); b.dmg.e = 1; for (let k = 0; k < 50; k++) G.effects(b, 0.02);
  assert.ok(G.FX.parts.some(p => p.t === 'smoke'));
  Object.assign(b, { dig: true, digT: 1.5 }); G.effects(b, 0.01); assert.equal(G.HUD.m.t, 'FEATHER THE THROTTLE');
});
test('collide: overlapping bikes are pushed apart and trade speed', () => {
  const { G, W, T } = session('sprint'); const [A, B] = W.bikes;
  for (const x of [A, B]) { placeAt(G, x, 1000, 0); x.held = false; }
  const i = A.i; B.x += T.TX[i] * 1.9; B.y += T.TY[i] * 1.9; A.v = 40; B.v = 30; // A's front disc touches B's rear disc
  G.collide([A, B]);
  assert.ok(Math.hypot(B.x - A.x, B.y - A.y) > 1.9); assert.ok(A.v < 40 && B.v > 30); assert.ok(A.dmg.a > 0 && B.dmg.a > 0);
  const C = G.makeBike({ held: true }), D = G.makeBike({ held: true, x: 0.2 }); G.collide([C, D]); assert.equal(D.x, 0.2, 'two held bikes do not push');
});
test('standings: race by laps, time with penalties, then progress; practice by best lap', () => {
  const { G, W } = session('sprint'); const [a, b, c, d, e] = W.bikes;
  for (const x of W.bikes) { x.progress = 0; x.finished = false; }
  Object.assign(a, { finished: true, lap: 10, finishT: 100, pen: 2 }); Object.assign(b, { finished: true, lap: 10, finishT: 101 });
  Object.assign(c, { finished: true, lap: 9, finishT: 90 }); Object.assign(d, { progress: 5000 }); Object.assign(e, { dnf: true, progress: 9e9 });
  const st = G.standings();
  assert.deepEqual(st.slice(0, 4), [b, a, c, d]); assert.equal(st.at(-1), e);
  const p = session('practice'); p.b.bestLap = 0; const x = p.G.makeBike({ bestLap: 130 }); p.W.bikes.push(x);
  assert.deepEqual(p.G.standings(), [x, p.b]);
});
test('gapOf: time behind the leader at the same point, null when out', () => {
  const { G, W, b } = session('sprint'); W.time = 20; b.progress = 1000;
  assert.equal(G.gapOf(b), 0);
  W.passT[Math.floor(1000 / 10) + 150] = 18.5; near(G.gapOf(b), 1.5, 1e-9);
  b.dnf = true; assert.equal(G.gapOf(b), null);
});
test('fmtTime: minutes, seconds and thousandths', () => {
  const { G } = load();
  assert.equal(G.fmtTime(65.5), '1:05.500'); assert.equal(G.fmtTime(125.4321), '2:05.432'); assert.equal(G.fmtTime(9.1), '0:09.100');
  assert.equal(G.fmtTime(0), '–:––.–––'); assert.equal(G.fmtTime(Infinity), '–:––.–––');
});
test('fmtGap: signed seconds', () => {
  const { G } = load(); assert.equal(G.fmtGap(1.5), '+1.500'); assert.equal(G.fmtGap(-0.25), '−0.250'); assert.equal(G.fmtGap(0), '+0.000');
});

test('crashText: crash message by cause', () => {
  const { G } = load();
  assert.equal(G.crashText('highside'), 'Highside, rider down'); assert.equal(G.crashText('gravel'), 'Down in the gravel');
  assert.equal(G.crashText('wall'), 'Front tucked, lowside'); assert.equal(G.crashText(undefined), 'Front tucked, lowside');
});
