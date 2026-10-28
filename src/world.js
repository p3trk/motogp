
// ---------------------------------------------------------------------------
// Effects: particles + tyre marks
// ---------------------------------------------------------------------------
const FX = {
  parts: [], marks: new Float32Array(6 * 5000), mi: 0, mn: 0, rand: Math.random,
  add(p) { if (this.parts.length < 1400) this.parts.push(p); },
  spark(x, y, vx, vy) { for (let k = 0; k < 2; k++) this.add({ t: 'spark', x, y, vx: vx * 0.6 + (this.rand() - 0.5) * 10, vy: vy * 0.6 + (this.rand() - 0.5) * 10, life: 0.25 + this.rand() * 0.25, age: 0 }); },
  smoke(x, y, vx, vy, a) { this.add({ t: 'smoke', x, y, vx: vx * 0.3 + (this.rand() - 0.5), vy: vy * 0.3 + (this.rand() - 0.5), life: 1.2 + this.rand(), age: 0, a: a || 0.35, r: 0.5 }); },
  dust(x, y, sf) { this.add({ t: sf === SURF.GRAVEL ? 'dust' : 'grass', x: x + (this.rand() - 0.5), y: y + (this.rand() - 0.5), vx: (this.rand() - 0.5) * 4, vy: (this.rand() - 0.5) * 4, life: 1 + this.rand() * 0.8, age: 0, r: 0.6 }); },
  mark(x, y, vx, vy, a) {
    const sp = Math.hypot(vx, vy) || 1; const k = this.mi * 6; const len = Math.min(0.9, sp * 0.02);
    this.marks[k] = x - vx / sp * len; this.marks[k + 1] = y - vy / sp * len; this.marks[k + 2] = x; this.marks[k + 3] = y; this.marks[k + 4] = a; this.marks[k + 5] = 0;
    this.mi = (this.mi + 1) % 5000; this.mn = Math.min(5000, this.mn + 1);
  },
  step(dt) {
    for (const p of this.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; const f = p.t === 'spark' ? 2 : 1.6; p.vx *= Math.exp(-dt * f); p.vy *= Math.exp(-dt * f); if (p.r) p.r += dt * (p.t === 'smoke' ? 1.6 : 0.6); }
    this.parts = this.parts.filter(p => p.age < p.life);
  },
  clear() { this.parts = []; this.mi = 0; this.mn = 0; }
};

// ---------------------------------------------------------------------------
// World / session
// ---------------------------------------------------------------------------
const W = {
  bikes: [], ghosts: [], player: null, mode: 'practice', kind: 'practice', totalLaps: 0, time: 0, phase: 'run', flag: false, rand: mulberry(7),
  infiniteFuel: false, fx: FX, passT: null, lights: 0, lightsOutAt: 0, raceStartT: 0, msgs: [], opts: null, qualiAI: null, qualiGrid: null,
  finishOrder: [], paused: false, resultsShown: false, endTimer: 0, bestTrace: null, curTrace: null,
  event(b, type, info) {
    if (type === 'crash') { if (b.isPlayer) HUD.msg('CRASH', info === 'highside' ? 'Highside, rider down' : info === 'gravel' ? 'Down in the gravel' : 'Front tucked, lowside', '#e3312a', 3); else if (W.player && Math.hypot(b.x - W.player.x, b.y - W.player.y) < 400) HUD.ticker(`#${b.num} ${b.short} crashed at ${T.cornerAt(b.s)}`); }
    if (type === 'dnf') { if (b.isPlayer) HUD.msg('RETIRED', 'Engine damage too heavy to continue', '#e3312a', 4); else HUD.ticker(`#${b.num} ${b.short} retires`); }
    if (type === 'rejoin' && b.isPlayer) HUD.msg('REJOIN', 'Bike back on track. Watch the damage.', '#ffcf1f', 2);
  }
};
FX.rand = W.rand;


// ---------------------------------------------------------------------------
// Lap records, kept in this browser between sessions
// ---------------------------------------------------------------------------
const Records = {
  d: { v: 1, laps: [], best: {}, trace: null, traceT: 0 },
  load() { try { const r = JSON.parse(localStorage.getItem('sgp_records') || 'null'); if (r && r.v === 1) this.d = Object.assign(this.d, r); } catch (e) { } },
  save() { try { localStorage.setItem('sgp_records', JSON.stringify(this.d)); } catch (e) { } },
  allBest() { let b = 0; for (const k in this.d.best) if (this.d.best[k] && (!b || this.d.best[k].t < b)) b = this.d.best[k].t; return b; },
  add(mode, t, b, trace) {
    const e = { t: +t.toFixed(3), mode, at: Date.now(), aids: b.assist ? 1 : 0, auto: b.auto ? 1 : 0, s: b.lastSec.map(x => +x.toFixed(3)) };
    this.d.laps.push(e); if (this.d.laps.length > 300) this.d.laps.splice(0, this.d.laps.length - 300);
    const cur = this.d.best[mode]; const pb = !cur || t < cur.t; if (pb) this.d.best[mode] = e;
    const allPb = !this.d.traceT || t < this.d.traceT;
    if (allPb && trace) { this.d.trace = Array.from(trace, x => Math.round(x * 100) / 100); this.d.traceT = e.t; }
    this.save(); return { pb, allPb };
  },
  clear() { this.d = { v: 1, laps: [], best: {}, trace: null, traceT: 0 }; this.save(); }
};
Records.load();

const AI_LEVEL = { rookie: 0.905, pro: 0.955, legend: 0.99 };

function setupSession(kind, opts) {
  W.opts = opts; W.kind = kind; W.mode = kind === 'practice' ? 'practice' : kind === 'quali' ? 'quali' : 'race';
  W.totalLaps = kind === 'sprint' ? 10 : kind === 'gp' ? 20 : 0;
  W.time = 0; W.raceStartT = 0; W.flag = false; W.finishOrder = []; W.resultsShown = false; W.endTimer = 0; W.msgs = []; W.paused = false;
  W.rand = mulberry((Math.random() * 1e9) | 0); FX.rand = W.rand; FX.clear();
  W.infiniteFuel = false;
  W.bikes = [];
  const team = opts.team;
  // 21 AI riders + player; the player takes a seat in the chosen team
  const pool = RIDERS.map((r, k) => ({ name: r[0], num: r[1], nat: r[2] }));
  const teamSeats = []; for (let t = 0; t < TEAMS.length; t++) teamSeats.push(t, t);
  teamSeats.splice(teamSeats.indexOf(team), 1);
  const rr = mulberry(1234);
  const skills = pool.map((p, k) => ({ p, sk: rr() }));
  const pBike = makeBike({ id: 0, name: opts.name, short: opts.name.toUpperCase().slice(0, 3), num: opts.num, team, isPlayer: true, assist: opts.aids, auto: opts.auto, box: 0 });
  pBike.ai = { pace: 0.95, off: 0, offT: 0, think: 0, cons: 1, mistake: 0, passSide: 0 };
  W.player = pBike; W.bikes.push(pBike);
  if (W.mode !== 'quali' && W.mode !== 'practice') {
    skills.forEach((o, k) => {
      const b = makeBike({ id: k + 1, name: o.p.name, short: o.p.name.split(' ').slice(-1)[0].replace(/'/g, '').toUpperCase().slice(0, 3), num: o.p.num, nat: o.p.nat, team: teamSeats[k], assist: true, auto: true, box: k + 1 });
      b.ai = { pace: AI_LEVEL[opts.level] * (0.972 + 0.028 * o.sk), off: 0, offT: 0, think: W.rand() * 0.2, cons: 0.4 + 0.6 * o.sk, mistake: 0, passSide: 0, react: 0.12 + W.rand() * 0.25 };
      W.bikes.push(b);
    });
  }
  // ghost opponents (GDD 11c): in a race each one takes the place of one of the slowest AI riders;
  // in practice they start with the player on the grid or on the curve-training spot (GDD 1.16.0)
  W.train = W.mode === 'practice' && opts.train ? opts.train : null;
  W.gridStart = W.mode === 'practice' && !W.train; W.startT = -1; W.lineT = -1;
  W.gridSlot = W.gridStart ? GRID_SLOT[opts.gridPos] ?? 11 : -1;
  Ghost.setup(opts.ghosts || [], opts.syncId);
  if (W.mode === 'race') for (const b of W.bikes.filter(b => !b.isPlayer).sort((a, b) => a.ai.pace - b.ai.pace).slice(0, W.ghosts.length)) W.bikes.splice(W.bikes.indexOf(b), 1);
  // box assignment: teammates share neighbouring boxes in team order
  const order = W.bikes.slice().sort((a, b) => a.team - b.team || a.id - b.id); order.forEach((b, k) => b.box = k);
  const N = T.N;
  if (W.mode === 'race') {
    // grid order
    let grid;
    if (opts.qualiGrid) grid = opts.qualiGrid.map(id => W.bikes.find(b => b.id === id)).filter(Boolean);
    else {
      const ais = W.bikes.filter(b => !b.isPlayer).sort((a, b) => b.ai.pace - a.ai.pace + (W.rand() - 0.5) * 0.012);
      const slot = GRID_SLOT[opts.gridPos] ?? 11;
      ais.splice(slot, 0, pBike); grid = ais;
    }
    grid.forEach((b, k) => {
      const { sr, i, d } = gridPose(k), [x, y] = T.pt(i, d);
      Object.assign(b, { x, y, h: T.H[i], i, s: T.wrapS(sr), d, prevS: T.wrapS(sr), held: true, gridCross: true, lap: 0, gear: 1, grid: k + 1 });
      b.fuel = b.isPlayer ? PHYS.tank * opts.fuelPct : aiStartFuel(b);
      b.fuelLapStart = b.fuel;
    });
    W.phase = 'grid'; W.lights = 0; W.phaseT = 0;
  } else {
    // qualifying: start from the box; practice: on the chosen grid slot or the curve-training spot (GDD 2a, 11d)
    const b = pBike; const sr = T.PIT.boxS(b.box); const i = T.idx(sr);
    const [x, y] = T.pt(i, T.PIT.boxD - 0.5);
    Object.assign(b, { x, y, h: T.H[i], i, s: T.wrapS(sr), d: T.PIT.boxD - 0.5, prevS: T.wrapS(sr), outLap: true, lap: 0 });
    b.fuel = W.mode === 'quali' ? 12 : PHYS.tank; b.fuelLapStart = b.fuel;
    if (W.train) placeTraining(b, W.train);
    else if (W.gridStart) placeGrid(b, W.gridSlot);
    W.phase = 'run'; W.lights = 0;
    if (W.mode === 'quali') W.qualiAI = simulateQualiAI(opts);
  }
  const nb = Math.ceil((Math.max(W.totalLaps, 1) + 3) * T.L / 10) + 200;
  W.passT = new Float64Array(nb).fill(-1);
  W.curTrace = new Float32Array(Math.ceil(T.L / 10) + 2).fill(-1);
  W.bestTrace = Records.d.trace && Records.d.trace.length === W.curTrace.length ? Float32Array.from(Records.d.trace) : null; W.bestTraceT = Records.d.traceT || 0;
  W.guide = W.mode === 'practice' && opts.guide; W.recordMsg = '';
  HUD.reset();
  const ref = W.syncRef; // the start message names the reference ghost's speed at the spot (GDD 11c)
  if (W.train) HUD.msg('CURVE TRAINING', T.cornerAt(W.train.s) + ' · ' + Math.round(W.train.v * 3.6) + ' km/h' + (ref ? ' · ghost ' + ref.short + ' ' + Math.round(ref.vSpot * 3.6) + ' km/h' : ''), '#ffcf1f', 3, true);
  else if (W.mode === 'practice') HUD.msg('FREE PRACTICE', 'P' + (W.gridSlot + 1) + ' on the grid · press W, S, A or D to go', '#ffcf1f', 4, true);
  if (W.mode === 'quali') HUD.msg('QUALIFYING', 'Out lap, then 3 flying laps. Best lap sets your grid slot.', '#ffcf1f', 4);
}
// grid slot k (0 = pole): 3 bikes per row, the same boxes in a race and in practice (GDD 2a)
const GRID_SLOT = { pole: 0, front: 2, mid: 11, back: 21 };
function gridPose(k) { const r = Math.floor(k / 3), c = k % 3, sr = -8 - r * 9.5 - c * 2.4; return { sr, i: T.idx(sr), d: (1 - c) * 3.9 }; }
// practice grid start (GDD 2a): standing on the slot, frozen until the first input; lap 1 is a standing-start lap
function placeGrid(b, k) {
  const { sr, i, d } = gridPose(k), [x, y] = T.pt(i, d), s = T.wrapS(sr);
  Object.assign(b, { x, y, h: T.H[i], i, s, d, prevS: s, v: 0, gear: 1, outLap: false, gridCross: true, lap: 0, grid: k + 1, trainHold: true });
}
// curve training (GDD 11d): centre of the road at the chosen spot, frozen until the first input
function placeTraining(b, tr) {
  const s = T.wrapS(tr.s), i = T.idx(s), [x, y] = T.pt(i, 0);
  let gear = 6; for (let g = 1; g <= 6; g++) if (rpmFor(tr.v, g) <= 15000) { gear = g; break; }
  Object.assign(b, { x, y, h: T.H[i], i, s, d: 0, prevS: s, v: tr.v, vs: 0, lean: 0, gear, outLap: true, lap: 0, dist: 3000, trainHold: true });
  b.rpm = b.rpmVis = Math.max(PHYS.idle, rpmFor(tr.v, gear));
}
function aiStartFuel(b) {
  // AI strategies: most start full and stop once / twice; some start light
  const laps = W.totalLaps, per = 2.65;
  const need = laps * per; if (need <= PHYS.tank) return Math.min(PHYS.tank, need + 0.6);
  const stops = Math.ceil(need / PHYS.tank) - 1;
  const light = W.rand() < 0.35;
  return light ? Math.min(PHYS.tank, need / (stops + 1) + 1.2) : PHYS.tank;
}
function simulateQualiAI(opts) {
  const rr = mulberry(1234);
  return RIDERS.map((r, k) => {
    const sk = rr(); const pace = AI_LEVEL[opts.level] * (0.972 + 0.028 * sk);
    const base = T.refLap * AI_REAL / pace - 0.35;
    const laps = [0, 1, 2].map(() => base * (1 + 0.0025 * (W.rand() * 2 - 0.4)) + (W.rand() < 0.12 ? 1.2 + W.rand() * 2 : 0));
    return { id: k + 1, name: r[0], num: r[1], best: Math.min(...laps), team: null, sk };
  });
}
let AI_REAL = 0.99; // measured ratio of real AI lap time to the ideal speed profile

// ---------------------------------------------------------------------------
// Simulation step
// ---------------------------------------------------------------------------
const SUB = 1 / 120;
function simStep(dt) {
  W.time += dt;
  const bikes = W.bikes;
  for (const b of bikes) { b.px = b.x; b.py = b.y; b.ph = b.h; } // pose before this step, for drawing between steps
  for (const g of W.ghosts) { g.px = g.x; g.py = g.y; g.ph = g.h; }
  // race start procedure
  if (W.mode === 'race' && W.phase === 'grid') { W.phase = 'lights'; W.phaseT = 0; W.lightsHold = 0.6 + W.rand() * 1.8; } // no grid wait: lights start at once (GDD 1.7.2)
  else if (W.phase === 'lights') {
    W.phaseT += dt; W.lights = Math.min(5, Math.floor(W.phaseT / 0.9) + 1);
    if (W.phaseT > 4.5 + W.lightsHold) { W.phase = 'run'; W.lights = -1; W.raceStartT = W.time; for (const b of bikes) { b.lapStartT = W.time; b.secStart = W.time; if (b.isPlayer) b.held = false; else b.releaseAt = W.time + b.ai.react; } HUD.msg('GO!', '', '#3ad17a', 1.2); }
  }
  for (const b of bikes) if (b.held && b.releaseAt && W.time >= b.releaseAt) { b.held = false; b.releaseAt = 0; }
  // drafting
  for (const b of bikes) {
    b.draft = 0; if (b.crashed || b.v < 30) continue;
    for (const o of bikes) {
      if (o === b || o.crashed || o.dnf) continue;
      let ds = o.s - b.s; if (ds < -T.L / 2) ds += T.L; if (ds > T.L / 2) ds -= T.L;
      if (ds > 2 && ds < 32 && Math.abs(o.d - b.d) < 1.5) b.draft = Math.max(b.draft, 1 - (ds - 2) / 30);
    }
  }
  // controls
  for (const b of bikes) { if (b.isPlayer && !b.autopilot) playerControl(b, dt); else aiControl(b, dt, W); }
  for (const b of bikes) {
    const pd = b.d;
    if (b.trainHold) { const K = Input.k; if (K.KeyW || K.KeyS || K.KeyA || K.KeyD || K.ArrowUp || K.ArrowDown || K.ArrowLeft || K.ArrowRight || Touch.gas || Touch.brk || Touch.tilt !== 0) b.trainHold = false; else continue; }
    if (b.isPlayer && W.startT < 0 && W.mode === 'practice') startMoment(b);
    stepBike(b, dt, W);
    if (b.crashed || b.dnf) continue;
    T.project(b.x, b.y, b.i, b);
    b.surf = T.surface(b.i, b.s, b.d);
    if (b.surf === SURF.WALL) { wallHit(b); if (b.crashed) continue; T.project(b.x, b.y, b.i, b); b.surf = T.surface(b.i, b.s, b.d); if (b.surf === SURF.WALL) b.surf = SURF.GRASS; }
    pitWall(b, pd);
    pitLogic(b, dt);
    timing(b);
    effects(b, dt);
  }
  Ghost.step(); Rec.sample();
  collide(bikes);
  FX.step(dt);
  for (const b of bikes) if (b.crashed) { b.prevS = b.s; }
}

// the first input on the grid or the spot: lap 1 is timed from here and the ghosts start moving (GDD 2a, 11c)
function startMoment(b) {
  W.startT = W.time;
  if (W.gridStart) { b.lapStartT = W.time; b.secStart = W.time; }
  if (Rec.cur) Rec.cur.start.t = r2(W.time, 1000);
}

function playerControl(b, dt) {
  const K = Input.k, c = b.ctl;
  const brk = K.KeyS || K.ArrowDown || Touch.brk;
  const gas = K.KeyW || K.ArrowUp || (Touch.gas && !Touch.brk); // on touch the brake wins (GDD 3a)
  const left = K.KeyA || K.ArrowLeft, right = K.KeyD || K.ArrowRight;
  c.thr = clamp(c.thr + (gas ? 7 : -9) * dt, 0, 1);
  c.brk = clamp(c.brk + (brk ? 8 : -12) * dt, 0, 1);
  let st = (right ? 1 : 0) - (left ? 1 : 0);
  if (Touch.on && !left && !right) st = Touch.tilt; // phone tilt (GDD 3a)
  c.steer = st; c.leanT = st * PHYS.maxLean;
  if (W.phase !== 'run' && W.mode === 'race') { c.brk = 1; }
  if (b.limiter && b.v > PHYS.pitLimit - 0.3) { c.thr = Math.min(c.thr, 0.0); if (b.v > PHYS.pitLimit + 0.5) c.brk = Math.max(c.brk, clamp((b.v - PHYS.pitLimit) * 0.25, 0, 1)); }
  if (b.service) {
    c.thr = 0; c.brk = 1;
    if (!gas) b.needRelease = false;
    if (gas && !b.needRelease) endService(b);
  }
  if (b.finished && W.mode === 'race') { b.autopilot = true; }
}

function wallHit(b) {
  const side = b.d >= 0 ? 0 : 1, sg = side ? -1 : 1;
  const wd = T.WALL[side][b.i];
  const nx = T.NX[b.i] * sg, ny = T.NY[b.i] * sg;
  const [vx, vy] = bikeVel(b); const vn = vx * nx + vy * ny;
  const pen = Math.abs(b.d) - (wd - 0.6); b.x -= nx * pen; b.y -= ny * pen;
  if (vn > 9.5 || (vn > 6.5 && W.rand() < 0.5)) { crashBike(b, W, 'wall'); if (b.crash) { for (const o of [b.crash.bk, b.crash.rd]) { const on = o.vx * nx + o.vy * ny; if (on > 0) { o.vx -= nx * on * 1.3; o.vy -= ny * on * 1.3; } } } return; }
  if (vn > 0) {
    const nvx = vx - nx * vn * 1.35, nvy = vy - ny * vn * 1.35;
    const sp = Math.hypot(nvx, nvy) * 0.9;
    if (sp > 1) b.h = Math.atan2(nvy, nvx);
    b.v = sp; b.vs = 0; b.lean *= 0.4;
    b.dmg.a = Math.min(1, b.dmg.a + vn * 0.025); b.dmg.c = Math.min(1, b.dmg.c + vn * 0.012);
    for (let k = 0; k < 6; k++) FX.spark(b.x + nx * 0.5, b.y + ny * 0.5, vx, vy);
    if (b.isPlayer) { HUD.shake = Math.min(1, vn / 6); Sound.hit(vn / 8); }
  }
}
function pitWall(b, pd) {
  const P = T.PIT, sr = T.rel(b.s);
  if (sr < P.flatIn - 6 || sr > P.flatOut + 6) return;
  const wd = P.wallD;
  if ((pd < wd) !== (b.d < wd) || Math.abs(b.d - wd) < 0.4) {
    const fromIn = pd < wd; const target = fromIn ? wd - 0.45 : wd + 0.45;
    const sg = fromIn ? 1 : -1; const nx = T.NX[b.i] * sg, ny = T.NY[b.i] * sg;
    const shiftD = target - b.d; b.x += T.NX[b.i] * shiftD; b.y += T.NY[b.i] * shiftD; b.d = target;
    const [vx, vy] = bikeVel(b); const vn = vx * nx + vy * ny;
    if (vn > 8) { crashBike(b, W, 'wall'); return; }
    if (vn > 0) { const nvx = vx - nx * vn * 1.3, nvy = vy - ny * vn * 1.3; const sp = Math.hypot(nvx, nvy) * 0.92; if (sp > 1) b.h = Math.atan2(nvy, nvx); b.v = sp; b.vs = 0; b.dmg.a = Math.min(1, b.dmg.a + vn * 0.02); FX.spark(b.x, b.y, vx, vy); }
  }
}
function pitLogic(b, dt) {
  const P = T.PIT, sr = T.rel(b.s);
  const zone = P.inZone(sr);
  const c = zone ? P.center(clamp(sr, P.sIn, P.sOut)) : null;
  b.inPitLane = zone && c !== null && b.d > T.WR[b.i] + 0.3 && (b.surf === SURF.PIT || (b.d > P.wallD && sr > P.flatIn && sr < P.flatOut));
  b.limiter = b.inPitLane && sr >= P.limIn && sr <= P.limOut;
  if (!b.inPitLane) b.serviceDone = false;
  const bs = P.boxS(b.box);
  if (!b.service && !b.serviceDone && b.inPitLane && Math.abs(sr - bs) < 5 && Math.abs(b.d - P.boxD) < 3.6 && b.v < 1.5 && ((b.isPlayer && !b.autopilot) || b.pitPlan)) {
    b.service = true; b.serviceT = 0; b.needRelease = true; b.v = 0; b.pits++; b.serviceFuel0 = b.fuel;
    if (b.isPlayer) { HUD.msg('BOX', 'Crew refuelling. Press W to leave.', '#ffcf1f', 2); Sound.pit(); }
  }
  if (b.service) {
    b.v = 0; b.vs = 0; b.serviceT += dt;
    const target = b.isPlayer && !b.autopilot ? PHYS.tank : Math.max(b.pitFill, b.fuel);
    if (b.serviceT > 1.2) {
      if (b.fuel < target) b.fuel = Math.min(target, b.fuel + PHYS.refuelRate * dt);
      b.dmg.a = Math.max(0, b.dmg.a - 0.09 * dt); b.dmg.c = Math.max(0, b.dmg.c - 0.07 * dt); b.dmg.e = Math.max(0, b.dmg.e - 0.03 * dt);
    }
    if ((!b.isPlayer || b.autopilot) && b.serviceT > 2 && b.fuel >= target - 0.01 && b.dmg.a < 0.2 && b.dmg.c < 0.2) endService(b);
  }
}
function endService(b) {
  b.service = false; b.serviceDone = true; b.pitPlan = false; b.fuelLapStart = b.fuel; b.pittedThisLap = true;
  if (b.isPlayer) HUD.msg('GO GO GO', `Fuel ${b.fuel.toFixed(1)} L`, '#3ad17a', 1.5);
}

function timing(b) {
  const L = T.L, prev = b.prevS, s = b.s; const ds = s - prev;
  if (ds < -L / 2) { // crossed the line forwards
    if (b.isPlayer) W.lineT = W.time; // practice ghosts start a best lap at every crossing (GDD 11c)
    if (b.gridCross) { b.gridCross = false; b.cp = 0; }
    else if (b.outLap) { b.outLap = false; b.lapStartT = W.time; b.secStart = W.time; b.cp = 0; b.fuelLapStart = b.fuel; if (b.isPlayer) { HUD.msg('TIMED LAP', '', '#ffcf1f', 1.2); W.curTrace.fill(-1); } }
    else if (b.cp >= 2) completeLap(b);
    else { b.lapStartT = W.time; b.secStart = W.time; b.cp = 0; if (b.isPlayer) { HUD.msg('LAP INVALID', 'Missed a sector', '#e3312a', 1.5); W.curTrace.fill(-1); } }
  } else if (ds > L / 2) { b.cp = -1; } // went backwards over the line
  else {
    if (b.cp === 0 && prev < L / 3 && s >= L / 3) sector(b, 0);
    if (b.cp === 1 && prev < 2 * L / 3 && s >= 2 * L / 3) sector(b, 1);
  }
  b.prevS = s;
  b.progress = (b.gridCross ? -1 : b.lap) * L + s;
  if (W.mode === 'race' && W.phase === 'run' && !b.finished && !b.dnf) {
    const bin = Math.floor(b.progress / 10) + 150;
    if (bin >= 0 && bin < W.passT.length && W.passT[bin] < 0) W.passT[bin] = W.time;
  }
  if (b.isPlayer && !b.outLap && !b.gridCross && W.curTrace) { const bin = Math.floor(s / 10); if (W.curTrace[bin] < 0) W.curTrace[bin] = W.time - b.lapStartT; }
}
function sector(b, k) {
  const t = W.time - b.secStart; b.secStart = W.time; b.lastSec[k] = t; b.cp = k + 1;
  if (b.isPlayer) { const best = b.bestSec[k]; HUD.sector(k, t, best); }
  if (!b.bestSec[k] || t < b.bestSec[k]) b.bestSec[k] = t;
}
function completeLap(b) {
  const lt = W.time - b.lapStartT; const t3 = W.time - b.secStart; b.lastSec[2] = t3;
  if (b.isPlayer) HUD.sector(2, t3, b.bestSec[2]);
  if (!b.bestSec[2] || t3 < b.bestSec[2]) b.bestSec[2] = t3;
  if (b.isPlayer) Rec.lap(W.time - lt, W.time, lt, b.autopilot);
  b.lastLap = lt; b.laps.push(lt); const pb = !b.bestLap || lt < b.bestLap; if (pb) b.bestLap = lt;
  b.lap++; b.lapStartT = W.time; b.secStart = W.time; b.cp = 0;
  const used = b.fuelLapStart - b.fuel; if (!b.pittedThisLap && used > 0.8 && used < 6) b.fuelPerLap = lerp(b.fuelPerLap, used, b.laps.length > 1 ? 0.5 : 0.8);
  b.fuelLapStart = b.fuel; b.pittedThisLap = false;
  if (b.isPlayer) {
    let rec = { allPb: false };
    if (!b.autopilot) rec = Records.add(W.mode, lt, b, W.curTrace);
    if (rec.allPb || !W.bestTrace) { W.bestTrace = Float32Array.from(W.curTrace); W.bestTraceT = lt; }
    W.curTrace.fill(-1);
    HUD.lap(lt, pb, rec.allPb);
  }
  if (W.mode === 'race') {
    if (!b.finished && (b.lap >= W.totalLaps || W.flag)) {
      b.finished = true; b.finishT = W.time - W.raceStartT; W.finishOrder.push(b);
      if (!W.flag) { W.flag = true; HUD.ticker(`#${b.num} ${b.isPlayer ? b.name : b.short} takes the chequered flag`); }
      if (b.isPlayer) { HUD.msg('CHEQUERED FLAG', 'P' + W.finishOrder.length + ' · ' + fmtTime(b.finishT), '#ffffff', 4); W.endTimer = 4; }
    } else if (b.isPlayer && b.lap === W.totalLaps - 1) HUD.msg('FINAL LAP', '', '#ffffff', 1.6);
  }
  if (W.mode === 'quali' && b.isPlayer && b.laps.length >= 3) { W.endTimer = 3; HUD.msg('SESSION COMPLETE', 'Best ' + fmtTime(b.bestLap), '#ffcf1f', 3); }
}

function effects(b, dt) {
  const r = W.rand;
  if (b.skid && b.v > 8) { FX.mark(b.x - Math.cos(b.h) * 0.6, b.y - Math.sin(b.h) * 0.6, Math.cos(b.h) * b.v, Math.sin(b.h) * b.v, b.slip > 0.05 ? 0.55 : 0.28); if (b.slip > 0.05 && r() < 0.35) FX.smoke(b.x - Math.cos(b.h), b.y - Math.sin(b.h), 0, 0, 0.25); }
  if ((b.surf === SURF.GRAVEL || b.surf === SURF.GRASS) && b.v > 5 && r() < 0.6) FX.dust(b.x, b.y, b.surf);
  if (Math.abs(b.lean) > 58 * DEG && b.v > 15 && r() < 0.15) { const sg = Math.sign(b.lean); FX.spark(b.x - Math.sin(b.h) * sg * 0.7 * PHYS.VS, b.y + Math.cos(b.h) * sg * 0.7 * PHYS.VS, Math.cos(b.h) * b.v * 0.8, Math.sin(b.h) * b.v * 0.8); }
  if (b.dmg.e > 0.5 && r() < dt * 30 * b.dmg.e) FX.smoke(b.x - Math.cos(b.h) * 1.2, b.y - Math.sin(b.h) * 1.2, Math.cos(b.h) * b.v, Math.sin(b.h) * b.v, 0.3);
}

// bike-to-bike contact: each bike is two discs along its length
function collide(bikes) {
  const R = 0.44, OFF = 0.6;
  for (let a = 0; a < bikes.length; a++) {
    const A = bikes[a]; if (A.crashed || A.dnf) continue;
    for (let q = a + 1; q < bikes.length; q++) {
      const B = bikes[q]; if (B.crashed || B.dnf) continue;
      const dx0 = B.x - A.x, dy0 = B.y - A.y; if (dx0 * dx0 + dy0 * dy0 > 9) continue;
      if (A.held && B.held) continue;
      const ca = [[A.x + Math.cos(A.h) * OFF, A.y + Math.sin(A.h) * OFF], [A.x - Math.cos(A.h) * OFF, A.y - Math.sin(A.h) * OFF]];
      const cb = [[B.x + Math.cos(B.h) * OFF, B.y + Math.sin(B.h) * OFF], [B.x - Math.cos(B.h) * OFF, B.y - Math.sin(B.h) * OFF]];
      let hit = null, best = 2 * R;
      for (const p of ca) for (const r of cb) { const d = Math.hypot(r[0] - p[0], r[1] - p[1]); if (d < best) { best = d; hit = [p, r, d]; } }
      if (!hit) continue;
      const [p, r, d] = hit; const nx = d > 1e-4 ? (r[0] - p[0]) / d : 1, ny = d > 1e-4 ? (r[1] - p[1]) / d : 0;
      const pen = 2 * R - d;
      const ma = PHYS.massBike + PHYS.massRider + A.fuel * 0.745, mb = PHYS.massBike + PHYS.massRider + B.fuel * 0.745;
      const wa = A.held ? 0 : 1 / ma, wb = B.held ? 0 : 1 / mb; const wsum = wa + wb || 1;
      A.x -= nx * pen * wa / wsum; A.y -= ny * pen * wa / wsum; B.x += nx * pen * wb / wsum; B.y += ny * pen * wb / wsum;
      const [avx, avy] = bikeVel(A), [bvx, bvy] = bikeVel(B);
      const rel = (bvx - avx) * nx + (bvy - avy) * ny;
      if (rel >= 0) continue;
      const j = -(1 + 0.3) * rel / wsum;
      if (!A.held) setVel(A, avx - nx * j * wa, avy - ny * j * wa);
      if (!B.held) setVel(B, bvx + nx * j * wb, bvy + ny * j * wb);
      const dv = j * Math.max(wa, wb);
      for (const [X, sg] of [[A, -1], [B, 1]]) {
        if (X.held) continue;
        X.dmg.a = Math.min(1, X.dmg.a + dv * 0.022); X.dmg.c = Math.min(1, X.dmg.c + dv * 0.012);
        X.lean += (W.rand() - 0.5) * dv * 0.05;
        if (dv > 3) X.slip += (dv - 3) * 0.04;
        if (X.isPlayer) { HUD.shake = Math.min(1, dv / 4); Sound.hit(dv / 6); }
      }
      if (dv > 2) for (let k = 0; k < 4; k++) FX.spark((p[0] + r[0]) / 2, (p[1] + r[1]) / 2, (avx + bvx) / 2, (avy + bvy) / 2);
      if (dv > 5.5) {
        const pr = clamp((dv - 5.5) / 5, 0, 0.85);
        if (W.rand() < pr) crashBike(A, W, 'contact');
        if (W.rand() < pr) crashBike(B, W, 'contact');
      }
    }
  }
}

function standings() {
  const bikes = W.mode === 'race' ? W.bikes.concat(W.ghosts) : W.bikes.slice();
  if (W.mode === 'race') {
    return bikes.sort((a, b) => {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
      if (a.finished && b.finished) return W.finishOrder.indexOf(a) - W.finishOrder.indexOf(b);
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
  }
  return bikes.sort((a, b) => (a.bestLap || 1e9) - (b.bestLap || 1e9));
}
function gapOf(b) { // time behind the leader at the same point of the race
  if (b.dnf) return null;
  const bin = Math.floor(b.progress / 10) + 150;
  if (bin < 0 || bin >= W.passT.length || W.passT[bin] < 0) return 0;
  return W.time - W.passT[bin];
}
function fmtTime(t) { if (!t || !isFinite(t)) return '–:––.–––'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); }
function fmtGap(g) { return (g >= 0 ? '+' : '−') + Math.abs(g).toFixed(3); }
