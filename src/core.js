'use strict';
// Silverstone GP centerline + track widths: TUMFTM racetrack-database (LGPL-3.0), x,y,w_right,w_left in metres.
const TRACK_RAW = "__TRACK__";

const G = 9.81, DEG = Math.PI / 180, TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const angWrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const sstep = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------------------
// Bike + physics constants (MotoGP-class prototype)
//  min. bike mass 157 kg, rider ~70 kg, ~290 hp crank (~192 kW at the wheel)
//  22 L tank, max lean ~64 deg, braking ~1.45 g (front stoppie limit), anti-wheelie ~1.0 g
// ---------------------------------------------------------------------------
const PHYS = {
  massBike: 157, massRider: 70, fuelDensity: 0.745, tank: 22,
  pMax: 205000, redline: 18000, idle: 4200,
  gears: [0, 135, 178, 220, 260, 302, 345].map(k => k / 3.6), // top speed per gear at redline
  CdA: 0.30, rho: 1.2, roll: 0.015,
  mu: 1.68, brakeMax: 1.55 * G, wheelie: 1.02 * G, maxLean: 64 * DEG,
  pitLimit: 60 / 3.6, refuelRate: 2.6, fuelK: 0.052,
  VS: 1.35 // visual scale of bike sprites (collision uses same footprint)
};
const SURF = { ASPH: 0, KERB: 1, RUN: 2, GRAVEL: 3, GRASS: 4, PIT: 5, WALL: 6 };
const SURFP = [
  { mu: 1.0, roll: 0, brake: 1 },       // asphalt
  { mu: 0.88, roll: 0.01, brake: 0.9 }, // kerb
  { mu: 0.86, roll: 0.01, brake: 0.88 },// tarmac run-off
  { mu: 0.34, roll: 0.55, brake: 0.4 }, // gravel trap
  { mu: 0.42, roll: 0.16, brake: 0.45 },// grass
  { mu: 0.95, roll: 0, brake: 1 },      // pit lane
  { mu: 0.5, roll: 0.3, brake: 0.5 }
];
function powerFrac(r) { // normalised wheel power vs rpm fraction (V4/I4 big-bang style curve)
  const P = [[0, 0], [0.2, 0.16], [0.4, 0.4], [0.55, 0.6], [0.7, 0.78], [0.82, 0.9], [0.93, 1.0], [1.0, 0.96], [1.05, 0.9]];
  if (r <= 0) return 0; if (r >= 1.05) return 0.9;
  for (let i = 1; i < P.length; i++) if (r <= P[i][0]) { const t = (r - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return lerp(P[i - 1][1], P[i][1], t); }
  return 0.9;
}

// ---------------------------------------------------------------------------
// Track
// ---------------------------------------------------------------------------
const T = {};
(function buildTrack() {
  const raw = TRACK_RAW.split(';').map(r => r.split(',').map(Number));
  const START = 22; // start/finish line on the Hamilton straight (Silverstone Wing)
  const R = raw.slice(START).concat(raw.slice(0, START)).map(r => ({ x: r[0], y: -r[1], wr: r[2], wl: r[3] }));
  const n = R.length;
  const dx = [], dy = [], dwr = [], dwl = [], origAt = [];
  for (let i = 0; i < n; i++) {
    const p0 = R[(i - 1 + n) % n], p1 = R[i], p2 = R[(i + 1) % n], p3 = R[(i + 2) % n];
    const seg = Math.hypot(p2.x - p1.x, p2.y - p1.y); const k = Math.max(2, Math.ceil(seg / 0.5));
    origAt.push(dx.length);
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dx.push(f(p0.x, p1.x, p2.x, p3.x)); dy.push(f(p0.y, p1.y, p2.y, p3.y));
      dwr.push(lerp(p1.wr, p2.wr, t)); dwl.push(lerp(p1.wl, p2.wl, t));
    }
  }
  const m = dx.length; const cum = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) cum[i + 1] = cum[i] + Math.hypot(dx[(i + 1) % m] - dx[i], dy[(i + 1) % m] - dy[i]);
  const L = cum[m], N = Math.round(L / 2), DS = L / N;
  const X = new Float64Array(N), Y = new Float64Array(N), WR = new Float32Array(N), WL = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = i * DS; while (cum[j + 1] < s) j++;
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1), j2 = (j + 1) % m;
    X[i] = lerp(dx[j], dx[j2], t); Y[i] = lerp(dy[j], dy[j2], t); WR[i] = lerp(dwr[j], dwr[j2], t); WL[i] = lerp(dwl[j], dwl[j2], t);
  }
  const smoothArr = (A, r, passes) => { for (let p = 0; p < passes; p++) { const B = Float32Array.from(A); for (let i = 0; i < N; i++) { let s = 0; for (let o = -r; o <= r; o++) s += B[(i + o + N) % N]; A[i] = s / (2 * r + 1); } } };
  smoothArr(WR, 6, 2); smoothArr(WL, 6, 2);
  for (let i = 0; i < N; i++) { WR[i] = Math.max(WR[i], 6.2); WL[i] = Math.max(WL[i], 6.2); }
  const TX = new Float64Array(N), TY = new Float64Array(N), NX = new Float64Array(N), NY = new Float64Array(N), H = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, b = (i + 1) % N; let tx = X[b] - X[a], ty = Y[b] - Y[a]; const l = Math.hypot(tx, ty); tx /= l; ty /= l;
    TX[i] = tx; TY[i] = ty; NX[i] = -ty; NY[i] = tx; H[i] = Math.atan2(ty, tx);
  }
  const K = new Float32Array(N);
  for (let i = 0; i < N; i++) K[i] = angWrap(H[(i + 1) % N] - H[(i - 1 + N) % N]) / (2 * DS);
  smoothArr(K, 2, 2);
  const KS = Float32Array.from(K); smoothArr(KS, 7, 2);
  Object.assign(T, { N, DS, L, X, Y, WR, WL, TX, TY, NX, NY, H, K, KS });
  T.origS = origAt.map(k => { const s = cum[k]; return s; });
  T.rel = s => (s > L / 2 ? s - L : s);
  T.wrapS = s => ((s % L) + L) % L;
  T.idx = s => ((Math.round(T.wrapS(s) / DS) % N) + N) % N;
  // spatial grid of centreline samples
  const CELL = 25; let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (let i = 0; i < N; i++) { minx = Math.min(minx, X[i]); maxx = Math.max(maxx, X[i]); miny = Math.min(miny, Y[i]); maxy = Math.max(maxy, Y[i]); }
  T.bbox = { minx, miny, maxx, maxy };
  const grid = new Map(); const key = (cx, cy) => (cx + 1000) * 4096 + (cy + 1000);
  for (let i = 0; i < N; i++) { const k = key(Math.floor(X[i] / CELL), Math.floor(Y[i] / CELL)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
  T.near = function (x, y, rad, cb) { // iterate samples near point
    const r = Math.ceil(rad / CELL), cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const l = grid.get(key(cx + a, cy + b)); if (l) for (const i of l) cb(i); }
  };
  T.nearestGlobal = function (x, y) {
    let best = -1, bd = 1e18;
    T.near(x, y, 80, i => { const d = (X[i] - x) ** 2 + (Y[i] - y) ** 2; if (d < bd) { bd = d; best = i; } });
    if (best < 0) for (let i = 0; i < N; i++) { const d = (X[i] - x) ** 2 + (Y[i] - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  };
  T.project = function (x, y, hint, out) {
    let i;
    if (hint < 0) i = T.nearestGlobal(x, y);
    else { let bd = 1e18; i = hint; for (let o = -24; o <= 24; o++) { const k = (hint + o + N) % N; const d = (X[k] - x) ** 2 + (Y[k] - y) ** 2; if (d < bd) { bd = d; i = k; } } }
    const ex = x - X[i], ey = y - Y[i];
    out.i = i; out.d = ex * NX[i] + ey * NY[i]; out.s = T.wrapS(i * DS + ex * TX[i] + ey * TY[i]);
    return out;
  };
  T.pt = (i, d) => [X[i] + NX[i] * d, Y[i] + NY[i] * d];

  // corners (by index in the source data)
  const CORN = [['Abbey', 75], ['Farm', 118], ['Village', 176], ['The Loop', 200], ['Aintree', 236], ['Wellington Straight', 310], ['Brooklands', 404], ['Luffield', 448], ['Woodcote', 498], ['National Straight', 560], ['Copse', 612], ['Maggotts', 726], ['Becketts', 762], ['Chapel', 805], ['Hangar Straight', 900], ['Stowe', 1004], ['Vale', 1098], ['Club', 1145], ['Hamilton Straight', 1172]];
  T.corners = CORN.map(([name, oi]) => {
    const ri = (oi - START + n) % n; let s = T.origS[ri] / L * L; let ci = T.idx(s);
    if (!/Straight/.test(name)) { let best = ci, bk = 0; for (let o = -14; o <= 14; o++) { const k = (ci + o + N) % N; if (Math.abs(KS[k]) > bk) { bk = Math.abs(KS[k]); best = k; } } ci = best; }
    return { name, i: ci, s: ci * DS };
  }).sort((a, b) => a.s - b.s);
  T.cornerAt = function (s) { // name of the section the rider is in / approaching
    let best = T.corners[T.corners.length - 1];
    for (const c of T.corners) if (c.s - 120 <= s) best = c;
    return best.name;
  };

  // --- pit lane (right side of Hamilton straight, entry after Club, exit before Abbey)
  let a = 0; while (a < 400 && Math.abs(KS[(N - a) % N]) < 0.0022) a++;
  let b = 0; while (b < 400 && Math.abs(KS[b]) < 0.0022) b++;
  const PIT = { sIn: -a * DS + 12, sOut: b * DS - 18, ramp: 70, d: 21.5, hw: 7, wallD: 13.2, boxD: 26, garage: 30.5 };
  PIT.flatIn = PIT.sIn + PIT.ramp; PIT.flatOut = PIT.sOut - PIT.ramp;
  PIT.limIn = PIT.flatIn - 15; PIT.limOut = PIT.flatOut + 15;
  const avail = PIT.flatOut - PIT.flatIn - 30; PIT.boxGap = Math.min(12, avail / 21);
  PIT.boxS = k => PIT.flatIn + 18 + k * PIT.boxGap;
  PIT.center = function (sr) { // pit lane centre offset as function of relative s
    if (sr < PIT.sIn || sr > PIT.sOut) return null;
    if (sr < PIT.flatIn) { const t = sstep((sr - PIT.sIn) / PIT.ramp); return lerp(WR[T.idx(sr)] + 1.2, PIT.d, t); }
    if (sr > PIT.flatOut) { const t = sstep((PIT.sOut - sr) / PIT.ramp); return lerp(WR[T.idx(sr)] + 1.2, PIT.d, t); }
    return PIT.d;
  };
  PIT.halfW = function (sr) { if (sr < PIT.flatIn) return lerp(3.6, PIT.hw, sstep((sr - PIT.sIn) / PIT.ramp)); if (sr > PIT.flatOut) return lerp(3.6, PIT.hw, sstep((PIT.sOut - sr) / PIT.ramp)); return PIT.hw; };
  PIT.inZone = sr => sr >= PIT.sIn - 4 && sr <= PIT.sOut + 4;
  T.PIT = PIT;

  // --- run-off, kerbs, walls per side (0 = right, d>0 ; 1 = left, d<0)
  const KERB = [new Float32Array(N), new Float32Array(N)], RUN = [new Float32Array(N), new Float32Array(N)], RT = [new Uint8Array(N), new Uint8Array(N)], WALL = [new Float32Array(N), new Float32Array(N)];
  const EDGE = [WR, WL];
  const gD = [new Float32Array(N), new Float32Array(N)], tD = [new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) {
    const k = KS[i], ak = Math.abs(k); const outside = k > 0 ? 1 : 0;
    if (ak > 0.0028) { const dep = clamp(14 + 1900 * ak, 14, 40); if (ak > 0.0155) gD[outside][i] = dep; else tD[outside][i] = dep; tD[1 - outside][i] = Math.max(tD[1 - outside][i], 3.5); }
  }
  for (let s = 0; s < 2; s++) for (const A of [gD[s], tD[s]]) {
    const B = Float32Array.from(A);
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 2 * N; i++) { const k = i % N, p = (k - 1 + N) % N; B[k] = Math.max(B[k], B[p] * 0.982); }
    for (let pass = 0; pass < 2; pass++) for (let i = 2 * N; i >= 0; i--) { const k = i % N, nx = (k + 1) % N; B[k] = Math.max(B[k], B[nx] * 0.95); }
    A.set(B);
  }
  for (let s = 0; s < 2; s++) for (let i = 0; i < N; i++) {
    const g = gD[s][i], t = tD[s][i];
    if (g > 4 && g >= t * 0.75) { RUN[s][i] = g; RT[s][i] = SURF.GRAVEL; } else if (t > 2) { RUN[s][i] = t; RT[s][i] = SURF.RUN; } else { RUN[s][i] = 0; RT[s][i] = SURF.GRASS; }
  }
  // kerbs on both sides of corners
  const kerbRaw = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (Math.abs(KS[i]) > 0.0052) kerbRaw[i] = 1;
  for (let i = 0; i < N; i++) { let on = 0; for (let o = -6; o <= 6; o++) if (kerbRaw[(i + o + N) % N]) on = 1; if (on) { const ins = KS[i] > 0 ? 0 : 1; KERB[ins][i] = 1.6; KERB[1 - ins][i] = 1.25; } }
  // kerb ends narrow to nothing over 8 m instead of ending square (GDD 1.11.3)
  for (let s = 0; s < 2; s++) {
    const K = KERB[s], B = Float32Array.from(K);
    for (let i = 0; i < N; i++) {
      if (!B[i]) continue; let d = 1;
      while (d < 5 && B[(i + d) % N] && B[(i - d + N) % N]) d++;
      K[i] = B[i] * Math.min(1, (d - 1) / 4);
    }
  }
  // walls: desired distance, capped so they never cross another part of the circuit
  for (let s = 0; s < 2; s++) for (let i = 0; i < N; i++) {
    const e = EDGE[s][i]; let want = e + KERB[s][i] + RUN[s][i] + 9; want = Math.max(want, e + 13);
    const sg = s === 0 ? 1 : -1; let cap = 1e9;
    for (let t = e + 3; t < want + 14; t += 2) {
      const qx = X[i] + NX[i] * sg * t, qy = Y[i] + NY[i] * sg * t; let hit = false;
      T.near(qx, qy, 30, j => { if (hit) return; let di = Math.abs(j - i); di = Math.min(di, N - di); if (di < 40) return; const dd = Math.hypot(X[j] - qx, Y[j] - qy); if (dd < Math.max(WR[j], WL[j]) + 5) hit = true; });
      if (hit) { cap = Math.max(e + 3.2, (e + t) / 2 - 1); break; }
    }
    WALL[s][i] = Math.min(want, cap);
  }
  for (let s = 0; s < 2; s++) { // smooth walls: min filter then average
    const W = WALL[s], B = Float32Array.from(W);
    for (let i = 0; i < N; i++) { let mn = 1e9; for (let o = -5; o <= 5; o++) mn = Math.min(mn, B[(i + o + N) % N]); W[i] = mn; }
    smoothArr(W, 4, 3);
    for (let i = 0; i < N; i++) { W[i] = Math.max(W[i], EDGE[s][i] + 3); RUN[s][i] = Math.min(RUN[s][i], Math.max(0, W[i] - EDGE[s][i] - KERB[s][i] - 1.5)); }
  }
  // pit zone overrides on right side
  for (let i = 0; i < N; i++) {
    const sr = T.rel(i * DS);
    if (PIT.inZone(sr)) {
      KERB[0][i] = 0; RUN[0][i] = 0; RT[0][i] = SURF.RUN;
      const c = PIT.center(clamp(sr, PIT.sIn, PIT.sOut)) ?? WR[i];
      WALL[0][i] = (sr >= PIT.flatIn && sr <= PIT.flatOut) ? PIT.garage : Math.max(c + PIT.halfW(clamp(sr, PIT.sIn, PIT.sOut)) + 4, WR[i] + 6);
      KERB[1][i] = 0;
    }
  }
  // no square steps in the run-off and wall outlines (GDD 1.11.4): a run-off area narrows at its ends and where
  // gravel meets tarmac run-off by at most 1.5 m per track point; walls change by at most 1.2 m per track point (the wall steps next to the pit zone)
  for (let s = 0; s < 2; s++) {
    const R = RUN[s], Wl = WALL[s];
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < N; n++) { // forward then backward sweep
      const i = pass ? (N - 1 - n) : n, j = pass ? (i + 1) % N : (i - 1 + N) % N;
      const rj = R[j] > 1 ? R[j] : 0; if (R[i] > rj + 1.5) R[i] = rj + 1.5;
      if (Wl[i] < Wl[j] - 1.2) Wl[i] = Wl[j] - 1.2;
    }
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < N; n++) { // second round settles the wrap-around
      const i = pass ? (N - 1 - n) : n, j = pass ? (i + 1) % N : (i - 1 + N) % N;
      const rj = R[j] > 1 ? R[j] : 0; if (R[i] > rj + 1.5) R[i] = rj + 1.5;
      if (Wl[i] < Wl[j] - 1.2) Wl[i] = Wl[j] - 1.2;
    }
  }
  Object.assign(T, { KERB, RUN, RT, WALL, EDGE });
  // pit lane outline as drawn: the lane ends merge into the track edge over 20 m instead of ending square (GDD 1.11.4)
  PIT.PX = 20;
  PIT.edge = function (k, sgn, inset) { // offset of a pit lane edge at point k (sgn -1 inner, +1 outer)
    const PX = PIT.PX, sr = T.rel(k * DS), ce = sr < PIT.sIn ? PIT.sIn : sr > PIT.sOut ? PIT.sOut : sr;
    const c = PIT.center(ce) ?? WR[k], w = sgn * (PIT.halfW(ce) - inset), f = sr < PIT.sIn ? 1 - (PIT.sIn - sr) / PX : sr > PIT.sOut ? 1 - (sr - PIT.sOut) / PX : 1;
    const e = f >= 1 ? c + w : WR[k] + (c + w - WR[T.idx(ce)]) * Math.max(0, f);
    return sgn < 0 ? Math.max(e, EDGE[0][k] + inset) : e; // the lane never covers the track's white edge line
  };

  T.surface = function (i, s, d) {
    const side = d >= 0 ? 0 : 1, ad = Math.abs(d), e = EDGE[side][i];
    if (side === 0) {
      const sr = T.rel(s);
      if (PIT.inZone(sr)) {
        const c = PIT.center(clamp(sr, PIT.sIn, PIT.sOut));
        if (ad <= e) return SURF.ASPH;
        if (c !== null && Math.abs(d - c) <= PIT.halfW(clamp(sr, PIT.sIn, PIT.sOut))) return SURF.PIT;
        if (ad >= WALL[0][i]) return SURF.WALL;
        return SURF.RUN;
      }
    }
    if (ad <= e) return SURF.ASPH;
    if (ad <= e + KERB[side][i]) return SURF.KERB;
    if (ad <= e + KERB[side][i] + RUN[side][i]) return RT[side][i];
    if (ad < WALL[side][i]) return SURF.GRASS;
    return SURF.WALL;
  };

  // --- racing line (curvature-minimising lateral offset) + speed profile
  const lat = new Float64Array(N);
  const relax = (k, it) => {
    for (let r = 0; r < it; r++) for (let i = 0; i < N; i++) {
      const a2 = (i - k + N) % N, b2 = (i + k) % N;
      const ax = X[a2] + NX[a2] * lat[a2], ay = Y[a2] + NY[a2] * lat[a2], bx = X[b2] + NX[b2] * lat[b2], by = Y[b2] + NY[b2] * lat[b2];
      const tgt = ((ax + bx) / 2 - X[i]) * NX[i] + ((ay + by) / 2 - Y[i]) * NY[i];
      lat[i] = clamp(lerp(lat[i], tgt, 0.6), -(WL[i] - 1.4), WR[i] - 1.4);
    }
  };
  relax(14, 90); relax(7, 140); relax(3, 120);
  for (let p = 0; p < 3; p++) { const B = Float64Array.from(lat); for (let i = 0; i < N; i++) { let a = 0; for (let o = -5; o <= 5; o++) a += B[(i + o + N) % N]; lat[i] = clamp(a / 11, -(WL[i] - 1.2), WR[i] - 1.2); } }
  const RX = new Float64Array(N), RY = new Float64Array(N), RK = new Float32Array(N), RDS = new Float32Array(N);
  for (let i = 0; i < N; i++) { RX[i] = X[i] + NX[i] * lat[i]; RY[i] = Y[i] + NY[i] * lat[i]; }
  for (let i = 0; i < N; i++) {
    const a2 = (i - 5 + N) % N, b2 = (i + 5) % N;
    const ax = RX[a2], ay = RY[a2], bx = RX[i], by = RY[i], cx = RX[b2], cy = RY[b2];
    const cr = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    RK[i] = 2 * cr / (Math.hypot(bx - ax, by - ay) * Math.hypot(cx - bx, cy - by) * Math.hypot(cx - ax, cy - ay));
    RDS[i] = Math.hypot(RX[(i + 1) % N] - RX[i], RY[(i + 1) % N] - RY[i]);
  }
  smoothArr(RK, 3, 2);
  T.lat = lat; T.RX = RX; T.RY = RY; T.RK = RK;
  T.speedProfile = function (mu) {
    const V = new Float64Array(N), m = PHYS.massBike + PHYS.massRider + 12 * PHYS.fuelDensity, vmax = PHYS.gears[6];
    const gmax = mu * G;
    for (let i = 0; i < N; i++) V[i] = Math.min(vmax, Math.sqrt(gmax / Math.max(Math.abs(RK[i]), 1e-5)));
    const drag = v => 0.5 * PHYS.rho * PHYS.CdA * v * v / m + PHYS.roll * G;
    for (let rep = 0; rep < 2; rep++) for (let k = 2 * N - 1; k >= 0; k--) { // braking (backward)
      const i = k % N, nx = (i + 1) % N, v = V[nx]; const alat = v * v * Math.abs(RK[i]);
      const ab = Math.min(PHYS.brakeMax * 0.94, Math.sqrt(Math.max(0, gmax * gmax - alat * alat))) + drag(v);
      V[i] = Math.min(V[i], Math.sqrt(v * v + 2 * ab * RDS[i]));
    }
    for (let rep = 0; rep < 2; rep++) for (let k = 0; k < 2 * N; k++) { // traction (forward)
      const i = k % N, nx = (i + 1) % N, v = Math.max(V[i], 3); const alat = v * v * Math.abs(RK[i]);
      const aEng = Math.min(PHYS.wheelie, PHYS.pMax * 0.97 / (m * v)), aGrip = Math.sqrt(Math.max(0, gmax * gmax - alat * alat));
      const aa = Math.max(0, Math.min(aEng, aGrip) - drag(v));
      V[nx] = Math.min(V[nx], Math.sqrt(v * v + 2 * aa * RDS[i]));
    }
    let tt = 0; for (let i = 0; i < N; i++) tt += RDS[i] / ((V[i] + V[(i + 1) % N]) / 2);
    return { V, lapTime: tt };
  };
  const prof = T.speedProfile(PHYS.mu * 0.97);
  T.VP = prof.V; T.refLap = prof.lapTime;
  // braking boards: big decelerations ahead of corners
  T.boards = []; T.zones = []; // zones: one per braking corner, boards measured to zi (GDD 11b)
  for (let i = 0; i < N; i++) {
    const V = T.VP, p = (i - 1 + N) % N;
    if (V[i] < V[p] - 0.02 && V[p] >= V[(p - 1 + N) % N] - 0.001) {
      let k = i, mn = V[i]; for (let o = 0; o < 200; o++) { const q = (i + o) % N; if (V[q] < mn) { mn = V[q]; k = q; } if (V[(q + 1) % N] > V[q] + 0.01) break; }
      if (V[p] - mn > 22) { const turnRight = KS[k] > 0; T.zones.push({ k, zi: (k - Math.round(25 / DS) + N) % N, right: turnRight }); for (const dist of [300, 200, 100, 50]) { const bi = (k - Math.round((dist + 25) / DS) + 4 * N) % N; T.boards.push({ i: bi, dist, side: turnRight ? -1 : 1 }); } }
    }
  }
})();

// ---------------------------------------------------------------------------
// Riders, teams
// ---------------------------------------------------------------------------
const TEAMS = [
  { name: 'Rosso Veloce Factory', c1: '#c8102e', c2: '#f4f4f4', c3: '#1b1b1b' },
  { name: 'Blu Tridente Racing', c1: '#1f4fd1', c2: '#0b1530', c3: '#e8e8e8' },
  { name: 'Arancia Tech', c1: '#ff6a13', c2: '#141414', c3: '#ffffff' },
  { name: 'Lime Works', c1: '#93d500', c2: '#121212', c3: '#ffffff' },
  { name: 'Nero Opaco', c1: '#1e2226', c2: '#ffcc00', c3: '#ffcc00' },
  { name: 'Celeste Squadra', c1: '#39b6e8', c2: '#ffffff', c3: '#0d2b45' },
  { name: 'Viola Corse', c1: '#6a2bd9', c2: '#c9ff3d', c3: '#ffffff' },
  { name: 'Argento Factory', c1: '#b9c2c9', c2: '#c8102e', c3: '#202020' },
  { name: 'Giallo Moto', c1: '#ffd400', c2: '#0057b8', c3: '#0057b8' },
  { name: 'Bianco Sport', c1: '#efefef', c2: '#009246', c3: '#c8102e' },
  { name: 'Cobalt Satellite', c1: '#0a2a6b', c2: '#ff3d7f', c3: '#ffffff' }
];
const RIDERS = [
  ['Luca Ferrandi', 4, 'ITA'], ['Marc Albero', 7, 'SPA'], ['Jonas Weber', 11, 'GER'], ['Tom Hartley', 12, 'GBR'], ['Ryo Tanaka', 17, 'JPN'],
  ['Diego Marin', 19, 'SPA'], ['Pierre Lacombe', 21, 'FRA'], ['Matteo Rinaldi', 23, 'ITA'], ['Alex Varga', 27, 'HUN'], ['Kai Lindqvist', 29, 'SWE'],
  ['Bruno Costa', 33, 'BRA'], ['Sam Whitlock', 36, 'AUS'], ['Andrea Fossati', 41, 'ITA'], ['Pablo Iturbe', 44, 'SPA'], ['Jan Novotny', 48, 'CZE'],
  ['Nico Haller', 51, 'AUT'], ['Arif Rahman', 55, 'MAS'], ['Leo Castellane', 63, 'FRA'], ['Daniel Ortega', 68, 'ARG'], ['Finn O\'Brien', 72, 'IRL'], ['Tiago Varela', 94, 'POR']
];

// ---------------------------------------------------------------------------
// Bike state + physics step
// ---------------------------------------------------------------------------
function makeBike(o) {
  return Object.assign({
    id: 0, name: '', short: '', num: 0, team: 0, isPlayer: false,
    x: 0, y: 0, h: 0, v: 0, vs: 0, lean: 0, gear: 1, rpm: PHYS.idle, rpmVis: PHYS.idle, shiftCut: 0,
    ctl: { thr: 0, brk: 0, leanT: 0, steer: 0 }, assist: true, auto: true,
    fuel: PHYS.tank, dmg: { e: 0, a: 0, c: 0 }, slip: 0, aLongPrev: 0, draft: 0, wheelie: 0, dist: 0,
    i: 0, s: 0, d: 0, surf: 0, prevS: 0,
    lap: 0, gridCross: false, cp: 0, lapStartT: 0, lastLap: 0, bestLap: 0, laps: [], secStart: 0, sectors: [0, 0, 0], bestSec: [0, 0, 0], lastSec: [0, 0, 0], sec: 0,
    crashed: false, crash: null, held: false, dnf: false, finished: false, finishT: 0, crashes: 0, pits: 0,
    pitPlan: false, pitFill: 0, service: false, serviceT: 0, inPitLane: false, limiter: false, box: 0, needRelease: false,
    ai: null, fuelLapStart: PHYS.tank, fuelPerLap: 2.6, progress: 0, msgs: [],
    offT: -1, offS: 0, offCr: 0, lapInv: false, lapsInv: [], pen: 0
  }, o);
}
const Pj = { i: 0, s: 0, d: 0 };
function bikeVel(b) { const c = Math.cos(b.h), s = Math.sin(b.h); return [c * b.v - s * b.vs, s * b.v + c * b.vs]; }
function setVel(b, vx, vy) { const c = Math.cos(b.h), s = Math.sin(b.h); const f = vx * c + vy * s, l = -vx * s + vy * c; b.v = Math.max(0, f); b.vs = l; }
function rpmFor(v, g) { return v / PHYS.gears[g] * PHYS.redline; }

function shift(b, dir) {
  if (b.crashed || b.dnf) return false;
  const ng = b.gear + dir; if (ng < 1 || ng > 6) return false;
  if (dir < 0 && rpmFor(b.v, ng) > PHYS.redline + 400) { b.overrev = 0.8; return false; } // ECU over-rev protection
  b.gear = ng; if (dir > 0) b.shiftCut = 0.025; b.shiftFlash = 0.25; return true;
}
function autoBox(b) {
  const r = rpmFor(b.v, b.gear);
  if (b.gear < 6 && r > 17500) shift(b, 1);
  else if (b.gear > 1 && r < 10500 && rpmFor(b.v, b.gear - 1) < 16800) shift(b, -1);
}

function stepBike(b, dt, W) {
  if (b.dnf) return;
  if (b.crashed) { stepCrash(b, dt, W); return; }
  const c = b.ctl;
  if (b.held) { b.v = 0; b.vs = 0; b.rpm = lerp(b.rpm, PHYS.idle + c.thr * 11500, Math.min(1, dt * 8)); b.rpmVis = b.rpm; return; }
  if (b.auto || b.autopilot) autoBox(b);
  const m = PHYS.massBike + PHYS.massRider + b.fuel * PHYS.fuelDensity;
  const SF = SURFP[b.surf];
  const warm = b.dist < 2500 ? 0.93 + 0.07 * b.dist / 2500 : 1;
  const wear = 1 - 0.045 * Math.min(1, b.dist / 120000);
  const gripMax = PHYS.mu * SF.mu * warm * wear * (1 - 0.13 * b.dmg.c) * G;
  const v = b.v;
  // --- lean dynamics (roll rate falls with speed: gyroscopic stability)
  let tgt = clamp(c.leanT, -PHYS.maxLean, PHYS.maxLean);
  if (b.assist) {
    const latCap = Math.sqrt(Math.max(0, gripMax * gripMax - b.aLongPrev * b.aLongPrev));
    const maxL = Math.atan(latCap / G) * 0.985; tgt = clamp(tgt, -maxL, maxL);
  }
  const rate = clamp(3.4 - v / 55, 1.55, 3.2) * (1 - 0.2 * b.dmg.c);
  b.lean += clamp(tgt - b.lean, -rate * dt, rate * dt);
  // --- path curvature from lean angle: tan(lean) = v^2 * k / g
  let kap = G * Math.tan(b.lean) / Math.max(v * v, 30);
  if (v < 7) kap = lerp(c.steer * 0.3, kap, v / 7);
  kap = clamp(kap, -0.33, 0.33);
  let aLat = v * v * kap;
  // --- engine + gearbox
  const kg = (PHYS.redline * TAU / 60) / PHYS.gears[b.gear];
  const rpmW = rpmFor(v, b.gear);
  let rpmE = Math.max(rpmW, PHYS.idle);
  const slipping = rpmW < 8500 && c.thr > 0.05; // clutch slip at launch / very low speed
  if (slipping) rpmE = Math.max(rpmW, lerp(PHYS.idle, 9800, c.thr));
  const omega = rpmE * TAU / 60;
  let Te = PHYS.pMax * powerFrac(rpmE / PHYS.redline) / omega * (1 - 0.4 * b.dmg.e);
  let Fd = c.thr * Te * kg;
  if (rpmW > PHYS.redline + 120) Fd = 0;             // rev limiter
  if (b.fuel <= 0) Fd = 0;
  if (b.shiftCut > 0) { Fd *= 0.3; b.shiftCut -= dt; }
  let aDrive = Fd / m;
  b.wheelie = aDrive > PHYS.wheelie * 0.95 ? Math.min(1, b.wheelie + dt * 3) : Math.max(0, b.wheelie - dt * 4);
  aDrive = Math.min(aDrive, b.assist ? PHYS.wheelie : PHYS.wheelie * 1.1);
  let aBrake = c.brk * PHYS.brakeMax * SF.brake;
  const aEB = c.thr < 0.05 ? 1.0 * (rpmW / PHYS.redline) * Math.sqrt(kg / ((PHYS.redline * TAU / 60) / PHYS.gears[6])) : 0;
  const cda = PHYS.CdA * (1 + 0.35 * b.dmg.a) * (1 - 0.28 * b.draft);
  const aDrag = 0.5 * PHYS.rho * cda * v * v / m + (PHYS.roll + SF.roll) * G * (v > 0.2 ? 1 : 0);
  // --- tyre friction circle
  let aLatAbs = Math.abs(aLat);
  const longAvail = Math.sqrt(Math.max(0, gripMax * gripMax - aLatAbs * aLatAbs));
  if (b.assist) { aDrive = Math.min(aDrive, longAvail); aBrake = Math.min(aBrake, Math.max(longAvail, 0.15 * G)); }
  const aLong = Math.max(aDrive, aBrake);
  const used = Math.hypot(aLong, aLatAbs);
  if (used > gripMax && v > 4) {
    const ratio = used / gripMax;
    b.slip += (ratio - 1) * dt * (b.assist ? 1.6 : 3.4);
    const lf = Math.sqrt(Math.max(0, gripMax * gripMax - Math.min(aLong, gripMax * 0.9) ** 2));
    const lost = aLatAbs - Math.min(aLatAbs, lf);
    aLat = Math.sign(aLat) * Math.min(aLatAbs, lf);
    b.vs -= Math.sign(kap) * lost * dt * 0.35; // drifting wide
    aDrive = Math.min(aDrive, gripMax); aBrake = Math.min(aBrake, gripMax);
  } else b.slip = Math.max(0, b.slip - dt * 1.3);
  b.skid = used > gripMax * 0.97 || (c.brk > 0.85 && v > 25);
  if (b.slip > 0.5) { crashBike(b, W, c.thr > 0.5 ? 'highside' : 'lowside'); return; }
  if (b.surf === SURF.GRAVEL && v > 22 && Math.abs(b.lean) > 0.35 && W.rand() < dt * 1.2) { crashBike(b, W, 'gravel'); return; }
  // --- integrate
  const kapEff = v > 0.5 ? (v < 7 ? kap : aLat / (v * v)) : 0;
  b.h = angWrap(b.h + v * kapEff * dt);
  let acc = aDrive - aBrake - aDrag - aEB;
  b.v = Math.max(0, v + acc * dt);
  b.vs *= Math.exp(-dt * (3 + 6 * SF.mu));
  const ch = Math.cos(b.h), sh = Math.sin(b.h);
  b.x += (ch * b.v - sh * b.vs) * dt; b.y += (sh * b.v + ch * b.vs) * dt;
  b.aLongPrev = Math.max(aDrive, aBrake); b.aLat = aLat; b.aLong = acc;
  b.rpm = slipping ? rpmE : Math.max(rpmW, PHYS.idle + c.thr * 1500);
  b.rpmVis = lerp(b.rpmVis, b.rpm, Math.min(1, dt * 18));
  if (b.fuel > 0 && !W.infiniteFuel) b.fuel = Math.max(0, b.fuel - PHYS.fuelK * (0.1 + c.thr * Math.min(1, rpmE / PHYS.redline)) * dt);
  b.dist += b.v * dt;
  if (b.overrev > 0) b.overrev -= dt; if (b.shiftFlash > 0) b.shiftFlash -= dt;
}

function crashBike(b, W, why) {
  if (b.crashed) return;
  const [vx, vy] = bikeVel(b);
  const r = W.rand;
  b.crashed = true; b.crashes++; b.service = false;
  b.crash = { t: 0, why,
    bk: { x: b.x, y: b.y, vx: vx * 0.95, vy: vy * 0.95, rot: b.h, rv: (r() - 0.5) * 5, side: b.lean >= 0 ? 1 : -1 },
    rd: { x: b.x, y: b.y, vx: vx * 0.85 + (r() - 0.5) * 3, vy: vy * 0.85 + (r() - 0.5) * 3, rot: b.h, rv: (r() - 0.5) * 9 } };
  const sev = clamp(b.v / 70, 0.12, 1);
  b.dmg.a = Math.min(1, b.dmg.a + sev * (0.2 + r() * 0.2));
  b.dmg.c = Math.min(1, b.dmg.c + sev * (0.08 + r() * 0.14));
  b.dmg.e = Math.min(1, b.dmg.e + sev * (0.04 + r() * 0.14));
  b.lean = 0; b.slip = 0; b.ctl.thr = 0;
  W.event(b, 'crash', why);
}
function stepCrash(b, dt, W) {
  const C = b.crash; C.t += dt;
  for (const o of [C.bk, C.rd]) {
    const sp = Math.hypot(o.vx, o.vy);
    if (sp > 0.01) {
      T.project(o.x, o.y, b.i, Pj);
      const sf = T.surface(Pj.i, Pj.s, Pj.d);
      const dec = (sf === SURF.GRAVEL ? 2.6 : sf === SURF.GRASS ? 1.3 : 0.62) * G * (o === C.rd ? 1.15 : 1);
      const ns = Math.max(0, sp - dec * dt); o.vx *= ns / sp; o.vy *= ns / sp;
      o.x += o.vx * dt; o.y += o.vy * dt; o.rot += o.rv * dt; o.rv *= Math.exp(-dt * 1.2);
      if (sf === SURF.WALL) { const side = Pj.d >= 0 ? 0 : 1; const wd = T.WALL[side][Pj.i] - 0.6; const [px, py] = T.pt(Pj.i, side === 0 ? wd : -wd); o.x = px; o.y = py; o.vx *= 0.2; o.vy *= 0.2; }
      if (o === C.bk && sf !== SURF.GRAVEL && sf !== SURF.GRASS && ns > 3 && W.rand() < 0.7) W.fx.spark(o.x, o.y, o.vx, o.vy);
      if (o === C.bk && (sf === SURF.GRAVEL || sf === SURF.GRASS) && ns > 2) W.fx.dust(o.x, o.y, sf);
      if (o === C.bk && ns > 1) W.fx.mark(o.x, o.y, o.vx, o.vy, 0.5);
    }
  }
  const still = Math.hypot(C.bk.vx, C.bk.vy) < 0.3 && Math.hypot(C.rd.vx, C.rd.vy) < 0.3;
  if (still && C.t > 4.2) respawn(b, W);
}
function respawn(b, W) {
  if (b.dmg.e >= 0.999) { b.dnf = true; b.crashed = false; W.event(b, 'dnf'); return; }
  const C = b.crash;
  T.project(C.bk.x, C.bk.y, b.i, Pj);
  let i = Pj.i; const side = Pj.d >= 0 ? 1 : -1;
  const sr = T.rel(i * T.DS);
  let d = side * (side > 0 ? T.WR[i] : T.WL[i]) * 0.72;
  if (T.PIT.inZone(sr) && side > 0) d = T.WR[i] * 0.6;
  const [x, y] = T.pt(i, d);
  b.x = x; b.y = y; b.h = T.H[i]; b.v = 0; b.vs = 0; b.lean = 0; b.gear = 1; b.crashed = false; b.crash = null; b.slip = 0; b.i = i;
  b.s = i * T.DS; b.d = d; b.prevS = b.s;
  if (b.isPlayer) b.respawnGrace = 2;
  W.event(b, 'rejoin');
}

// ---------------------------------------------------------------------------
// AI rider
// ---------------------------------------------------------------------------
function aiControl(b, dt, W) {
  const A = b.ai, c = b.ctl, v = b.v, N = T.N, DS = T.DS, PIT = T.PIT;
  if (b.crashed || b.dnf) return;
  const sr = T.rel(b.s);
  A.think -= dt;
  // fuel strategy: decide before Stowe whether to box at the end of this lap
  if (W.mode !== 'quali' && !b.pitPlan && b.s > T.L - 1500 && b.s < T.L - 1300 && !b.finished && !W.flag) {
    const lapsLeft = W.totalLaps - b.lap - 1;
    const per = Math.max(1.6, b.fuelPerLap);
    if (lapsLeft > 0 && b.fuel < per * 1.15 + 0.4) { b.pitPlan = true; b.pitFill = Math.min(PHYS.tank, per * lapsLeft * 1.08 + 0.9); }
    if (b.dmg.a > 0.55 || b.dmg.c > 0.55) { b.pitPlan = lapsLeft > 1 || b.pitPlan; b.pitFill = Math.max(b.pitFill, Math.min(PHYS.tank, per * lapsLeft * 1.08 + 0.9)); }
  }
  // traffic awareness: nearest rider ahead in my lane, riders alongside
  if (A.think <= 0) {
    A.think = 0.08 + W.rand() * 0.06;
    A.block = null; A.side = 0;
    let best = 1e9;
    for (const o of W.bikes) {
      if (o === b || o.crashed || o.dnf || o.held) continue;
      let ds = o.s - b.s; if (ds < -T.L / 2) ds += T.L; if (ds > T.L / 2) ds -= T.L;
      const dd = o.d - b.d;
      if (ds > 1.5 && ds < 45 && Math.abs(dd) < 2.4) { if (ds < best) { best = ds; A.block = { o, ds }; } }
      if (Math.abs(ds) < 3.2 && Math.abs(dd) < 2.2) A.side += (dd > 0 ? -1 : 1) * (2.2 - Math.abs(dd)); // shy away from rider alongside
    }
    const curvy = Math.abs(T.RK[(b.i + 15) % N]) > 0.006 || Math.abs(T.RK[b.i]) > 0.006;
    const i2 = (b.i + 10) % N; const lo = -(T.WL[i2] - 1.4), hi = T.WR[i2] - 1.4; const myLine = T.lat[i2];
    if (A.block) {
      const o = A.block.o;
      const faster = (T.VP[b.i] * A.pace) > o.v + 1.2 && v > o.v + 0.5;
      if (faster && A.block.ds < 28 && (!curvy || A.passSide)) {
        const leftRoom = (o.d - 2.4) - lo, rightRoom = hi - (o.d + 2.4);
        let side = A.passSide || (rightRoom > leftRoom ? 1 : -1);
        if ((side > 0 ? rightRoom : leftRoom) < 0) side = -side;
        A.passSide = side;
        A.offT = clamp(o.d + side * 2.6, lo, hi) - myLine;
      } else if (!A.passSide) A.offT *= 0.5;
    } else { A.passSide = 0; A.offT *= 0.3; }
    if (A.side) A.offT = clamp(myLine + A.offT + A.side * 1.2, lo, hi) - myLine;
  }
  A.off = lerp(A.off, A.offT, Math.min(1, dt * 1.6));
  const look = 6 + v * 0.42; const j = (b.i + Math.round(look / DS)) % N;
  let dT = T.lat[j] + A.off;
  const sj = T.rel(j * DS);
  const pitting = b.pitPlan || b.inPitLane;
  if (pitting) {
    if (sj > PIT.sIn - 260 && sj < PIT.sIn + 2) dT = T.WR[j] - 2.2;
    const pc = PIT.center(sj);
    if (pc !== null) dT = pc;
    if (b.pitPlan && pc !== null) { const bs = PIT.boxS(b.box); if (sj > bs - 45 && sj < bs + 10) dT = lerp(PIT.d, PIT.boxD, sstep((sj - (bs - 45)) / 30)); }
    if (!b.pitPlan && b.inPitLane && sj > PIT.flatOut) dT = pc !== null ? pc : dT;
  }
  dT = clamp(dT, -(T.WL[j] - 0.9), pitting ? 30 : T.WR[j] - 0.9);
  const tx = T.X[j] + T.NX[j] * dT, ty = T.Y[j] + T.NY[j] * dT;
  const ang = angWrap(Math.atan2(ty - b.y, tx - b.x) - b.h);
  const Ld = Math.hypot(tx - b.x, ty - b.y);
  const kap = 2 * Math.sin(ang) / Math.max(Ld, 3);
  c.leanT = Math.atan(kap * Math.max(v, 3) ** 2 / G);
  c.steer = clamp(kap / 0.3, -1, 1);
  // speed target
  let vt = T.VP[(b.i + Math.round((v * 0.16 + 2) / DS)) % N] * A.pace;
  { const warm = b.dist < 2500 ? 0.93 + 0.07 * b.dist / 2500 : 1; const gf = warm * (1 - 0.045 * Math.min(1, b.dist / 120000)) * (1 - 0.13 * b.dmg.c); vt *= Math.sqrt(gf / 0.985) * (1 - 0.05 * b.dmg.c); }
  // riding off the racing line costs corner speed
  vt *= 1 - Math.min(0.12, Math.abs(A.off) * Math.abs(T.RK[(b.i + 6) % N]) * 3.2);
  if (A.block) {
    const o = A.block.o; const want = 3.5 + v * 0.12; const gap = A.block.ds - want;
    if (!A.passSide || Math.abs(o.d - b.d) < 1.5) vt = Math.min(vt, o.v + clamp(gap * 0.6, -6, 25));
  }
  if (pitting) {
    const lim = PHYS.pitLimit - 0.4;
    if (sr > PIT.limIn - 140 && sr < PIT.limIn) vt = Math.min(vt, Math.sqrt(lim * lim + 2 * 9 * Math.max(0, PIT.limIn - sr)));
    if (b.inPitLane && sr >= PIT.limIn && sr <= PIT.limOut) vt = Math.min(vt, lim);
    if (b.pitPlan) { const bs = PIT.boxS(b.box); if (sr > bs - 80 && sr < bs + 3) vt = Math.min(vt, Math.sqrt(2 * 5 * Math.max(0, bs - sr - 0.3))); }
  }
  if (b.service) vt = 0;
  if (W.flag && b.finished) vt = Math.min(vt, 30);
  // mistakes: occasional late braking for lower-consistency riders
  if (A.mistake > 0) { A.mistake -= dt; vt *= 1.06; } else if (W.rand() < dt * 0.004 * (1 - A.cons)) A.mistake = 0.6;
  if (v < vt - 0.2) { c.thr = clamp((vt - v) * 0.6 + 0.25, 0, 1); c.brk = 0; }
  else if (v > vt + 0.4) { c.thr = 0; c.brk = clamp((v - vt) * 0.3, 0, 1); }
  else { c.thr = 0.35; c.brk = 0; }
  if (b.service) { c.thr = 0; c.brk = 1; }
}
