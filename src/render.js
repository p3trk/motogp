
// ---------------------------------------------------------------------------
// Rendering: procedural textures, track geometry paths, scenery, bikes
// ---------------------------------------------------------------------------
const cv = document.getElementById('game');
const mainCtx = cv.getContext('2d', { alpha: false });
// HUD on its own flat layer, so the world canvas can be tilted in 3D (GDD 11a)
const hcv = document.createElement('canvas'); hcv.id = 'hud'; cv.after(hcv);
// tilted view: the ground plane is rendered top-down into two offscreen canvases (near band at full detail,
// far band at half resolution), then projected onto the screen in thin horizontal strips (GDD 11a)
const nearCv = mkCanvas(1, 1), farCv = mkCanvas(1, 1);
const hudCtx = hcv.getContext('2d');
let ctx = mainCtx;
let DPR = 1, VW = 800, VH = 600;
let DPR_CAP = 1.5;
// virtual ground canvas RW x RH (css px): the screen in top-down, larger when tilted, split into LAYERS
let RW = 800, RH = 600, ODPR = 1;
let LAYERS = [];
const TILT = { a: 40 * DEG, p: 1.3, wk: 2.3, hk: 2.6, bike: 0.2, q: 1 }; // q: resolution scale, lowered on slow machines
function tiltBikeH() { const P = TILT.p * VH, s = TILT.bike * VH; return s * P / (Math.cos(TILT.a) * P - s * Math.sin(TILT.a)); } // canvas px above the bottom edge that project to TILT.bike of the screen
function resize() {
  DPR = Math.min(DPR_CAP, window.devicePixelRatio || 1); VW = window.innerWidth; VH = window.innerHeight;
  hcv.width = Math.round(VW * DPR); hcv.height = Math.round(VH * DPR);
  const tilt = CAM.mode === 'behind';
  ODPR = tilt ? 1 : DPR; // tilted view is resampled anyway; HUD stays sharp on its own layer
  cv.width = Math.round(VW * ODPR); cv.height = Math.round(VH * ODPR);
  RW = tilt ? Math.round(VW * TILT.wk) : VW; RH = tilt ? Math.round(VH * TILT.hk) : VH;
  const layer = (c, x0, y0, w, h, dpr) => { if (c !== cv) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); } return { c, g: c === cv ? mainCtx : c.getContext('2d', { alpha: false }), x0, y0, w, h, dpr }; };
  if (tilt) {
    const P = TILT.p * VH, hN = Math.round(VH), wN = Math.min(RW, Math.ceil(VW * (P + hN * Math.sin(TILT.a)) / P) + 8);
    const hB = Math.round(hN * 0.3); // far band reaches this far into the near band, where the two cross-fade (GDD 1.11.6)
    LAYERS = [layer(farCv, 0, 0, RW, RH - hN + hB + 4, 0.45 * TILT.q), layer(nearCv, (RW - wN) / 2, RH - hN, wN, hN, 0.75 * TILT.q)]; LAYERS[0].hB = hB;
  } else LAYERS = [layer(cv, 0, 0, VW, VH, DPR)];
}

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function noiseTex(size, base, amp, seed, extra) {
  const c = mkCanvas(size, size), g = c.getContext('2d'), r = mulberry(seed);
  const id = g.createImageData(size, size), d = id.data;
  for (let i = 0; i < size * size; i++) { const n = (r() - 0.5) * amp; d[i * 4] = base[0] + n; d[i * 4 + 1] = base[1] + n; d[i * 4 + 2] = base[2] + n * (base[3] || 1); d[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0);
  if (extra) extra(g, size, r);
  return c;
}
const TEX = {};
function buildTextures() {
  TEX.asph = noiseTex(256, [60, 63, 67], 26, 11, (g, S, r) => {
    for (let k = 0; k < 1600; k++) { const v = 90 + r() * 70; g.fillStyle = `rgba(${v},${v},${v + 4},${0.5 + r() * 0.4})`; g.fillRect(r() * S, r() * S, 1, 1); }
    for (let k = 0; k < 24; k++) { const x = r() * S, y = r() * S, rad = 10 + r() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, rad); const dark = r() < 0.5; gr.addColorStop(0, dark ? 'rgba(20,22,25,.10)' : 'rgba(120,124,128,.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  });
  TEX.grass = noiseTex(512, [62, 112, 48], 22, 12, (g, S, r) => {
    for (let k = 0; k < 9000; k++) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(30,70,22,${0.3 + r() * 0.3})` : `rgba(120,170,80,${0.15 + r() * 0.25})`; g.fillRect(r() * S, r() * S, 1, 2); }
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? 'rgba(255,255,240,.05)' : 'rgba(0,30,0,.04)'; g.fillRect(0, k * S / 8, S, S / 8); }
    for (let k = 0; k < 30; k++) { const x = r() * S, y = r() * S, rad = 20 + r() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, r() < 0.5 ? 'rgba(30,60,20,.12)' : 'rgba(150,170,80,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  });
  TEX.gravel = noiseTex(256, [196, 178, 142], 34, 13, (g, S, r) => {
    for (let k = 0; k < 2600; k++) { const v = r(); g.fillStyle = v < 0.3 ? '#8f8a80' : v < 0.6 ? '#e3d6b8' : v < 0.8 ? '#a8916a' : '#d8cdb6'; g.beginPath(); g.ellipse(r() * S, r() * S, 0.6 + r() * 1.6, 0.6 + r() * 1.2, r() * 3, 0, TAU); g.fill(); }
  });
  TEX.run = noiseTex(256, [70, 79, 86], 20, 14, (g, S, r) => { for (let k = 0; k < 900; k++) { const v = 100 + r() * 50; g.fillStyle = `rgba(${v},${v + 6},${v + 12},.5)`; g.fillRect(r() * S, r() * S, 1, 1); } });
  TEX.pit = noiseTex(256, [88, 91, 96], 18, 15);
  TEX.crowd = noiseTex(128, [40, 52, 72], 10, 16, (g, S, r) => {
    const cols = ['#e8e1d5', '#d63a2f', '#2e5fd6', '#f2c230', '#1d1d1d', '#ffffff', '#3f9b4a', '#ff7f2a', '#c7b299'];
    for (let y = 2; y < S; y += 5) for (let x = 1; x < S; x += 3.2) if (r() < 0.82) { g.fillStyle = cols[(r() * cols.length) | 0]; g.beginPath(); g.arc(x + r(), y + r(), 1.25, 0, TAU); g.fill(); }
  });
  TEX.roof = noiseTex(128, [214, 218, 222], 10, 17, (g, S) => { g.fillStyle = 'rgba(0,0,0,.06)'; for (let x = 0; x < S; x += 8) g.fillRect(x, 0, 1, S); });
  TEX.concrete = noiseTex(128, [150, 150, 146], 22, 18);
  const pat = (c, metres) => { const p = ctx.createPattern(c, 'repeat'); p.setTransform(new DOMMatrix().scale(metres / c.width)); return p; };
  TEX.pAsph = pat(TEX.asph, 9); TEX.pGrass = pat(TEX.grass, 46); TEX.pGravel = pat(TEX.gravel, 5); TEX.pRun = pat(TEX.run, 9); TEX.pPit = pat(TEX.pit, 9);
  TEX.pCrowd = pat(TEX.crowd, 7); TEX.pRoof = pat(TEX.roof, 12); TEX.pConc = pat(TEX.concrete, 6);
  // trees
  TEX.trees = [];
  for (let k = 0; k < 5; k++) {
    const S = 96, c = mkCanvas(S, S), g = c.getContext('2d'), r = mulberry(40 + k);
    const hue = [[46, 92, 38], [58, 104, 44], [38, 78, 34], [72, 110, 50], [52, 86, 40]][k];
    for (let b = 0; b < 14; b++) {
      const a = r() * TAU, rr = r() * 26, x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr, rad = 14 + r() * 12;
      const gr = g.createRadialGradient(x - rad * 0.35, y - rad * 0.35, 1, x, y, rad);
      gr.addColorStop(0, `rgb(${hue[0] + 50},${hue[1] + 50},${hue[2] + 30})`); gr.addColorStop(0.6, `rgb(${hue[0]},${hue[1]},${hue[2]})`); gr.addColorStop(1, `rgba(${hue[0] - 20},${hue[1] - 30},${hue[2] - 20},0.0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    TEX.trees.push(c);
  }
  // soft shadow blob
  const sc = mkCanvas(64, 64), sg = sc.getContext('2d'); const gr = sg.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64); TEX.shadow = sc;
}

// --- static geometry as world-space Path2D objects
const GEO = {};
function buildGeometry() {
  const N = T.N, X = T.X, Y = T.Y, NX = T.NX, NY = T.NY;
  const P = (i, d) => [X[i] + NX[i] * d, Y[i] + NY[i] * d];
  // asphalt ring
  const track = new Path2D();
  for (let i = 0; i <= N; i++) { const k = i % N; const [x, y] = P(k, T.WR[k]); i ? track.lineTo(x, y) : track.moveTo(x, y); } track.closePath();
  for (let i = 0; i <= N; i++) { const k = i % N; const [x, y] = P(k, -T.WL[k]); i ? track.lineTo(x, y) : track.moveTo(x, y); } track.closePath();
  GEO.track = track;
  // run-off strips by type
  const strip = (side, pred, d0f, d1f) => {
    const p = new Path2D(); const sg = side ? -1 : 1; let i = 0;
    const on = k => pred(k);
    // find a start that is "off" to avoid wrap splits
    let start = 0; while (start < N && on(start)) start++;
    for (let n = 0; n < N; n++) {
      const k = (start + n) % N; if (!on(k)) continue;
      const run = []; let m = n; while (m < N && on((start + m) % N)) { run.push((start + m) % N); m++; }
      n = m;
      if (run.length < 2) continue;
      run.unshift((run[0] - 1 + N) % N); run.push((run[run.length - 1] + 1) % N);
      run.forEach((q, j) => { const [x, y] = P(q, sg * d0f(q)); j ? p.lineTo(x, y) : p.moveTo(x, y); });
      for (let j = run.length - 1; j >= 0; j--) { const q = run[j]; const [x, y] = P(q, sg * d1f(q, j === 0 || j === run.length - 1)); p.lineTo(x, y); }
      p.closePath();
    }
    return p;
  };
  GEO.gravel = []; GEO.runoff = [];
  for (let s = 0; s < 2; s++) {
    const E = T.EDGE[s];
    GEO.gravel.push(strip(s, k => T.RT[s][k] === SURF.GRAVEL && T.RUN[s][k] > 1, k => E[k] + T.KERB[s][k] - 0.2, (k, end) => E[k] + T.KERB[s][k] + (end ? 0 : T.RUN[s][k])));
    GEO.runoff.push(strip(s, k => T.RT[s][k] === SURF.RUN && T.RUN[s][k] > 1, k => E[k] - 0.2, (k, end) => E[k] + T.KERB[s][k] + (end ? 0 : T.RUN[s][k])));
    GEO.runoff.push(strip(s, k => T.RT[s][k] === SURF.GRAVEL && T.RUN[s][k] > 1, k => E[k] - 0.2, (k) => E[k] + T.KERB[s][k] + 2.5));
  }
  // kerbs (alternating 2 m blocks)
  GEO.kerbR = new Path2D(); GEO.kerbW = new Path2D();
  for (let s = 0; s < 2; s++) {
    const sg = s ? -1 : 1, E = T.EDGE[s], K = T.KERB[s];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N; if (K[i] <= 0 || K[j] <= 0) continue;
      const pth = (i % 2) ? GEO.kerbR : GEO.kerbW;
      const a = P(i, sg * (E[i] - 0.05)), b = P(j, sg * (E[j] - 0.05)), c = P(j, sg * (E[j] + K[j])), d = P(i, sg * (E[i] + K[i]));
      pth.moveTo(a[0], a[1]); pth.lineTo(b[0], b[1]); pth.lineTo(c[0], c[1]); pth.lineTo(d[0], d[1]); pth.closePath();
    }
  }
  // white edge lines + racing line rubber
  GEO.lines = new Path2D();
  for (let s = 0; s < 2; s++) { const sg = s ? -1 : 1; for (let i = 0; i <= N; i++) { const k = i % N; const [x, y] = P(k, sg * (T.EDGE[s][k] - 0.35)); i ? GEO.lines.lineTo(x, y) : GEO.lines.moveTo(x, y); } }
  GEO.rubber = new Path2D(); for (let i = 0; i <= N; i++) { const k = i % N; i ? GEO.rubber.lineTo(T.RX[k], T.RY[k]) : GEO.rubber.moveTo(T.RX[k], T.RY[k]); }
  // walls: skip the garage frontage
  const PIT = T.PIT;
  GEO.walls = new Path2D(); GEO.fence = new Path2D();
  for (let s = 0; s < 2; s++) {
    const sg = s ? -1 : 1; let pen = false;
    for (let i = 0; i <= N; i++) {
      const k = i % N, sr = T.rel(k * T.DS);
      if (s === 0 && sr > PIT.sIn - 2 && sr < PIT.sOut + 2) { pen = false; continue; }
      const [x, y] = P(k, sg * T.WALL[s][k]); const [fx, fy] = P(k, sg * (T.WALL[s][k] + 1.6));
      if (!pen) { GEO.walls.moveTo(x, y); GEO.fence.moveTo(fx, fy); pen = true; } else { GEO.walls.lineTo(x, y); GEO.fence.lineTo(fx, fy); }
    }
  }
  // pit lane
  GEO.pit = new Path2D(); GEO.pitLines = new Path2D(); GEO.pitDash = new Path2D(); GEO.pitWall = new Path2D(); GEO.hatch = new Path2D();
  const i0 = T.idx(PIT.sIn), i1 = T.idx(PIT.sOut); const idxs = []; for (let k = i0; k !== (i1 + 1) % N; k = (k + 1) % N) idxs.push(k);
  const prs = k => T.rel(k * T.DS);
  const PX = PIT.PX, ie0 = T.idx(PIT.sIn - PX), ie1 = T.idx(PIT.sOut + PX), idxE = []; for (let k = ie0; k !== (ie1 + 1) % N; k = (k + 1) % N) idxE.push(k);
  const pitEdge = PIT.edge;
  idxE.forEach((k, j) => { const [x, y] = P(k, pitEdge(k, -1, 0)); j ? GEO.pit.lineTo(x, y) : GEO.pit.moveTo(x, y); });
  for (let j = idxE.length - 1; j >= 0; j--) { const k = idxE[j]; const [x, y] = P(k, pitEdge(k, 1, 0)); GEO.pit.lineTo(x, y); }
  GEO.pit.closePath();
  for (const sgn of [-1, 1]) idxE.forEach((k, j) => { const [x, y] = P(k, pitEdge(k, sgn, 0.3)); j ? GEO.pitLines.lineTo(x, y) : GEO.pitLines.moveTo(x, y); });
  let first = true; idxs.forEach(k => { const sr = prs(k); if (sr < PIT.flatIn || sr > PIT.flatOut) return; const [x, y] = P(k, PIT.d + 1.3); first ? GEO.pitDash.moveTo(x, y) : GEO.pitDash.lineTo(x, y); first = false; });
  first = true; idxs.forEach(k => { const sr = prs(k); if (sr < PIT.flatIn - 6 || sr > PIT.flatOut + 6) return; const [x, y] = P(k, PIT.wallD); first ? GEO.pitWall.moveTo(x, y) : GEO.pitWall.lineTo(x, y); first = false; });
  // painted chevrons between track and pit ramps
  for (const [a0, a1] of [[PIT.sIn + 8, PIT.flatIn], [PIT.flatOut, PIT.sOut - 8]]) for (let sr = a0; sr < a1; sr += 5) {
    const k = T.idx(sr); const c = PIT.center(sr); if (c === null) continue; const inner = T.WR[k] + 0.2, outer = c - PIT.halfW(sr) - 0.2; if (outer - inner < 0.8) continue;
    const [x1, y1] = P(k, inner), [x2, y2] = P(T.idx(sr + 3), outer); GEO.hatch.moveTo(x1, y1); GEO.hatch.lineTo(x2, y2);
  }
  // box markings
  GEO.boxes = []; for (let b = 0; b < 22; b++) { const sr = PIT.boxS(b); GEO.boxes.push({ sr, i: T.idx(sr) }); }
  // grid slots
  GEO.grid = new Path2D();
  for (let k = 0; k < 22; k++) { const r = Math.floor(k / 3), c = k % 3; const sr = -8 - r * 9.5 - c * 2.4 + 1.1; const i = T.idx(sr); const d = (1 - c) * 3.9; const [ax, ay] = P(i, d - 0.9), [bx, by] = P(i, d + 0.9); GEO.grid.moveTo(ax, ay); GEO.grid.lineTo(bx, by); const i2 = T.idx(sr - 1.2); for (const e of [-0.9, 0.9]) { const [p1, p2] = P(i, d + e), [q1, q2] = P(i2, d + e); GEO.grid.moveTo(p1, p2); GEO.grid.lineTo(q1, q2); } }
  // minimap path
  buildScenery();
}

// scenery: grandstands, buildings, trees
const SCN = { stands: [], buildings: [], trees: [] };
function trackClear(x, y, margin) {
  let ok = true;
  T.near(x, y, 75, j => { if (!ok) return; const dx = x - T.X[j], dy = y - T.Y[j]; const d = dx * T.NX[j] + dy * T.NY[j]; const side = d >= 0 ? 0 : 1; const lim = T.WALL[side][j] + margin; if (Math.hypot(dx, dy) < lim) ok = false; });
  return ok;
}
function inPitCompound(x, y) {
  const i = T.nearestGlobal(x, y); const sr = T.rel(i * T.DS); const d = (x - T.X[i]) * T.NX[i] + (y - T.Y[i]) * T.NY[i];
  return sr > T.PIT.sIn - 60 && sr < T.PIT.sOut + 60 && d > 0 && d < 190;
}
function buildScenery() {
  const r = mulberry(99), PIT = T.PIT;
  // pit building (the Wing) + paddock
  const fi = T.idx(PIT.flatIn - 6), fo = T.idx(PIT.flatOut + 6);
  const mk = (sa, sb, d0, d1) => { const pts = []; for (let sr = sa; sr <= sb; sr += 4) { const k = T.idx(sr); pts.push(T.pt(k, d0)); } for (let sr = sb; sr >= sa; sr -= 4) { const k = T.idx(sr); pts.push(T.pt(k, d1)); } return pts; };
  SCN.wing = { garage: mk(PIT.flatIn - 8, PIT.flatOut + 8, PIT.garage, PIT.garage + 16), roof: mk(PIT.flatIn - 14, PIT.flatOut + 14, PIT.garage + 3, PIT.garage + 34) };
  const ang = T.H[T.idx((PIT.flatIn + PIT.flatOut) / 2)];
  for (let row = 0; row < 4; row++) for (let k = 0; k < 14; k++) {
    const sr = PIT.flatIn + 10 + k * ((PIT.flatOut - PIT.flatIn - 20) / 13); const i = T.idx(sr); const [x, y] = T.pt(i, PIT.garage + 50 + row * 22);
    SCN.buildings.push({ x, y, w: 15, h: 5.2, a: ang, col: TEAMS[(k + row * 3) % TEAMS.length].c1, kind: 'home' });
  }
  // grandstands at classic viewing spots
  for (const cn of ['Abbey', 'Village', 'Luffield', 'Woodcote', 'Copse', 'Becketts', 'Chapel', 'Stowe', 'Club', 'Vale', 'Brooklands']) {
    const c = T.corners.find(q => q.name === cn); if (!c) continue;
    const outside = T.KS[c.i] > 0 ? -1 : 1; const side = outside > 0 ? 0 : 1;
    for (let tryk = 0; tryk < 6; tryk++) {
      const i = (c.i + (tryk - 2) * 12 + T.N) % T.N; const dist = T.WALL[side][i] + 14 + tryk * 3;
      const [x, y] = T.pt(i, outside * dist); const a = T.H[i]; const w = 70 + r() * 40, h = 16;
      const cs = Math.cos(a), sn = Math.sin(a); let ok = true;
      for (const [u, v] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2], [0, 0]]) { const px = x + cs * u - sn * v, py = y + sn * u + cs * v; if (!trackClear(px, py, 4)) ok = false; }
      if (ok && !inPitCompound(x, y)) { SCN.stands.push({ x, y, w, h, a, flip: outside }); break; }
    }
  }
  // trees in clusters around the estate
  const bb = T.bbox;
  for (let cl = 0; cl < 80; cl++) {
    const cx = lerp(bb.minx - 180, bb.maxx + 180, r()), cy = lerp(bb.miny - 180, bb.maxy + 180, r()); const n = 6 + (r() * 22) | 0;
    for (let k = 0; k < n; k++) {
      const x = cx + (r() - 0.5) * 90, y = cy + (r() - 0.5) * 90, rad = 3 + r() * 4.5;
      if (!trackClear(x, y, rad + 4)) continue; if (inPitCompound(x, y)) continue;
      let hitS = false; for (const s of SCN.stands) if (Math.hypot(s.x - x, s.y - y) < s.w / 2 + 10) hitS = true; if (hitS) continue;
      SCN.trees.push({ x, y, r: rad, v: (r() * 5) | 0, rot: r() * TAU });
    }
  }
  // single trees along the boundary fences
  for (let k = 0; k < 500; k++) {
    const i = (r() * T.N) | 0, side = r() < 0.5 ? 0 : 1; const d = (side ? -1 : 1) * (T.WALL[side][i] + 10 + r() * 30); const [x, y] = T.pt(i, d); const rad = 2.5 + r() * 3.5;
    if (!trackClear(x, y, rad + 3) || inPitCompound(x, y)) continue; SCN.trees.push({ x, y, r: rad, v: (r() * 5) | 0, rot: r() * TAU });
  }
}

// --- bike sprites (top-down, bike pointing +x, 48 px per metre)
const SPR = 48, SPW = Math.ceil(2.5 * SPR), SPH = Math.ceil(1.3 * SPR);
const SPRITES = {};
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } return `rgb(${r | 0},${g | 0},${b | 0})`; }
function bikeSprite(team, num) {
  const key = team + '_' + num; if (SPRITES[key]) return SPRITES[key];
  const Tm = TEAMS[team];
  const mkc = () => { const c = mkCanvas(SPW, SPH), g = c.getContext('2d'); g.translate(SPW / 2, SPH / 2); g.scale(SPR, SPR); return [c, g]; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  // chassis
  const [cc, g] = mkc();
  g.fillStyle = '#121212'; rr(g, -1.02, -0.105, 0.62, 0.21, 0.08); g.fill(); rr(g, 0.44, -0.068, 0.58, 0.136, 0.06); g.fill();
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-0.98, -0.02, 0.54, 0.04); g.fillRect(0.48, -0.015, 0.5, 0.03);
  g.fillStyle = '#30353a'; rr(g, -0.78, -0.13, 0.5, 0.26, 0.05); g.fill();
  // brake discs
  g.fillStyle = '#7d7f82'; g.fillRect(0.6, -0.1, 0.26, 0.03); g.fillRect(0.6, 0.07, 0.26, 0.03);
  const body = new Path2D();
  body.moveTo(0.98, 0); body.bezierCurveTo(0.95, 0.12, 0.78, 0.22, 0.55, 0.3); body.lineTo(0.3, 0.31); body.bezierCurveTo(0.1, 0.3, 0.0, 0.27, -0.25, 0.2);
  body.lineTo(-0.62, 0.15); body.bezierCurveTo(-0.82, 0.12, -0.92, 0.07, -0.94, 0); body.bezierCurveTo(-0.92, -0.07, -0.82, -0.12, -0.62, -0.15); body.lineTo(-0.25, -0.2);
  body.bezierCurveTo(0.0, -0.27, 0.1, -0.3, 0.3, -0.31); body.lineTo(0.55, -0.3); body.bezierCurveTo(0.78, -0.22, 0.95, -0.12, 0.98, 0); body.closePath();
  const gr = g.createLinearGradient(0, -0.32, 0, 0.32); gr.addColorStop(0, shade(Tm.c1, -0.45)); gr.addColorStop(0.35, shade(Tm.c1, 0.12)); gr.addColorStop(0.5, shade(Tm.c1, 0.28)); gr.addColorStop(0.65, shade(Tm.c1, 0.05)); gr.addColorStop(1, shade(Tm.c1, -0.5));
  g.fillStyle = gr; g.fill(body);
  g.save(); g.clip(body); g.fillStyle = Tm.c2; g.fillRect(-1, -0.055, 2, 0.11); g.fillStyle = shade(Tm.c2, -0.2); g.fillRect(0.05, -0.31, 0.2, 0.62); g.restore();
  g.lineWidth = 0.012; g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(body);
  // winglets
  g.fillStyle = '#16181a'; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(0.66, sg * 0.27); g.lineTo(0.5, sg * 0.4); g.lineTo(0.43, sg * 0.4); g.lineTo(0.5, sg * 0.28); g.closePath(); g.fill(); }
  // windscreen + nose number
  g.fillStyle = 'rgba(25,35,48,.82)'; g.beginPath(); g.ellipse(0.66, 0, 0.17, 0.13, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(0.7, -0.04, 0.08, 0.035, 0, 0, TAU); g.fill();
  // seat + tail number
  g.fillStyle = '#1b1d20'; rr(g, -0.56, -0.13, 0.32, 0.26, 0.06); g.fill();
  g.save(); g.translate(-0.74, 0); g.rotate(Math.PI / 2); g.fillStyle = '#fff'; g.font = '800 0.2px "Saira Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 0.03; g.strokeStyle = '#000'; g.strokeText(String(num), 0, 0); g.fillText(String(num), 0, 0); g.restore();
  g.fillStyle = '#b8bcc0'; g.beginPath(); g.arc(-0.95, 0.06, 0.035, 0, TAU); g.arc(-0.95, -0.06, 0.035, 0, TAU); g.fill();
  // rider
  const [rc, h] = mkc();
  h.lineCap = 'round';
  for (const sg of [-1, 1]) { h.strokeStyle = shade(Tm.c1, -0.3); h.lineWidth = 0.12; h.beginPath(); h.moveTo(-0.32, sg * 0.18); h.lineTo(-0.05, sg * 0.27); h.stroke(); }
  for (const sg of [-1, 1]) { h.strokeStyle = shade(Tm.c1, -0.15); h.lineWidth = 0.085; h.beginPath(); h.moveTo(0.02, sg * 0.19); h.quadraticCurveTo(0.25, sg * 0.3, 0.42, sg * 0.29); h.stroke(); h.fillStyle = '#151515'; h.beginPath(); h.arc(0.44, sg * 0.29, 0.045, 0, TAU); h.fill(); }
  const tg = h.createLinearGradient(0, -0.22, 0, 0.22); tg.addColorStop(0, shade(Tm.c1, -0.5)); tg.addColorStop(0.5, shade(Tm.c1, 0.2)); tg.addColorStop(1, shade(Tm.c1, -0.5));
  h.fillStyle = tg; h.beginPath(); h.ellipse(-0.12, 0, 0.34, 0.205, 0, 0, TAU); h.fill();
  h.fillStyle = Tm.c2; h.beginPath(); h.ellipse(-0.16, 0, 0.3, 0.05, 0, 0, TAU); h.fill();
  h.fillStyle = shade(Tm.c2, -0.1); h.beginPath(); h.ellipse(-0.42, 0, 0.12, 0.12, 0, 0, TAU); h.fill();
  const hg = h.createRadialGradient(0.22, -0.05, 0.02, 0.26, 0, 0.16); hg.addColorStop(0, shade(Tm.c3, 0.5)); hg.addColorStop(0.7, Tm.c3); hg.addColorStop(1, shade(Tm.c3, -0.5));
  h.fillStyle = hg; h.beginPath(); h.arc(0.26, 0, 0.145, 0, TAU); h.fill();
  h.fillStyle = Tm.c1; h.fillRect(0.14, -0.025, 0.24, 0.05);
  h.fillStyle = 'rgba(10,14,20,.9)'; h.beginPath(); h.arc(0.26, 0, 0.145, -0.75, 0.75); h.lineTo(0.3, 0); h.closePath(); h.fill();
  SPRITES[key] = { c: cc, r: rc };
  return SPRITES[key];
}

// --- camera: 'behind' = tilted chase view, 'chase' = top-down rotating (GDD 11a)
const CAM = { x: 0, y: 0, rot: 0, ppm: 10, mode: 'behind', init: false, ax: 0.5, ay: 0.6, boost: 1 };
function setCamMode(m) { if (CAM.mode === m) return; CAM.mode = m; CAM.init = false; resize(); }
function updateCamera(dt) {
  const b = W.player; if (!b) return;
  let px = b.x, py = b.y, h = b.h, v = b.v;
  if (b.crashed && b.crash) { px = b.crash.rd.x; py = b.crash.rd.y; v = Math.hypot(b.crash.rd.vx, b.crash.rd.vy); }
  let tx, ty, targetPpm;
  if (CAM.mode === 'behind') {
    CAM.ay = 1 - tiltBikeH() / RH;
    targetPpm = Math.min(20, Math.min(VW, VH * 1.25) / (30 + v * 1.0));
    tx = px; ty = py;
  } else {
    CAM.ay = 0.6;
    targetPpm = Math.min(24, Math.min(VW, VH * 1.25) / (34 + v * 0.95));
    const look = Math.min(55, v * 0.62, VH * 0.24 / targetPpm); // keeps the bike on screen at top speed
    tx = px + Math.cos(h) * look; ty = py + Math.sin(h) * look;
  }
  const tr = -h - Math.PI / 2;
  if (!CAM.init) { CAM.x = tx; CAM.y = ty; CAM.rot = tr; CAM.ppm = targetPpm; CAM.init = true; }
  if (CAM.mode === 'behind') { CAM.x = tx; CAM.y = ty; }
  else { const k = 1 - Math.exp(-dt * 6); CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k; }
  CAM.rot += angWrap(tr - CAM.rot) * (1 - Math.exp(-dt * 4.5));
  CAM.ppm += (targetPpm - CAM.ppm) * (1 - Math.exp(-dt * 1.8));
  CAM.boost = CAM.mode === 'behind' ? Math.max(1, 40 / (2.5 * PHYS.VS * CAM.ppm)) : 1; // keep bikes readable when zoomed out
}
function worldToCanvas(x, y) {
  const dx = x - CAM.x, dy = y - CAM.y, c = Math.cos(CAM.rot), s = Math.sin(CAM.rot);
  return [RW * CAM.ax + (dx * c - dy * s) * CAM.ppm, RH * CAM.ay + (dx * s + dy * c) * CAM.ppm];
}
function canvasToWorld(sx, sy) {
  const dx = (sx - RW * CAM.ax) / CAM.ppm, dy = (sy - RH * CAM.ay) / CAM.ppm, c = Math.cos(CAM.rot), s = Math.sin(CAM.rot);
  return [CAM.x + dx * c + dy * s, CAM.y - dx * s + dy * c];
}
function worldToScreen(x, y) {
  const [cx, cy] = worldToCanvas(x, y);
  if (CAM.mode !== 'behind') return [cx, cy];
  // same projection as the CSS perspective(P) rotateX(a) about the canvas bottom centre
  const P = TILT.p * VH, yy = cy - RH, sc = P / (P - yy * Math.sin(TILT.a));
  return [VW / 2 + (cx - RW / 2) * sc, VH + yy * Math.cos(TILT.a) * sc];
}

// --- static world baked into cached tiles (track, run-off, walls, paint, buildings, trees)
// detail levels: 40 m tiles close up, 80 m and 160 m tiles when zoomed out or far away in the tilted view
const TILE_PX = 512;
const TLV = [{ m: 40, map: new Map(), cap: 160 }, { m: 80, map: new Map(), cap: 140 }, { m: 160, map: new Map(), cap: 140 }];
let tileFrame = 0;
function drawStatic(vis, x0, y0, w, h) {
  ctx.fillStyle = TEX.pGrass; ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = TEX.pRun; for (const p of GEO.runoff) ctx.fill(p);
  ctx.fillStyle = TEX.pGravel; for (const p of GEO.gravel) ctx.fill(p);
  ctx.fillStyle = TEX.pPit; ctx.fill(GEO.pit);
  ctx.strokeStyle = 'rgba(240,240,240,.85)'; ctx.lineWidth = 0.3; ctx.stroke(GEO.hatch);
  ctx.lineWidth = 0.22; ctx.stroke(GEO.pitLines);
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,214,40,.8)'; ctx.stroke(GEO.pitDash); ctx.setLineDash([]);
  ctx.fillStyle = TEX.pAsph; ctx.fill(GEO.track, 'evenodd');
  ctx.strokeStyle = 'rgba(12,12,14,.16)'; ctx.lineWidth = 2.2; ctx.stroke(GEO.rubber);
  ctx.strokeStyle = 'rgba(12,12,14,.10)'; ctx.lineWidth = 4.5; ctx.stroke(GEO.rubber);
  ctx.fillStyle = '#d42a24'; ctx.fill(GEO.kerbR); ctx.fillStyle = '#f2f0ec'; ctx.fill(GEO.kerbW);
  ctx.strokeStyle = 'rgba(245,245,245,.92)'; ctx.lineWidth = 0.28; ctx.stroke(GEO.lines);
  ctx.strokeStyle = 'rgba(245,245,245,.85)'; ctx.lineWidth = 0.2; ctx.stroke(GEO.grid);
  drawTrackPaint(vis);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.4; ctx.stroke(GEO.walls);
  ctx.strokeStyle = '#0c0c0c'; ctx.lineWidth = 1.0; ctx.setLineDash([0.75, 0.12]); ctx.stroke(GEO.walls);
  ctx.setLineDash([6, 6]); ctx.strokeStyle = '#1d4fd6'; ctx.lineWidth = 0.55; ctx.stroke(GEO.walls); ctx.lineDashOffset = 6; ctx.strokeStyle = '#f0f0f0'; ctx.stroke(GEO.walls); ctx.lineDashOffset = 0; ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(40,46,50,.7)'; ctx.lineWidth = 0.15; ctx.stroke(GEO.fence);
  ctx.strokeStyle = '#b9b9b4'; ctx.lineWidth = 0.7; ctx.stroke(GEO.pitWall);
  ctx.strokeStyle = 'rgba(30,30,30,.6)'; ctx.lineWidth = 0.12; ctx.stroke(GEO.pitWall);
  drawPitBoxes(vis, true);
  drawBuildings(vis, true);
  drawTrees(vis);
}
function renderTile(L, tx, ty) {
  const M = L.m, c = mkCanvas(TILE_PX, TILE_PX), g = c.getContext('2d', { alpha: false });
  const x0 = tx * M, y0 = ty * M, cx = x0 + M / 2, cy = y0 + M / 2;
  const vis = (x, y, rad) => Math.abs(x - cx) < M / 2 + rad + 2 && Math.abs(y - cy) < M / 2 + rad + 2;
  g.scale(TILE_PX / M, TILE_PX / M); g.translate(-x0, -y0);
  g.beginPath(); g.rect(x0, y0, M, M); g.clip();
  const prev = ctx; ctx = g;
  try { drawStatic(vis, x0 - 1, y0 - 1, M + 2, M + 2); } finally { ctx = prev; }
  return c;
}
function getTile(L, tx, ty, allowRender) {
  const key = tx * 100000 + ty; let t = L.map.get(key);
  if (!t) { if (!allowRender) return null; t = { c: renderTile(L, tx, ty), used: tileFrame }; L.map.set(key, t);
    if (L.map.size > L.cap) { let old = null, ok = 0; for (const [k, v] of L.map) if (!old || v.used < old.used) { old = v; ok = k; } L.map.delete(ok); } }
  t.used = tileFrame; return t.c;
}
function drawWorld() {
  tileFrame++;
  let sx = 0, sy = 0; if (HUD.shake > 0.01) { sx = (Math.random() - 0.5) * 8 * HUD.shake; sy = (Math.random() - 0.5) * 8 * HUD.shake; }
  try { for (const Ly of LAYERS) { ctx = Ly.g; drawWorldLayer(Ly, sx, sy); } } finally { ctx = mainCtx; }
  if (CAM.mode === 'behind') projectTilted();
}
// perspective: screen height u above the bottom edge <-> plane distance h, as seen from TILT.p*VH away at angle TILT.a
function projectTilted() {
  const P = TILT.p * VH, sa = Math.sin(TILT.a), ca = Math.cos(TILT.a);
  const hOf = u => u * P / (ca * P - u * sa), uTop = RH * ca * P / (P + RH * sa);
  const g = mainCtx; g.setTransform(ODPR, 0, 0, ODPR, 0, 0); g.imageSmoothingEnabled = true;
  const sky = g.createLinearGradient(0, 0, 0, VH - uTop + 2); sky.addColorStop(0, '#6fa3d2'); sky.addColorStop(1, '#c9d8de');
  g.fillStyle = sky; g.fillRect(0, 0, VW, VH - uTop + 2);
  const near = LAYERS[1], far = LAYERS[0], hN = near.h;
  // one strip per screen row: the horizontal scale changes from row to row, so taller strips drew straight lines
  // as small steps, worst where the near and far bands join (GDD 1.11.5)
  // the sharper near band fades into the far band over the last hB of the near band, so the picture does not
  // get blurrier in one step where they join (GDD 1.11.6)
  const hB = far.hB, hF = hN - hB;
  const row = (Ly, u0, u1, h0, h1, sc) => {
    const d = Ly.dpr, cw = Ly.c.width;
    const sy0 = Math.max(0, (RH - h1 - Ly.y0) * d), sh = Math.min(Ly.c.height, (RH - h0 - Ly.y0) * d) - sy0; if (sh <= 0) return;
    g.drawImage(Ly.c, 0, sy0, cw, sh, VW / 2 + (Ly.x0 - RW / 2) * sc, VH - u1, cw / d * sc, u1 - u0 + 0.5);
  };
  for (let u0 = 0; u0 < uTop; u0 += 1) {
    const u1 = Math.min(uTop, u0 + 1), h0 = hOf(u0), h1 = hOf(u1), hm = (h0 + h1) / 2, sc = P / (P + hm * sa);
    if (hm < hN) row(near, u0, u1, h0, h1, sc);
    if (hm > hF) { const a = hm >= hN ? 1 : (hm - hF) / hB; if (a < 1) g.globalAlpha = a; row(far, u0, u1, h0, h1, sc); g.globalAlpha = 1; }
  }
}
function drawWorldLayer(Ly, sx, sy) {
  const ppm = CAM.ppm;
  ctx.setTransform(Ly.dpr, 0, 0, Ly.dpr, 0, 0); ctx.translate(-Ly.x0, -Ly.y0);
  ctx.translate(RW * CAM.ax + sx, RH * CAM.ay + sy); ctx.rotate(CAM.rot); ctx.scale(ppm, ppm); ctx.translate(-CAM.x, -CAM.y);
  // world bounds of this layer's (rotated) rectangle
  let wx0 = Infinity, wy0 = Infinity, wx1 = -Infinity, wy1 = -Infinity;
  for (const [qx, qy] of [[Ly.x0, Ly.y0], [Ly.x0 + Ly.w, Ly.y0], [Ly.x0, Ly.y0 + Ly.h], [Ly.x0 + Ly.w, Ly.y0 + Ly.h]]) { const [x, y] = canvasToWorld(qx, qy); wx0 = Math.min(wx0, x); wy0 = Math.min(wy0, y); wx1 = Math.max(wx1, x); wy1 = Math.max(wy1, y); }
  wx0 -= 12; wy0 -= 12; wx1 += 12; wy1 += 12;
  const vis = (x, y, rad) => x > wx0 - rad && x < wx1 + rad && y > wy0 - rad && y < wy1 + rad;
  ctx.fillStyle = '#3d6e30'; ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  // tiles: draw visible ones, render missing ones nearest-first within a per-frame budget
  let lv = 0; while (lv < TLV.length - 1 && TILE_PX / TLV[lv + 1].m >= ppm * Ly.dpr * 0.8) lv++;
  const coarse = lv > 0, L = TLV[lv], TM = L.m;
  const t0x = Math.floor(wx0 / TM), t1x = Math.floor(wx1 / TM), t0y = Math.floor(wy0 / TM), t1y = Math.floor(wy1 / TM);
  const missing = [];
  ctx.imageSmoothingEnabled = true;
  for (let tx = t0x; tx <= t1x; tx++) for (let ty = t0y; ty <= t1y; ty++) {
    const c = getTile(L, tx, ty, false);
    if (c) ctx.drawImage(c, tx * TM, ty * TM, TM + 0.04, TM + 0.04);
    else missing.push([tx, ty, (tx + 0.5) * TM - CAM.x, (ty + 0.5) * TM - CAM.y]);
  }
  missing.sort((a, b) => a[2] * a[2] + a[3] * a[3] - b[2] * b[2] - b[3] * b[3]);
  let budget = L.map.size < 6 ? 40 : coarse ? 3 : 4;
  for (const m of missing) {
    if (budget-- > 0) { ctx.drawImage(getTile(L, m[0], m[1], true), m[0] * TM, m[1] * TM, TM + 0.04, TM + 0.04); continue; }
    if (!coarse) continue;
    // coarse tile not baked yet: show whatever finer tiles are already cached there
    const F = TLV[lv - 1], r = TM / F.m;
    for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) { const c = getTile(F, m[0] * r + i, m[1] * r + j, false); if (c) ctx.drawImage(c, (m[0] * r + i) * F.m, (m[1] * r + j) * F.m, F.m + 0.04, F.m + 0.04); }
  }
  // prefetch ahead of the rider along the track
  if (budget > 0 && W.player) { const b = W.player, k = (b.i + Math.round((wy1 - wy0 + wx1 - wx0) * 0.35 / T.DS)) % T.N; getTile(L, Math.floor(T.X[k] / TM), Math.floor(T.Y[k] / TM), true); }
  // tyre marks
  ctx.lineCap = 'round';
  const M = FX.marks; ctx.lineWidth = 0.2;
  for (const a of [0.28, 0.55]) {
    ctx.strokeStyle = `rgba(14,14,14,${a * 0.75})`; ctx.beginPath();
    for (let n = 0; n < FX.mn; n++) { const k = n * 6; if (M[k + 4] !== a) continue; if (!vis(M[k + 2], M[k + 3], 2)) continue; ctx.moveTo(M[k], M[k + 1]); ctx.lineTo(M[k + 2], M[k + 3]); }
    ctx.stroke();
  }
  if (W.guide && W.player && !W.player.crashed) {
    const b = W.player, N = T.N; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
    for (let o = 1; o < 170; o += 1) {
      const k = (b.i + o) % N, n = (k + 1) % N; const dv = T.VP[n] - T.VP[k];
      ctx.strokeStyle = dv < -0.02 ? 'rgba(235,50,40,.75)' : dv > 0.02 ? 'rgba(60,210,120,.7)' : 'rgba(255,214,40,.75)';
      ctx.globalAlpha = o > 130 ? (170 - o) / 40 : 1;
      ctx.beginPath(); ctx.moveTo(T.RX[k], T.RY[k]); ctx.lineTo(T.RX[n], T.RY[n]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.lineCap = 'butt';
  drawPitBoxes(vis, false);
  drawBuildings(vis, false);
  // bikes
  const list = W.bikes.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
  ctx.globalAlpha = 0.42; for (const g of W.ghosts) if (g.show) drawBike(g, vis); ctx.globalAlpha = 1;
  for (const b of list) if (!b.dnf || b.crash) drawBikeShadow(b, vis);
  for (const b of list) drawBike(b, vis);
  drawParticles(vis);
  ctx.setTransform(Ly.dpr, 0, 0, Ly.dpr, 0, 0);
  if (CAM.mode === 'behind' && Ly.y0 === 0) { // haze towards the horizon
    const fh = RH * 0.22, g = ctx.createLinearGradient(0, 0, 0, fh);
    g.addColorStop(0, 'rgba(201,216,222,1)'); g.addColorStop(1, 'rgba(201,216,222,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, Ly.w, fh);
  }
}
function drawTrackPaint(vis) {
  const P = T.pt;
  // start/finish chequered line across track and pit lane
  const i0 = 0; const n = 14;
  for (const [d0, d1] of [[-T.WL[i0], T.WR[i0]], [T.PIT.d - T.PIT.hw, T.PIT.d + T.PIT.hw]]) {
    const w = (d1 - d0) / n;
    for (let r = 0; r < 2; r++) for (let k = 0; k < n; k++) {
      ctx.fillStyle = (k + r) % 2 ? '#111' : '#f4f4f4';
      const a = P(i0, d0 + k * w), b = P(i0, d0 + (k + 1) * w); const tx = T.TX[i0] * 0.6 * r, ty = T.TY[i0] * 0.6 * r;
      ctx.beginPath(); ctx.moveTo(a[0] + tx, a[1] + ty); ctx.lineTo(b[0] + tx, b[1] + ty); ctx.lineTo(b[0] + tx + T.TX[i0] * 0.6, b[1] + ty + T.TY[i0] * 0.6); ctx.lineTo(a[0] + tx + T.TX[i0] * 0.6, a[1] + ty + T.TY[i0] * 0.6); ctx.fill();
    }
  }
  // pit limiter lines + text
  for (const [sr, label] of [[T.PIT.limIn, 'PIT 60'], [T.PIT.limOut, 'END']]) {
    const i = T.idx(sr); if (!vis(T.X[i], T.Y[i], 30)) continue;
    const a = P(i, T.PIT.d - T.PIT.hw), b = P(i, T.PIT.d + T.PIT.hw);
    ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    groundText(label, ...P(T.idx(sr - (label === 'END' ? -4 : 4)), T.PIT.d), T.H[i], 2.2, 'rgba(245,245,245,.9)');
  }
  // braking boards
  for (const bd of T.boards) {
    const i = bd.i; const e = bd.side > 0 ? T.WR[i] : T.WL[i]; const [x, y] = P(i, bd.side * (e + 3.2)); if (!vis(x, y, 5)) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(T.H[i] + Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-1.1 + 0.4, -0.55 + 0.5, 2.2, 1.1);
    ctx.fillStyle = '#f7f7f7'; ctx.fillRect(-1.1, -0.55, 2.2, 1.1); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.08; ctx.strokeRect(-1.1, -0.55, 2.2, 1.1);
    ctx.scale(0.05, 0.05); ctx.fillStyle = '#111'; ctx.font = '800 17px "Saira Condensed", Arial Narrow, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(bd.dist), 0, 1);
    ctx.restore();
  }
  // corner names painted on run-off
  for (const c of T.corners) {
    if (/Straight/.test(c.name)) continue; const i = c.i; const sg = T.KS[i] > 0 ? -1 : 1; const side = sg > 0 ? 0 : 1;
    const [x, y] = P(i, sg * (T.EDGE[side][i] + T.KERB[side][i] + Math.min(6, T.RUN[side][i] * 0.4 + 2))); if (!vis(x, y, 20)) continue;
    groundText(c.name.toUpperCase(), x, y, T.H[i], 2.6, 'rgba(255,255,255,.55)');
  }
}
function groundText(txt, x, y, ang, size, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); ctx.scale(size / 40, size / 40);
  ctx.fillStyle = col; ctx.font = 'italic 800 40px "Saira Condensed", Arial Narrow, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 0); ctx.restore();
}
function drawPitBoxes(vis, still) {
  const PIT = T.PIT, P = T.pt;
  for (let k = 0; k < GEO.boxes.length; k++) {
    const bx = GEO.boxes[k]; const i = bx.i; if (!vis(T.X[i], T.Y[i], 20)) continue;
    const ia = T.idx(bx.sr - PIT.boxGap / 2 + 0.6), ib = T.idx(bx.sr + PIT.boxGap / 2 - 0.6);
    const a = P(ia, PIT.boxD - 2.6), b = P(ib, PIT.boxD - 2.6), c = P(ib, PIT.garage - 0.2), d = P(ia, PIT.garage - 0.2);
    if (still) {
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.15; ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.25; const t1 = P(i, PIT.boxD - 1), t2 = P(i, PIT.boxD + 1); ctx.beginPath(); ctx.moveTo(...t1); ctx.lineTo(...t2); ctx.stroke();
      continue;
    }
    const owner = W.bikes.find(q => q.box === k); const team = owner ? owner.team : (k >> 1) % TEAMS.length;
    ctx.fillStyle = TEAMS[team].c1; ctx.globalAlpha = owner && owner.isPlayer ? 0.55 + 0.25 * Math.sin(performance.now() / 200) : 0.35;
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    if (owner) { const [x, y] = P(T.idx(bx.sr), PIT.boxD + 2.3); groundText('#' + owner.num, x, y, T.H[i], 1.4, 'rgba(255,255,255,.9)'); }
    // garage door in the owner's colours
    const ga = T.idx(bx.sr - PIT.boxGap / 2 + 1), gb = T.idx(bx.sr + PIT.boxGap / 2 - 1);
    polyFill([P(ga, PIT.garage), P(gb, PIT.garage), P(gb, PIT.garage + 2.2), P(ga, PIT.garage + 2.2)]); ctx.fillStyle = TEAMS[team].c1; ctx.fill();
  }
}
function polyFill(pts) { ctx.beginPath(); pts.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
function drawBuildings(vis, still) {
  if (!still) return;
  // garages + Wing roof
  const w = SCN.wing; const mid = w.garage[Math.floor(w.garage.length / 4)];
  if (vis(mid[0], mid[1], 500)) {
    ctx.save(); ctx.translate(2.5, 3.2); polyFill(w.roof); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill(); ctx.restore();
    polyFill(w.garage); ctx.fillStyle = '#3b4148'; ctx.fill();
    // garage doors in team colours
    const PIT = T.PIT;
    for (let k = 0; k < 22; k++) { const sr = PIT.boxS(k); const ia = T.idx(sr - PIT.boxGap / 2 + 1), ib = T.idx(sr + PIT.boxGap / 2 - 1); const tm = { c1: '#565d66' }; polyFill([T.pt(ia, PIT.garage), T.pt(ib, PIT.garage), T.pt(ib, PIT.garage + 2.2), T.pt(ia, PIT.garage + 2.2)]); ctx.fillStyle = tm.c1; ctx.fill(); }
    polyFill(w.roof); ctx.fillStyle = TEX.pRoof; ctx.fill(); ctx.strokeStyle = 'rgba(120,130,140,.9)'; ctx.lineWidth = 0.6; ctx.stroke();
    const ia = T.idx(T.PIT.flatIn), ib = T.idx(T.PIT.flatOut);
    ctx.strokeStyle = 'rgba(60,110,160,.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let k = ia, j = 0; k !== ib; k = (k + 1) % T.N, j++) { const p = T.pt(k, T.PIT.garage + 6); j ? ctx.lineTo(...p) : ctx.moveTo(...p); } ctx.stroke();
    // "SILVERSTONE" on roof
    const mi = T.idx((T.PIT.flatIn + T.PIT.flatOut) / 2); const [tx, ty] = T.pt(mi, T.PIT.garage + 20);
    groundText('SILVERSTONE', tx, ty, T.H[mi] - Math.PI / 2, 9, 'rgba(30,40,50,.45)');
  }
  for (const b of SCN.buildings) {
    if (!vis(b.x, b.y, 20)) continue;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(-b.w / 2 + 0.8, -b.h / 2 + 1, b.w, b.h);
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.fillStyle = b.col; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, 1.1); ctx.fillRect(-b.w / 2, b.h / 2 - 0.6, b.w, 0.6);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(-b.w / 2 + 2, -0.4, b.w - 4, 0.8);
    ctx.restore();
  }
  for (const s of SCN.stands) {
    if (!vis(s.x, s.y, s.w)) continue;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); if (s.flip < 0) ctx.scale(1, -1);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-s.w / 2 + 2, -s.h / 2 + 2.5, s.w, s.h);
    ctx.fillStyle = TEX.pConc; ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
    ctx.fillStyle = TEX.pCrowd; ctx.fillRect(-s.w / 2 + 1.2, -s.h / 2 + 1.0, s.w - 2.4, s.h - 5.2);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let y = -s.h / 2 + 1; y < s.h / 2 - 4; y += 1.4) ctx.fillRect(-s.w / 2 + 1.2, y, s.w - 2.4, 0.18);
    ctx.fillStyle = '#d7dbe0'; ctx.fillRect(-s.w / 2, s.h / 2 - 4, s.w, 4); ctx.fillStyle = '#1d4fd6'; ctx.fillRect(-s.w / 2, s.h / 2 - 4.2, s.w, 0.5);
    ctx.restore();
  }
}
function drawTrees(vis) {
  for (const t of SCN.trees) {
    if (!vis(t.x, t.y, 10)) continue;
    ctx.globalAlpha = 0.45; ctx.drawImage(TEX.shadow, t.x - t.r + t.r * 0.5, t.y - t.r + t.r * 0.65, t.r * 2.3, t.r * 2.3); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.rot); ctx.drawImage(TEX.trees[t.v], -t.r * 1.2, -t.r * 1.2, t.r * 2.4, t.r * 2.4); ctx.restore();
  }
}
function drawBikeShadow(b, vis) {
  const VS = PHYS.VS * CAM.boost;
  if (b.crashed && b.crash) { for (const o of [b.crash.bk, b.crash.rd]) { if (!vis(o.x, o.y, 4)) continue; ctx.save(); ctx.translate(o.x + 0.35, o.y + 0.45); ctx.rotate(o.rot); ctx.globalAlpha = 0.6; ctx.drawImage(TEX.shadow, -1.2 * VS, -0.55 * VS, 2.4 * VS, 1.1 * VS); ctx.restore(); } ctx.globalAlpha = 1; return; }
  if (b.dnf || !vis(b.x, b.y, 4)) return;
  const sl = Math.sin(b.lean);
  ctx.save(); ctx.translate(b.x + 0.45, b.y + 0.6); ctx.rotate(b.h); ctx.translate(0, sl * 0.55 * VS); ctx.globalAlpha = 0.7; ctx.drawImage(TEX.shadow, -1.25 * VS, -0.55 * VS, 2.5 * VS, 1.1 * VS); ctx.restore(); ctx.globalAlpha = 1;
}
function drawBike(b, vis) {
  const VS = PHYS.VS * CAM.boost; const sp = bikeSprite(b.team, b.num); const w = SPW / SPR, h = SPH / SPR;
  if (b.crashed && b.crash) {
    const C = b.crash;
    if (vis(C.bk.x, C.bk.y, 4)) { ctx.save(); ctx.translate(C.bk.x, C.bk.y); ctx.rotate(C.bk.rot); ctx.scale(VS, VS * 0.8); ctx.translate(0, C.bk.side * 0.2); ctx.drawImage(sp.c, -w / 2, -h / 2, w, h); ctx.restore(); }
    if (vis(C.rd.x, C.rd.y, 4)) { ctx.save(); ctx.translate(C.rd.x, C.rd.y); ctx.rotate(C.rd.rot); ctx.scale(VS, VS); ctx.drawImage(sp.r, -w / 2, -h / 2, w, h); ctx.restore(); }
    return;
  }
  if (b.dnf || !vis(b.x, b.y, 4)) return;
  const sl = Math.sin(b.lean), cl = Math.cos(b.lean);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.h); ctx.scale(VS, VS);
  if (b.wheelie > 0.05) ctx.scale(1 + b.wheelie * 0.04, 1);
  ctx.save(); ctx.translate(0, sl * 0.16); ctx.scale(1, 0.72 + 0.28 * cl); ctx.drawImage(sp.c, -w / 2, -h / 2, w, h); ctx.restore();
  // inside knee out when leaning
  if (Math.abs(b.lean) > 0.45) { const sg = Math.sign(b.lean); const TmC = TEAMS[b.team]; ctx.fillStyle = shade(TmC.c1, -0.35); ctx.beginPath(); ctx.ellipse(-0.08, sg * (0.36 + Math.abs(sl) * 0.12), 0.17, 0.075, sg * 0.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.arc(-0.02, sg * (0.42 + Math.abs(sl) * 0.13), 0.04, 0, TAU); ctx.fill(); }
  ctx.translate(0, sl * 0.5); ctx.drawImage(sp.r, -w / 2, -h / 2, w, h);
  ctx.restore();
  // brake light glow for nearby riders
  if (b.ctl.brk > 0.3 && b.v > 5) { ctx.save(); ctx.translate(b.x - Math.cos(b.h) * 1.3 * VS, b.y - Math.sin(b.h) * 1.3 * VS); ctx.fillStyle = 'rgba(255,40,30,.55)'; ctx.beginPath(); ctx.arc(0, 0, 0.18, 0, TAU); ctx.fill(); ctx.restore(); }
}
function drawParticles(vis) {
  for (const p of FX.parts) {
    if (!vis(p.x, p.y, 3)) continue; const f = 1 - p.age / p.life;
    if (p.t === 'spark') { ctx.strokeStyle = `rgba(255,${180 + (f * 60) | 0},80,${f})`; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); }
    else if (p.t === 'smoke') { ctx.fillStyle = `rgba(215,215,215,${p.a * f})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    else if (p.t === 'dust') { ctx.fillStyle = `rgba(200,180,140,${0.4 * f})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = `rgba(70,120,40,${0.6 * f})`; ctx.fillRect(p.x, p.y, 0.25, 0.25); }
  }
}
