// Unit tests for src/core.js (GDD 13b): helpers, track model, bike physics, crashes, AI control.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, placeAt } = require('./load');

const { G } = load();
const { T, PHYS, SURF } = G;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
const kmh = v => v * 3.6;
// a lone bike on the start straight in a practice session (no AI, W.rand seeded)
function soloBike(o) {
  const g = load();
  g.G.setupSession('practice', g.G.UI.sessionOpts({ train: null }));
  const b = g.G.W.player; Object.assign(b, { trainHold: false, held: false, auto: false, assist: true }, o);
  placeAt(g.G, b, 300, 0);
  return { ...g, b };
}
const run = (G, b, secs, ctl) => {
  for (let t = 0; t < secs; t += G.SUB) {
    if (ctl) ctl(b, t);
    G.stepBike(b, G.SUB, G.W);
  }
};

// --- helpers ---------------------------------------------------------------
test('clamp: limits to the range', () => {
  assert.equal(G.clamp(5, 0, 3), 3); assert.equal(G.clamp(-1, 0, 3), 0); assert.equal(G.clamp(2, 0, 3), 2);
});
test('lerp: blends linearly', () => {
  assert.equal(G.lerp(10, 20, 0), 10); assert.equal(G.lerp(10, 20, 1), 20); assert.equal(G.lerp(10, 20, 0.25), 12.5);
});
test('angWrap: wraps into -pi..pi', () => {
  near(G.angWrap(3 * Math.PI), Math.PI, 1e-9); near(G.angWrap(-3 * Math.PI / 2), Math.PI / 2, 1e-9); assert.equal(G.angWrap(0.5), 0.5);
});
test('sstep: smoothstep with clamped ends', () => {
  assert.equal(G.sstep(-1), 0); assert.equal(G.sstep(2), 1); assert.equal(G.sstep(0.5), 0.5); assert.ok(G.sstep(0.25) < 0.25);
});
test('mulberry: seeded, repeatable, in 0..1', () => {
  const a = G.mulberry(42), b = G.mulberry(42), c = G.mulberry(43);
  const xs = Array.from({ length: 200 }, a);
  assert.deepEqual(Array.from({ length: 200 }, b), xs);
  assert.notEqual(c(), xs[0]);
  assert.ok(xs.every(x => x >= 0 && x < 1));
});
test('gravelDrag: grows with the square of speed up to dragMax', () => {
  const R = G.SURFP[SURF.GRAVEL].roll;
  assert.equal(G.gravelDrag(0), R);
  near(G.gravelDrag(10), R + G.GRAVEL.dragV2 * 100, 1e-12);
  assert.equal(G.gravelDrag(100), G.GRAVEL.dragMax);
});
test('powerFrac: power curve peaks at 0.93 of the redline', () => {
  assert.equal(G.powerFrac(0), 0); assert.equal(G.powerFrac(0.93), 1); assert.equal(G.powerFrac(2), 0.9);
  near(G.powerFrac(0.3), 0.28, 1e-9); // halfway between 0.2 -> 0.16 and 0.4 -> 0.4
  assert.ok(G.powerFrac(0.6) < G.powerFrac(0.8));
});

// --- track model -----------------------------------------------------------
test('T.rel: second half of the lap is negative', () => {
  assert.equal(T.rel(10), 10); near(T.rel(T.L - 10), -10, 1e-9);
});
test('T.wrapS: wraps any distance into 0..L', () => {
  near(T.wrapS(-5), T.L - 5, 1e-9); near(T.wrapS(T.L + 7), 7, 1e-9); assert.equal(T.wrapS(0), 0);
});
test('T.idx: nearest sample index, wrapped', () => {
  assert.equal(T.idx(0), 0); assert.equal(T.idx(T.DS * 10.2), 10); assert.equal(T.idx(-T.DS), T.N - 1); assert.equal(T.idx(T.L), 0);
});
test('T.near: visits the samples around a point', () => {
  const seen = []; T.near(T.X[100], T.Y[100], 10, i => seen.push(i));
  assert.ok(seen.includes(100)); assert.ok(seen.includes(101));
  assert.ok(!seen.includes(T.N >> 1));
});
test('T.nearestGlobal: finds the sample under a point, also far off the track', () => {
  assert.equal(T.nearestGlobal(T.X[500], T.Y[500]), 500);
  const k = T.nearestGlobal(T.bbox.maxx + 5000, T.bbox.maxy + 5000);
  assert.ok(k >= 0 && k < T.N);
});
test('T.project: track distance and lateral offset of a point', () => {
  const out = {}, i = 700, [x, y] = T.pt(i, 3.5);
  T.project(x, y, -1, out);
  assert.equal(out.i, i); near(out.d, 3.5, 1e-6); near(out.s, i * T.DS, 1e-6);
  T.project(x, y, i + 5, out); assert.equal(out.i, i); // with a hint nearby
});
test('T.pt: point at a lateral offset along the normal', () => {
  assert.deepEqual(T.pt(42, 0), [T.X[42], T.Y[42]]);
  const [x, y] = T.pt(42, 2);
  near(Math.hypot(x - T.X[42], y - T.Y[42]), 2, 1e-9);
  near((x - T.X[42]) * T.NX[42] + (y - T.Y[42]) * T.NY[42], 2, 1e-9);
});
test('T.cornerAt: names the section ahead, corners sorted along the lap', () => {
  for (let k = 1; k < T.corners.length; k++) assert.ok(T.corners[k].s >= T.corners[k - 1].s);
  const stowe = T.corners.find(c => c.name === 'Stowe');
  assert.equal(T.cornerAt(stowe.s), 'Stowe');
  assert.equal(T.cornerAt(stowe.s - 100), 'Stowe'); // 120 m before the corner it is announced
  assert.equal(T.corners.length, 19);
});
test('T.PIT.boxS: boxes are boxGap apart in the flat part of the lane', () => {
  const P = T.PIT; near(P.boxS(1) - P.boxS(0), P.boxGap, 1e-9);
  assert.ok(P.boxS(0) > P.flatIn && P.boxS(21) < P.flatOut);
});
test('T.PIT.center: lane offset ramps in, flat in the middle, null outside', () => {
  const P = T.PIT;
  assert.equal(P.center(P.sIn - 1), null); assert.equal(P.center(P.sOut + 1), null);
  assert.equal(P.center((P.flatIn + P.flatOut) / 2), P.d);
  const ramp = P.center(P.sIn + P.ramp / 2); assert.ok(ramp > T.WR[T.idx(P.sIn)] && ramp < P.d);
});
test('T.PIT.halfW: half width grows from 3.6 m to hw', () => {
  const P = T.PIT; near(P.halfW(P.sIn), 3.6, 1e-9); assert.equal(P.halfW((P.flatIn + P.flatOut) / 2), P.hw); near(P.halfW(P.sOut), 3.6, 1e-9);
});
test('T.PIT.inZone: pit zone with 4 m margins', () => {
  const P = T.PIT; assert.ok(P.inZone(P.sIn - 3)); assert.ok(!P.inZone(P.sIn - 5)); assert.ok(P.inZone(P.sOut + 4)); assert.ok(!P.inZone(T.L / 2));
});
test('T.PIT.edge: lane edges, the inner one never over the white line', () => {
  const P = T.PIT, k = T.idx((P.flatIn + P.flatOut) / 2);
  near(P.edge(k, 1, 0), P.d + P.hw, 1e-6); near(P.edge(k, -1, 0), P.d - P.hw, 1e-6);
  for (let s = P.sIn - P.PX; s < P.sOut + P.PX; s += 3) { const q = T.idx(s); assert.ok(P.edge(q, -1, 0.3) >= T.EDGE[0][q] + 0.3 - 1e-6, 's=' + s); }
});
test('T.surface: asphalt, kerb, run-off, grass, wall and pit lane', () => {
  assert.equal(T.surface(800, 800 * T.DS, 0), SURF.ASPH);
  const c = T.corners.find(q => q.name === 'Copse'), i = c.i, side = T.KERB[0][i] > 0 ? 0 : 1, sg = side ? -1 : 1;
  assert.equal(T.surface(i, i * T.DS, sg * (T.EDGE[side][i] + 0.1)), SURF.KERB);
  assert.equal(T.surface(i, i * T.DS, sg * (T.WALL[side][i] + 1)), SURF.WALL);
  const sm = (T.PIT.flatIn + T.PIT.flatOut) / 2, k = T.idx(sm);
  assert.equal(T.surface(k, T.wrapS(sm), T.PIT.d), SURF.PIT);
  assert.equal(T.surface(k, T.wrapS(sm), T.WR[k] + 1), SURF.RUN); // the strip beside the pit lane
  const kinds = new Set(); for (let j = 0; j < T.N; j += 7) for (const d of [-30, -15, 15, 30]) kinds.add(T.surface(j, j * T.DS, d));
  for (const s of [SURF.GRAVEL, SURF.GRASS, SURF.RUN]) assert.ok(kinds.has(s), 'surface ' + s + ' exists');
});
test('T.speedProfile: more grip gives a faster lap, speeds within top gear', () => {
  const lo = T.speedProfile(1.2), hi = T.speedProfile(1.7);
  assert.ok(hi.lapTime < lo.lapTime);
  assert.ok(Math.max(...hi.V) <= PHYS.gears[6] + 1e-9);
  near(T.speedProfile(PHYS.mu * 0.97).lapTime, T.refLap, 1e-9);
  assert.ok(T.refLap > 115 && T.refLap < 135, 'ideal lap about 2:08: ' + T.refLap);
});
test('T.LL.off: Long Lap lane runs out about 22 m and back', () => {
  const LL = T.LL, mid = LL.off(LL.sM), a = LL.off(LL.sA);
  assert.ok(mid > a + 10, `${mid} > ${a} + 10`);
  assert.ok(mid <= T.EDGE[LL.side][T.idx(LL.sM)] + T.KERB[LL.side][T.idx(LL.sM)] + LL.w / 2 + 22 + 1e-6);
});
test('T.inLL: inside the lane only between sA and sB on the outside', () => {
  const LL = T.LL;
  assert.ok(T.inLL(LL.sM, LL.sg * LL.off(LL.sM)));
  assert.ok(!T.inLL(LL.sM, 0));
  assert.ok(!T.inLL(LL.sM, -LL.sg * LL.off(LL.sM)));
  assert.ok(!T.inLL(LL.sB + 5, LL.sg * LL.off(LL.sB)));
});

// --- bike ------------------------------------------------------------------
test('makeBike: defaults with overrides', () => {
  const b = G.makeBike({ name: 'X', num: 9 });
  assert.equal(b.name, 'X'); assert.equal(b.num, 9); assert.equal(b.gear, 1); assert.equal(b.fuel, PHYS.tank);
  assert.deepEqual(b.dmg, { e: 0, a: 0, c: 0 });
  assert.notEqual(G.makeBike({}).ctl, G.makeBike({}).ctl, 'each bike has its own controls');
});
test('bikeVel, setVel: world velocity from heading, forward and side speed', () => {
  const b = G.makeBike({ h: Math.PI / 2, v: 10, vs: 2 });
  const [vx, vy] = G.bikeVel(b); near(vx, -2, 1e-9); near(vy, 10, 1e-9);
  G.setVel(b, vx, vy); near(b.v, 10, 1e-9); near(b.vs, 2, 1e-9);
  G.setVel(b, 0, -5); assert.equal(b.v, 0, 'no reversing');
});
test('rpmFor: redline at the top speed of the gear', () => {
  assert.equal(G.rpmFor(PHYS.gears[3], 3), PHYS.redline); near(G.rpmFor(PHYS.gears[3] / 2, 3), PHYS.redline / 2, 1e-9);
});
test('shift: up and down, limits, over-rev protection', () => {
  const b = G.makeBike({ gear: 3, v: 10 });
  assert.equal(G.shift(b, 1), true); assert.equal(b.gear, 4); assert.ok(b.shiftCut > 0);
  b.gear = 6; assert.equal(G.shift(b, 1), false);
  b.gear = 1; assert.equal(G.shift(b, -1), false);
  b.gear = 4; b.v = PHYS.gears[3] * 1.05; assert.equal(G.shift(b, -1), false); assert.equal(b.gear, 4); assert.ok(b.overrev > 0);
  b.crashed = true; b.v = 1; assert.equal(G.shift(b, -1), false);
});
test('autoBox: shifts up near the redline and down when slow', () => {
  const b = G.makeBike({ gear: 2, v: PHYS.gears[2] * 0.99 }); G.autoBox(b); assert.equal(b.gear, 3);
  const c = G.makeBike({ gear: 5, v: 20 }); G.autoBox(c); assert.equal(c.gear, 4);
  const d = G.makeBike({ gear: 3, v: PHYS.gears[3] * 0.8 }); G.autoBox(d); assert.equal(d.gear, 3);
});
test('stepBike: throttle accelerates, uses fuel and counts distance', () => {
  const { G, b } = soloBike({ auto: true });
  const f0 = b.fuel; b.ctl.thr = 1;
  run(G, b, 3);
  assert.ok(kmh(b.v) > 100, 'about 3 s from standstill: ' + kmh(b.v));
  assert.ok(b.fuel < f0); assert.ok(b.dist > 30 && b.dist < 80, "distance " + b.dist); run(G, b, 3); assert.ok(b.gear >= 3, "auto gearbox shifted: " + b.gear);
});
test('stepBike: brakes, engine braking and the rev limiter', () => {
  const { G, b } = soloBike({ v: 60, gear: 6 });
  b.ctl.brk = 1; run(G, b, 1);
  assert.ok(b.v < 60 - 10, 'about 1.5 g: ' + b.v);
  const c = soloBike({ v: PHYS.gears[1] * 1.02, gear: 1 }).b; c.ctl.thr = 1; const v0 = c.v;
  G.stepBike(c, G.SUB, G.W); assert.ok(c.v < v0, 'no drive above the limiter');
});
test('stepBike: held bikes stand and rev, dnf bikes do nothing', () => {
  const { G, b } = soloBike({ held: true, v: 5 }); b.ctl.thr = 1;
  run(G, b, 1); assert.equal(b.v, 0); assert.ok(b.rpm > 12000);
  b.held = false; b.dnf = true; b.v = 10; const x = b.x; G.stepBike(b, 0.1, G.W); assert.equal(b.x, x);
});
test('stepBike: no fuel, no drive', () => {
  const { G, b } = soloBike({ v: 20, gear: 2, fuel: 0 }); b.ctl.thr = 1;
  run(G, b, 0.5); assert.ok(b.v < 20);
});
test('stepBike: lean follows the target at a limited roll rate', () => {
  const { G, b } = soloBike({ v: 40, gear: 3 }); b.ctl.leanT = PHYS.maxLean; b.ctl.thr = 0.3;
  G.stepBike(b, 0.05, G.W); assert.ok(b.lean > 0 && b.lean < 0.2);
  run(G, b, 1); assert.ok(b.lean > 0.5); assert.ok(Math.abs(G.angWrap(b.h - T.H[b.i])) > 0.05, 'the bike turned');
});
test('stepBike: too much brake in a full lean without aids crashes', () => {
  const { G, b } = soloBike({ v: 55, gear: 5, assist: false, lean: PHYS.maxLean });
  run(G, b, 1.5, x => { if (!x.crashed) { x.ctl.leanT = PHYS.maxLean; x.ctl.brk = 1; } });
  assert.equal(b.crashed, true); assert.equal(b.crash.why, 'lowside');
});
test('stepBike: gravel, held throttle without aids digs the rear wheel in', () => {
  const { G, b } = soloBike({ assist: false, gear: 1 }); b.surf = SURF.GRAVEL; b.ctl.thr = 1;
  run(G, b, 1); assert.equal(b.dig, true); assert.ok(b.digT > 0.5); assert.ok(kmh(b.v) < 5);
  const w = soloBike({ assist: true, gear: 1 }).b; w.surf = SURF.GRAVEL; w.ctl.thr = 1;
  run(G, w, 1); assert.equal(w.dig, false); assert.ok(kmh(w.v) > 5);
});
test('crashBike: the bike goes down once, damage and a message', () => {
  const { G, b } = soloBike({ v: 50, gear: 4 });
  G.crashBike(b, G.W, 'highside');
  assert.equal(b.crashed, true); assert.equal(b.crashes, 1); assert.equal(b.crash.why, 'highside');
  assert.ok(b.dmg.a > 0 && b.dmg.c > 0 && b.dmg.e > 0);
  assert.equal(G.HUD.m.t, 'CRASH'); assert.equal(G.HUD.m.sub, 'Highside, rider down');
  near(Math.hypot(b.crash.bk.vx, b.crash.bk.vy), 50 * 0.95, 1e-6);
  G.crashBike(b, G.W, 'lowside'); assert.equal(b.crashes, 1, 'already down');
});
test('stepCrash: bike and rider slide to a stop, then rejoin', () => {
  const { G, b } = soloBike({ v: 30, gear: 3 });
  G.crashBike(b, G.W, 'lowside');
  const sp0 = Math.hypot(b.crash.bk.vx, b.crash.bk.vy);
  G.stepCrash(b, 0.2, G.W); assert.ok(Math.hypot(b.crash.bk.vx, b.crash.bk.vy) < sp0);
  assert.ok(G.FX.mn > 0, 'tyre marks');
  for (let t = 0; t < 20 && b.crashed; t += 0.05) G.stepCrash(b, 0.05, G.W);
  assert.equal(b.crashed, false); assert.equal(G.HUD.m.t, 'REJOIN');
});
test('respawn: back on the track standing, or retired with a broken engine', () => {
  const { G, b } = soloBike({ v: 20 });
  G.crashBike(b, G.W, 'lowside'); b.crash.bk.x += T.NX[b.i] * 25; b.crash.bk.y += T.NY[b.i] * 25;
  G.respawn(b, G.W);
  assert.equal(b.crashed, false); assert.equal(b.v, 0); assert.equal(b.gear, 1); assert.equal(b.respawnGrace, 2);
  assert.ok(Math.abs(b.d) < T.WR[b.i], 'inside the track edge');
  const c = soloBike({ v: 20 }).b; G.crashBike(c, G.W, 'lowside'); c.dmg.e = 1;
  G.respawn(c, G.W); assert.equal(c.dnf, true); assert.equal(G.HUD.m.t, 'RETIRED');
});
test('aiControl: throttle below the target speed, brakes above it', () => {
  const g = load(); const { G } = g;
  G.setupSession('sprint', G.UI.sessionOpts({ train: null }));
  const b = G.W.bikes.find(x => !x.isPlayer); G.W.bikes = [b];
  placeAt(G, b, 300, 0); b.held = false; b.v = 20; b.ai.think = 0;
  G.aiControl(b, G.SUB, G.W); assert.ok(b.ctl.thr > 0.5); assert.equal(b.ctl.brk, 0);
  const stowe = T.corners.find(c => c.name === 'Stowe'); placeAt(G, b, stowe.s - 40, 0); b.v = 90;
  G.aiControl(b, G.SUB, G.W); assert.equal(b.ctl.thr, 0); assert.ok(b.ctl.brk > 0.5);
  b.crashed = true; b.ctl.thr = 0.42; G.aiControl(b, G.SUB, G.W); assert.equal(b.ctl.thr, 0.42, 'crashed: untouched');
});
test('aiControl: keeps to the pit speed limit in the lane', () => {
  const { G } = load();
  G.setupSession('sprint', G.UI.sessionOpts({ train: null }));
  const b = G.W.bikes.find(x => !x.isPlayer); G.W.bikes = [b];
  const sm = (T.PIT.limIn + T.PIT.limOut) / 2; placeAt(G, b, sm, T.PIT.d);
  b.held = false; b.inPitLane = true; b.v = PHYS.pitLimit + 5;
  G.aiControl(b, G.SUB, G.W); assert.equal(b.ctl.thr, 0); assert.ok(b.ctl.brk > 0);
});

test('maxLeanAt: zero when stopped, the grip maximum from about 50 km/h to 150 km/h, 40 degrees at 300 km/h', () => {
  const { G } = load(); const DEG = Math.PI / 180, KMH = k => k / 3.6;
  near(G.maxLeanAt(0), 0, 1e-12, 'stopped: no lean');
  near(G.maxLeanAt(KMH(25)), G.PHYS.maxLean / 2, 0.01, '25 km/h: half');
  near(G.maxLeanAt(KMH(50)), G.PHYS.maxLean, 1e-9, '50 km/h: full');
  near(G.maxLeanAt(KMH(150)), G.PHYS.maxLean, 1e-9, '150 km/h: still full');
  near(G.maxLeanAt(KMH(300)), 40 * DEG, 1e-9, '300 km/h');
  near(G.maxLeanAt(KMH(400)), 40 * DEG, 1e-9, 'faster stays at 40');
  assert.ok(G.maxLeanAt(KMH(10)) < G.maxLeanAt(KMH(30)), 'rises with speed from standstill');
});

test('leanRate: the slower of the rider limit and the damping (300 km/h in m/s, over v)', () => {
  const { G } = load(); const KMH = k => k / 3.6;
  near(G.leanRiderRate(), 1.6, 0.01, 'a 67 kg rider gives the fitted 1.6 rad/s');
  assert.ok(G.leanRate(KMH(300)) < G.leanRate(KMH(100)), 'slower at speed');
  near(G.leanRate(0), 1.6, 0.01, 'stopped: the rider limits');
  near(G.leanRate(KMH(150)), 1.6, 0.01, '150 km/h: still the rider limit');
  near(G.leanRate(KMH(300)), 1.0, 1e-9, '300 km/h: the damping limits, 300 km/h / v');
  near(G.leanRate(KMH(400)), (300 / 3.6) / KMH(400), 1e-9, 'faster falls further');
});
test('leanRiderRate: a heavier rider rolls the bike faster, from the momentum they transfer', () => {
  const { G } = load(); const m0 = G.PHYS.massRider;
  const base = G.leanRiderRate();
  G.PHYS.massRider = 80; const heavy = G.leanRiderRate();
  G.PHYS.massRider = 55; const light = G.leanRiderRate();
  G.PHYS.massRider = m0;
  assert.ok(light < base && base < heavy, `${light.toFixed(3)} < ${base.toFixed(3)} < ${heavy.toFixed(3)}`);
  assert.equal(G.leanRiderRate(), base, 'restored');
});

// lean behaviour in the physics (GDD 11m): the lean moves no faster than leanRate, a swing takes the time that rate
// gives, and the lean stays under the speed cap. The speed is held fixed so only the lean is measured.
const holdSpeed = v => (b => { b.v = v; });
test('stepBike: at low speed the lean never moves faster than the roll rate, and a full swing takes about 1.2 s', () => {
  const v = 60 / 3.6, { G, b } = soloBike({ v, gear: 2 }); b.lean = 0.95; b.ctl.leanT = -0.95; // 60 km/h: the full lean cap
  let worst = 0, t = 0, t1 = null;
  for (let k = 0; k < 400 && t1 === null; k++) {
    const before = b.lean; holdSpeed(v)(b); G.stepBike(b, G.SUB, G.W);
    worst = Math.max(worst, Math.abs(b.lean - before) / G.SUB); t += G.SUB;
    if (b.lean <= -0.94) t1 = t;
  }
  assert.ok(t1 !== null, 'the lean reached the target');
  assert.ok(worst <= G.leanRate(v) * 1.02, `roll rate ${worst.toFixed(3)} rad/s above ${G.leanRate(v).toFixed(3)}`);
  assert.ok(t1 > 1.05 && t1 < 1.3, `swing took ${t1.toFixed(2)} s, expected about 1.2 s`);
});
test('stepBike: at 300 km/h the lean moves at 1.0 rad/s, so 0.8 rad takes about 0.8 s', () => {
  const v = 300 / 3.6, { G, b } = soloBike({ v, gear: 6 }); b.lean = 0.4; b.ctl.leanT = -0.4;
  let worst = 0, t = 0, t1 = null;
  for (let k = 0; k < 400 && t1 === null; k++) {
    const before = b.lean; holdSpeed(v)(b); G.stepBike(b, G.SUB, G.W);
    worst = Math.max(worst, Math.abs(b.lean - before) / G.SUB); t += G.SUB;
    if (b.lean <= -0.39) t1 = t;
  }
  assert.ok(t1 !== null, 'the lean reached the target');
  assert.ok(worst <= 1.0 * 1.02, `roll rate ${worst.toFixed(3)} rad/s above 1.0`);
  assert.ok(t1 > 0.7 && t1 < 0.9, `swing took ${t1.toFixed(2)} s, expected about 0.8 s`);
});
test('stepBike: at 300 km/h a steering demand of 69 degrees is held to the speed cap of 40 degrees', () => {
  const v = 300 / 3.6, { G, b } = soloBike({ v, gear: 6 }); b.ctl.leanT = 1.2;
  let peak = 0;
  for (let t = 0; t < 4; t += G.SUB) { holdSpeed(v)(b); G.stepBike(b, G.SUB, G.W); peak = Math.max(peak, b.lean); }
  assert.ok(peak < 1.2, 'held below the demand');
  near(peak, 40 * Math.PI / 180, 0.01, 'peak lean');
});
test('stepBike: at low speed the lean is free to go past the 300 km/h cap, up to the grip limit', () => {
  const v = 40 / 3.6, { G, b } = soloBike({ v, gear: 2 }); b.ctl.leanT = 1.2;
  let peak = 0;
  for (let t = 0; t < 4; t += G.SUB) { holdSpeed(v)(b); G.stepBike(b, G.SUB, G.W); peak = Math.max(peak, b.lean); }
  assert.ok(peak > 50 * Math.PI / 180, `peak ${(peak * 180 / Math.PI).toFixed(1)} deg, expected past 50`);
});
