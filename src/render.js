
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
const TILT = { a: 40 * DEG, p: 1.3, wk: 2.3, hk: 2.9, bike: 0.2, zMax: 20, zBase: 30, zK: 0.5, nearQ: 0.75, farQ: 0.45, fade: 0.3, minLen: 40, bv0: 260, bv1: 330, bs: 20, wd: 0.15, vib: 1.5, q: 1, rows: 1 }; // zK 1.0 and hk 2.6 before 1.24.0 (GDD 11h) // q: resolution scale, lowered on slow machines; rows: device rows per road strip in projectTilted, 2 on slow machines (GDD 11n)
// tilted camera tuning (GDD 11a): the pause-menu panel edits these in display units (deg, %), per camera (below)
const CAM_SET = [ // k: TILT field, f: display unit -> TILT value, rs: needs resize()
  { k: 'a', lbl: 'Tilt', unit: '°', min: 20, max: 70, step: 1, f: DEG, rs: 1 },
  { k: 'p', lbl: 'Camera distance', unit: '× screen h', min: 0.5, max: 2.5, step: 0.05, rs: 1 },
  { k: 'bike', lbl: 'Bike height on screen', unit: '%', min: 5, max: 40, step: 1, f: 0.01 },
  { k: 'zMax', lbl: 'Zoom maximum', unit: 'px/m', min: 10, max: 30, step: 1 },
  { k: 'zBase', lbl: 'Zoom base', unit: 'm', min: 10, max: 60, step: 1 },
  { k: 'zK', lbl: 'Zoom speed factor', unit: '', min: 0.1, max: 2, step: 0.05 },
  { k: 'wk', lbl: 'Ground width', unit: '× screen', min: 1.5, max: 3.5, step: 0.05, rs: 1 },
  { k: 'hk', lbl: 'Ground depth', unit: '× screen', min: 1.5, max: 6, step: 0.05, rs: 1 },
  { k: 'nearQ', lbl: 'Near band quality', unit: '', min: 0.4, max: 2, step: 0.05, rs: 1 },
  { k: 'farQ', lbl: 'Far band quality', unit: '', min: 0.25, max: 0.8, step: 0.05, rs: 1 },
  { k: 'fade', lbl: 'Fade zone', unit: '%', min: 0, max: 60, step: 1, f: 0.01, rs: 1 },
  { k: 'minLen', lbl: 'Minimum bike length', unit: 'px', min: 20, max: 80, step: 1 },
  { k: 'bv0', lbl: 'Blur start speed', unit: 'km/h', min: 150, max: 340, step: 5 }, // speed blur (GDD 11f)
  { k: 'bv1', lbl: 'Blur full speed', unit: 'km/h', min: 160, max: 345, step: 5 }, // always at least 10 above the start speed
  { k: 'bs', lbl: 'Blur strength', unit: 'px', min: 0, max: 40, step: 1 }, // 0 turns the blur off for this camera
  { k: 'wd', lbl: 'Widen at speed', unit: '%', min: 0, max: 30, step: 1, f: 0.01, rs: 1 }, // sense of speed (GDD 11h); the ground layers are sized for the widest view
  { k: 'vib', lbl: 'Vibration', unit: 'px', min: 0, max: 4, step: 0.5 },
];
const TILT_DEF = Object.freeze(Object.fromEntries(CAM_SET.map(d => [d.k, TILT[d.k]])));
const camGet = d => +(TILT[d.k] / (d.f || 1)).toFixed(4); // display value
// per-camera tuning (GDD 11a, since 1.14.0): Behind and CLOSE keep their own values in display units, saved in
// localStorage 'sgp_cam' (Behind) and 'sgp_cam_close' (CLOSE); TILT holds the values of the tilted camera in use
const CAM_DEF = {
  behind: Object.fromEntries(CAM_SET.map(d => [d.k, camGet(d)])),
  close: { a: 55, p: 1.8, bike: 8, zMax: 30, zBase: 12, zK: 0.3, wk: 3.5, hk: 6, nearQ: 1.5, farQ: 0.7, fade: 30, minLen: 40, bv0: 260, bv1: 330, bs: 24, wd: 15, vib: 1.5 }, // 1.13.1: less sky, sees further; 1.24.0: zK 0.4 -> 0.3
};
const CAM_KEY = { behind: 'sgp_cam', close: 'sgp_cam_close' };
const CAM_OLD = { behind: { zK: 1, hk: 2.6 }, close: { zK: 0.4 } }; // defaults before 1.24.0: saved values equal to these move to the new defaults (GDD 11h)
const CAM_VAL = { behind: Object.assign({}, CAM_DEF.behind), close: Object.assign({}, CAM_DEF.close) };
let TILT_CAM = 'behind'; // the tilted camera whose values are in TILT
function camSave(name) { try { localStorage.setItem(CAM_KEY[name], JSON.stringify(CAM_VAL[name])); } catch { /* storage blocked: the camera values are not saved */ } }
function camSet(d, v, save) { // clamps, applies to the tilted camera in use, saves; returns the display value
  v = +v; if (!isFinite(v)) v = CAM_DEF[TILT_CAM][d.k];
  v = clamp(v, d.min, d.max); const V = CAM_VAL[TILT_CAM]; V[d.k] = v; TILT[d.k] = v * (d.f || 1);
  if (d.k === 'bv0' && V.bv1 < v + 10) TILT.bv1 = V.bv1 = v + 10; // blur full speed stays at least 10 km/h above the start
  if (d.k === 'bv1' && V.bv0 > v - 10) TILT.bv0 = V.bv0 = v - 10;
  if (save) camSave(TILT_CAM);
  return v;
}
function camLoad(name) { TILT_CAM = name; for (const d of CAM_SET) camSet(d, CAM_VAL[name][d.k], false); } // the caller calls resize()
function camReset() { Object.assign(CAM_VAL[TILT_CAM], CAM_DEF[TILT_CAM]); camLoad(TILT_CAM); camSave(TILT_CAM); } // current camera only
for (const name in CAM_KEY) try {
  const s = JSON.parse(localStorage.getItem(CAM_KEY[name]) || 'null');
  if (!s || typeof s !== 'object') continue;
  // 1.13.x kept the Close profile in 'sgp_cam': unchanged Close values there mean the player picked Close, which is
  // now the CLOSE camera, so Behind starts from its defaults; any other saved values (also Custom) stay with Behind
  const close13 = Object.assign({}, CAM_DEF.close, CAM_OLD.close);
  const wasClose = name === 'behind' && s.profile === 'close' && CAM_SET.every(d => !(d.k in s) && /^(b[vs]|wd$|vib$)/.test(d.k) || Math.abs(+s[d.k] - close13[d.k]) < 1e-6); // 1.13.x had no blur or speed effect fields
  for (const k in CAM_OLD[name]) if (Math.abs(+s[k] - CAM_OLD[name][k]) < 1e-6) delete s[k];
  if (!wasClose) for (const d of CAM_SET) { const v = +s[d.k]; if (d.k in s && isFinite(v)) CAM_VAL[name][d.k] = clamp(v, d.min, d.max); }
  if ('profile' in s) camSave(name); // the profile field is no longer written
} catch { /* saved camera values unreadable or storage blocked: the defaults stay */ }
camLoad('behind');
const tiltP = () => TILT.p * VH * (1 - TILT.wd * CAM.w); // camera distance used for drawing, shorter at speed: wider view (GDD 11h)
const tiltA = () => CAM.w > 0 ? Math.atan(Math.tan(TILT.a) * (1 - TILT.wd * CAM.w)) : TILT.a; // tilt used for drawing: lowered with the distance, so the horizon (at distance x cot(tilt)) stays put
function tiltBikeH() { const P = tiltP(), ca = Math.cos(tiltA()), sa = Math.sin(tiltA()), s = Math.min(TILT.bike * VH, 0.8 * P * ca / sa); return s * P / (ca * P - s * sa); } // canvas px above the bottom edge that project to TILT.bike of the screen (kept below the horizon at P*cot(a), GDD 1.13.0)
function resize() {
  DPR = Math.min(DPR_CAP, window.devicePixelRatio || 1); VW = window.innerWidth; VH = window.innerHeight;
  hcv.width = Math.round(VW * DPR); hcv.height = Math.round(VH * DPR);
  const tilt = camTilted();
  ODPR = tilt ? clamp(TILT.nearQ * TILT.q, 1, Math.max(1, DPR)) : DPR; // tilted view is resampled anyway; near quality above 1 uses Retina pixels (GDD 1.13.0)
  cv.width = Math.round(VW * ODPR); cv.height = Math.round(VH * ODPR);
  RW = tilt ? Math.round(VW * TILT.wk) : VW; RH = tilt ? Math.round(VH * TILT.hk) : VH;
  const layer = (c, x0, y0, w, h, dpr) => { if (c !== cv) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); } return { c, g: c === cv ? mainCtx : c.getContext('2d', { alpha: false }), x0, y0, w, h, dpr }; };
  if (tilt) {
    const P = TILT.p * VH * (1 - TILT.wd), hN = Math.round(VH), wN = Math.min(RW, Math.ceil(VW * (P + hN * Math.sin(TILT.a)) / P) + 8);
    const hB = Math.round(hN * TILT.fade); // far band reaches this far into the near band, where the two cross-fade (GDD 1.11.6)
    LAYERS = [layer(farCv, 0, 0, RW, RH - hN + hB + 4, TILT.farQ * TILT.q), layer(nearCv, (RW - wN) / 2, RH - hN, wN, hN, TILT.nearQ * TILT.q)]; LAYERS[0].hB = hB;
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
// colour of one gravel stone from a random number in 0..1
function gravelStone(v) { if (v < 0.3) { return '#8f8a80'; } if (v < 0.6) { return '#e3d6b8'; } return v < 0.8 ? '#a8916a' : '#d8cdb6'; }
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
    for (let k = 0; k < 2600; k++) { const v = r(); g.fillStyle = gravelStone(v); g.beginPath(); g.ellipse(r() * S, r() * S, 0.6 + r() * 1.6, 0.6 + r() * 1.2, r() * 3, 0, TAU); g.fill(); }
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
    const p = new Path2D(); const sg = side ? -1 : 1;
    const on = k => pred(k);
    // find a start that is "off" to avoid wrap splits
    let start = 0; while (start < N && on(start)) start++;
    // next is where the scan goes on: the index after a skipped point, or after the run just drawn
    let next;
    for (let n = 0; n < N; n = next) {
      next = n + 1;
      const k = (start + n) % N; if (!on(k)) continue;
      const run = []; let m = n; while (m < N && on((start + m) % N)) { run.push((start + m) % N); m++; }
      next = m + 1;
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
  // sense of speed (GDD 11h): mowing stripes, 6 m bands from the track edge to the wall (on the inside of a tight
  // corner no deeper than 0.8 x its radius, so the bands do not cross), asphalt joints every 40 m, distance posts every 25 m on the straights
  const PIT = T.PIT, SB = Math.max(1, Math.round(6 / T.DS));
  GEO.mowL = new Path2D(); GEO.mowD = new Path2D(); GEO.joints = new Path2D(); GEO.posts = [];
  for (let s = 0; s < 2; s++) {
    const sg = s ? -1 : 1, E = T.EDGE[s], Wl = T.WALL[s];
    const d1 = k => { const ins = T.KS[k] > 0 ? 0 : 1, ak = Math.abs(T.KS[k]); return Math.max(E[k], s === ins && ak > 1e-4 ? Math.min(Wl[k], 0.8 / ak) : Wl[k]); };
    for (let i = 0; i < N; i += SB) {
      const pth = (i / SB) % 2 ? GEO.mowD : GEO.mowL, k = [];
      for (let j = 0; j <= SB; j++) k.push((i + j) % N);
      k.forEach((q, j) => { const [x, y] = P(q, sg * E[q]); j ? pth.lineTo(x, y) : pth.moveTo(x, y); });
      for (let j = k.length - 1; j >= 0; j--) { const [x, y] = P(k[j], sg * d1(k[j])); pth.lineTo(x, y); }
      pth.closePath();
    }
  }
  const JB = Math.round(40 / T.DS);
  for (let i = JB; i < N - JB / 2; i += JB) { const a = P(i, T.WR[i]), b = P(i, -T.WL[i]); GEO.joints.moveTo(a[0], a[1]); GEO.joints.lineTo(b[0], b[1]); }
  const PB = Math.round(25 / T.DS);
  for (let i = 0; i < N; i += PB) for (let s = 0; s < 2; s++) {
    let straight = true; for (let o = -6; o <= 6; o++) { const q = (i + o + N) % N; if (Math.abs(T.KS[q]) > 0.0028 || T.KERB[0][q] > 0 || T.KERB[1][q] > 0) straight = false; }
    if (!straight || (s === 0 && PIT.inZone(T.rel(i * T.DS)))) continue;
    const d = T.WALL[s][i] - 1, sd = s ? -d : d; if (T.surface(i, i * T.DS, sd) !== SURF.GRASS) continue;
    const [x, y] = P(i, sd); GEO.posts.push({ x, y, h: T.H[i] });
  }
  // walls: skip the garage frontage
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
  let first = true; idxs.forEach(k => { const sr = prs(k); if (sr < PIT.flatIn || sr > PIT.flatOut) { return; } const [x, y] = P(k, PIT.d + 1.3); first ? GEO.pitDash.moveTo(x, y) : GEO.pitDash.lineTo(x, y); first = false; });
  first = true; idxs.forEach(k => { const sr = prs(k); if (sr < PIT.flatIn - 6 || sr > PIT.flatOut + 6) { return; } const [x, y] = P(k, PIT.wallD); first ? GEO.pitWall.moveTo(x, y) : GEO.pitWall.lineTo(x, y); first = false; });
  // painted chevrons between track and pit ramps
  for (const [a0, a1] of [[PIT.sIn + 8, PIT.flatIn], [PIT.flatOut, PIT.sOut - 8]]) for (let sr = a0; sr < a1; sr += 5) {
    const k = T.idx(sr); const c = PIT.center(sr); if (c === null) { continue; } const inner = T.WR[k] + 0.2, outer = c - PIT.halfW(sr) - 0.2; if (outer - inner < 0.8) continue;
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
  T.near(x, y, 75, j => { if (!ok) { return; } const dx = x - T.X[j], dy = y - T.Y[j]; const d = dx * T.NX[j] + dy * T.NY[j]; const side = d >= 0 ? 0 : 1; const lim = T.WALL[side][j] + margin; if (Math.hypot(dx, dy) < lim) ok = false; });
  return ok;
}
function inPitCompound(x, y) {
  const i = T.nearestGlobal(x, y); const sr = T.rel(i * T.DS); const d = (x - T.X[i]) * T.NX[i] + (y - T.Y[i]) * T.NY[i];
  return sr > T.PIT.sIn - 60 && sr < T.PIT.sOut + 60 && d > 0 && d < 190;
}
function buildScenery() {
  const r = mulberry(99), PIT = T.PIT;
  // pit building (the Wing) + paddock
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
      if (!trackClear(x, y, rad + 4)) { continue; } if (inPitCompound(x, y)) continue;
      let hitS = false; for (const s of SCN.stands) { if (Math.hypot(s.x - x, s.y - y) < s.w / 2 + 10) hitS = true; } if (hitS) continue;
      SCN.trees.push({ x, y, r: rad, v: (r() * 5) | 0, rot: r() * TAU });
    }
  }
  // single trees along the boundary fences
  for (let k = 0; k < 500; k++) {
    const i = (r() * T.N) | 0, side = r() < 0.5 ? 0 : 1; const d = (side ? -1 : 1) * (T.WALL[side][i] + 10 + r() * 30); const [x, y] = T.pt(i, d); const rad = 2.5 + r() * 3.5;
    if (!trackClear(x, y, rad + 3) || inPitCompound(x, y)) { continue; } SCN.trees.push({ x, y, r: rad, v: (r() * 5) | 0, rot: r() * TAU });
  }
}

// --- bike sprites (bike pointing +x, SPR px per sprite unit): one drawing per camera (GDD 11i), the top view in
// Top-down and rear three-quarter views in Behind and CLOSE, from the team colours and the race number
const SPR = 128, SPW = Math.ceil(2.5 * SPR), SPH = Math.ceil(1.3 * SPR); // 128 px a unit (was 96): sharper at the zoomed-in cameras (GDD 11j)
// the body is 8 % shorter in its overhangs (GDD 11k): the drawing is scaled along the bike, the wheels stay where they are
const BIKE_SHORT = 0.92;
const BIKE_BODY_TOP = [0.98,0.0902,0.967,0.128,0.93,0.118,0.9047,0.1437,0.88,0.17,0.855,0.222,0.8294,0.2466,0.804,0.272,0.779,0.284,0.7541,0.2931,0.729,0.302,0.704,0.297,0.6788,0.2987,0.654,0.3,0.629,0.301,0.6035,0.3015,0.578,0.302,0.553,0.304,0.5282,0.3015,0.503,0.299,0.478,0.291,0.4529,0.2889,0.428,0.287,0.403,0.29,0.3776,0.2903,0.353,0.291,0.327,0.291,0.3024,0.2903,0.277,0.29,0.252,0.29,0.2271,0.2889,0.202,0.288,0.177,0.289,0.1518,0.2832,0.127,0.277,0.102,0.258,0.0765,0.2522,0.051,0.246,0.026,0.249,0.0012,0.248,-0.024,0.247,-0.049,0.251,-0.0741,0.248,-0.099,0.245,-0.124,0.229,-0.1494,0.2311,-0.175,0.233,-0.2,0.254,-0.2247,0.2593,-0.25,0.265,-0.275,0.262,-0.3,0.2635,-0.325,0.265,-0.35,0.266,-0.3753,0.2663,-0.4,0.267,-0.425,0.266,-0.4506,0.2663,-0.476,0.266,-0.501,0.266,-0.5259,0.2663,-0.551,0.266,-0.576,0.266,-0.6012,0.2663,-0.626,0.266,-0.651,0.28,-0.6765,0.2663,-0.702,0.252,-0.727,0.198,-0.7518,0.1832,-0.777,0.168,-0.802,0.188,-0.8271,0.1761,-0.852,0.165,-0.89,0.162,-0.9024,0.1141,-0.915,0.067,-0.915,-0.061,-0.9024,-0.1085,-0.89,-0.156,-0.852,-0.158,-0.8271,-0.1691,-0.802,-0.18,-0.777,-0.166,-0.7518,-0.1747,-0.727,-0.183,-0.702,-0.208,-0.6765,-0.2198,-0.651,-0.232,-0.626,-0.245,-0.6012,-0.248,-0.576,-0.251,-0.551,-0.237,-0.5259,-0.2381,-0.501,-0.239,-0.476,-0.252,-0.4506,-0.255,-0.425,-0.258,-0.4,-0.255,-0.3753,-0.255,-0.35,-0.255,-0.325,-0.258,-0.3,-0.2579,-0.275,-0.258,-0.25,-0.262,-0.2247,-0.2536,-0.2,-0.245,-0.175,-0.211,-0.1494,-0.2071,-0.124,-0.203,-0.099,-0.225,-0.0741,-0.2297,-0.049,-0.234,-0.024,-0.233,0.0012,-0.2353,0.026,-0.238,0.051,-0.238,0.0765,-0.2452,0.102,-0.252,0.127,-0.27,0.1518,-0.2762,0.177,-0.283,0.202,-0.282,0.2271,-0.2832,0.252,-0.285,0.277,-0.284,0.3024,-0.2846,0.327,-0.285,0.353,-0.285,0.3776,-0.2846,0.403,-0.284,0.428,-0.28,0.4529,-0.2818,0.478,-0.284,0.503,-0.295,0.5282,-0.2973,0.553,-0.3,0.578,-0.298,0.6035,-0.2973,0.629,-0.296,0.654,-0.294,0.6788,-0.2917,0.704,-0.29,0.729,-0.294,0.7541,-0.2846,0.779,-0.276,0.804,-0.263,0.8294,-0.2381,0.855,-0.213,0.88,-0.163,0.9047,-0.1367,0.93,-0.111,0.967,-0.12,0.98,-0.0817,0.993,-0.044,0.993,0.053,0.98,0.0902];
const SPRITES = {};
const BIKE_VIEW = { chase: 'top', behind: 'behind', close: 'close' }; // camera -> drawing
const BIKE_REAR = { top: 0, behind: 0.5, close: 1 }; // how far the drawing turns from the top view to the rear view
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } return `rgb(${r | 0},${g | 0},${b | 0})`; }
function spriteRect(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
// a gradient across the bike (y), dark at the sides and light in the middle: a rounded body or tyre
function acrossGrad(g, w, dark, light) {
  const gr = g.createLinearGradient(0, -w, 0, w); gr.addColorStop(0, dark); gr.addColorStop(0.5, light); gr.addColorStop(1, dark); return gr;
}
let BIKE_STYLE = 0; // 0: the current drawing; 1..5: the alternatives in BIKE_STYLES (preview, GDD 11i)
function bikeSprite(team, num, view = 'top') {
  const key = team + '_' + num + '_' + view + '_' + BIKE_STYLE; if (SPRITES[key]) return SPRITES[key];
  const Tm = TEAMS[team], k = BIKE_REAR[view] || 0;
  const mkc = () => { const c = mkCanvas(SPW, SPH), g = c.getContext('2d'); g.translate(SPW / 2, SPH / 2); g.scale(SPR, SPR); g.scale(BIKE_SHORT, 1); return [c, g]; };
  const [cc, g] = mkc(), [rc, h] = mkc();
  const st = BIKE_STYLES[BIKE_STYLE];
  if (k) {
    if (st && st.ref) { drawRefBike(g, Tm); tailNumber(g, num, -0.3); } else if (st && !st.art) drawRearStyled(g, Tm, num, k, st); else drawChassisRear(g, Tm, num, k);
    drawRiderRear(h, Tm, k);
  } else {
    if (st && !st.ref && !st.art) drawTopStyled(g, Tm, num, st); else drawChassisTop(g, Tm, num);
    drawRiderTop(h, Tm);
  }
  SPRITES[key] = { c: cc, r: rc };
  return SPRITES[key];
}
// --- bike motion (GDD 11j, 2026-11-16): the front wheel steers and both wheels move on the suspension. The top view's tyres
// are drawn each frame over the cached bike (not in the cache), so they can turn and move. Values are visual only: they
// come from the heading change, the brake and the throttle the game already has. Units: sprite units (1 unit = 1 m).
const BIKE_WHEELBASE = 1.45, STEER_MAX = 25 * Math.PI / 180; // real steering is small at speed, so it reads at low speed
const FORK_TRAVEL = 0.08, SQUAT_TRAVEL = 0.06; // 4 % and 3 % of the 2.04-unit bike length
function steerAngle(hRate, v) { return clamp(Math.atan2(BIKE_WHEELBASE * hRate, Math.max(v, 3)), -STEER_MAX, STEER_MAX); }
function suspensionTargets(brk, thr) {
  const bk = clamp(brk, 0, 1), tuck = clamp((thr - 0.7) / 0.3, 0, 1) * (1 - bk);
  return { fork: FORK_TRAVEL * bk, squat: SQUAT_TRAVEL * tuck };
}
function smoothToward(cur, target, dt, tau) { return cur + (target - cur) * (1 - Math.exp(-dt / tau)); }
// the steering and suspension state of one bike, moved on each drawing by the real time since the last one (at most 0.1 s)
function updateBikeMotion(b, now) {
  if (b.motT === undefined) { b.motT = now; b.motH = b.h; b.steer = 0; b.fork = 0; b.squat = 0; return; }
  const dt = clamp((now - b.motT) / 1000, 0, 0.1);
  b.motT = now;
  if (dt <= 0) return;
  const dh = Math.atan2(Math.sin(b.h - b.motH), Math.cos(b.h - b.motH)); // the heading change, wrapped to (-pi, pi]
  b.motH = b.h;
  const rate = Math.abs(dh) > 0.5 ? 0 : dh / dt; // a jump (respawn, restart) is not a turn
  const sus = suspensionTargets(b.ctl.brk, b.ctl.thr);
  b.steer = smoothToward(b.steer, steerAngle(rate, b.v), dt, 0.08);
  b.fork = smoothToward(b.fork, sus.fork, dt, 0.15);
  b.squat = smoothToward(b.squat, sus.squat, dt, 0.2);
}
// the top view's tyres in sprite units: the rear one moves forward with the squat; the front one moves back with the fork
// compression and turns by the steering about its centre
function tyreTop(g, w, hw) {
  g.fillStyle = acrossGrad(g, hw, '#0c0c0c', '#2e3236'); spriteRect(g, -w / 2, -hw, w, 2 * hw, hw * 0.75); g.fill();
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-w / 2 + 0.04, -hw * 0.25, w - 0.08, hw * 0.5); // light tread down the middle
  g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 0.008; g.beginPath(); g.moveTo(-w / 2 + 0.06, -hw * 0.8); g.lineTo(w / 2 - 0.06, -hw * 0.8); g.stroke(); // sidewall edge catching the light (GDD 11k)
}
function drawTyresTop(g, steer, fork, squat) {
  g.save(); g.translate(-0.71 + squat, 0); tyreTop(g, 0.42, 0.105); g.restore(); // 0.42 long, was 0.62 (GDD 11k)
  g.save(); g.translate(0.73 - fork, 0); g.rotate(steer); tyreTop(g, 0.42, 0.068); g.restore();
}
// the tyres are drawn each frame in the top view for the default drawing and the reference and art styles; the styled
// presets keep their own tyres in the cache
function topTyresLive(view) { const st = BIKE_STYLES[BIKE_STYLE]; return view === 'top' && !(st && !st.ref && !st.art); }
function drawChassisTop(g, Tm, num) {
  // frame, the tyres come from drawTyresTop each frame (GDD 11j)
  g.fillStyle = '#30353a'; spriteRect(g, -0.78, -0.13, 0.5, 0.26, 0.05); g.fill();
  // brake discs
  g.fillStyle = '#7d7f82'; g.fillRect(0.6, -0.1, 0.26, 0.03); g.fillRect(0.6, 0.07, 0.26, 0.03);
  // the outline traced from the reference picture (GDD 11k): start point, then cubic segments of six numbers each
  const body = new Path2D(), B = BIKE_BODY_TOP;
  body.moveTo(B[0], B[1]); for (let i = 2; i < B.length; i += 6) body.bezierCurveTo(B[i], B[i + 1], B[i + 2], B[i + 3], B[i + 4], B[i + 5]);
  body.closePath();
  const gr = g.createLinearGradient(0, -0.32, 0, 0.32); gr.addColorStop(0, shade(Tm.c1, -0.45)); gr.addColorStop(0.35, shade(Tm.c1, 0.12)); gr.addColorStop(0.5, shade(Tm.c1, 0.28)); gr.addColorStop(0.65, shade(Tm.c1, 0.05)); gr.addColorStop(1, shade(Tm.c1, -0.5));
  g.fillStyle = gr; g.fill(body);
  g.save(); g.clip(body); g.fillStyle = Tm.c2; g.fillRect(-1, -0.055, 2, 0.11); g.fillStyle = shade(Tm.c2, -0.2); g.fillRect(0.05, -0.31, 0.2, 0.62);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-1, -0.2, 2, 0.06); // shine along the fairing
  // the shade band down the far flank, and a thin specular line on the lit flank (GDD 11k: light from the bike's left side)
  g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(-1, 0.19, 2, 0.12); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(-1, -0.25, 2, 0.02);
  g.restore();
  g.lineWidth = 0.012; g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(body);
  // winglets
  g.fillStyle = '#16181a'; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(0.66, sg * 0.27); g.lineTo(0.5, sg * 0.4); g.lineTo(0.43, sg * 0.4); g.lineTo(0.5, sg * 0.28); g.closePath(); g.fill(); }
  // windscreen
  g.fillStyle = 'rgba(25,35,48,.82)'; g.beginPath(); g.ellipse(0.66, 0, 0.17, 0.13, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(0.7, -0.04, 0.08, 0.035, 0, 0, TAU); g.fill();
  // seam where the tank meets the seat, at one device pixel (GDD 11k)
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.01; g.beginPath(); g.moveTo(-0.25, -0.2); g.lineTo(-0.25, 0.2); g.stroke();
  // seat + tail number + exhaust tips
  g.fillStyle = '#1b1d20'; spriteRect(g, -0.56, -0.13, 0.32, 0.26, 0.06); g.fill();
  tailNumber(g, num, -0.74);
  g.fillStyle = '#b8bcc0'; g.beginPath(); g.arc(-0.95, 0.06, 0.035, 0, TAU); g.arc(-0.95, -0.06, 0.035, 0, TAU); g.fill();
}
// --- reference bike (GDD 11i, Petr 2026-10-31: "prepare new version of a bike with reference picture"): the rear
// three-quarter reference, sampled on a 64 x 64 grid (rows = picture rows, top = the bars). Each row is runs of a colour
// class and a run length in base 36: r = red (team c1), w = white (team c2), k = black, g = grey, . = background.
const BIKE_REF = [
  '.rga.r',
  '.ogg.o',
  '.mk2ghk1.m',
  '.jkqr1.i',
  '.fr1g2kag8kag1r2.f',
  '.dr1g1kdg8kdr2.d',
  '.cr2k7g1k1g1k1g1kcg1k1g1k1g1k7r2.c',
  '.bkag5k1g3k5g2k1g5k7g1k2.b',
  '.8k4g4kbwakcg1k1g1k4.8',
  '.1klr1w3r3k6r3w3r1kl.1',
  '.3k7.1k1r1k6r4w1rgw1r4k6r1k1.2k6.3',
  'k1g1k3.6r3k2r6w1riw1r6k2r3.6k3g1k1',
  '.ar6k2r4w1riw1r4k2r6.a',
  '.9r5k7w2riw2k7r5.9',
  '.8r5k2r1k6w1riw1k6r1k2r5.8',
  '.7k1w1r4k1w1r2k5w2rgw2k5r2w1k1r4w1k1.7',
  '.7k2w2r1k2w2r3k4w1rgw1k4r3w2k2r1w2k2.7',
  '.7k2w2r1k3w1r4k4w1rew1k4r4w1k3r1w2k2.7',
  '.7k2w3k3w2r4k3w2rcw2k3r4w2k3w3k2.7',
  '.7k2w3k4w1r5k3w1rcw1k3r4w2k4w3k2.7',
  '.7k2w3k4w2r5k3w1raw1k3r5w2k4w3k2.7',
  '.8k2w3k4w2r5k2w1raw1k2r5w2k4w3k2.8',
  '.8k2w4k3w3r4kgr4w3k3w4k2.8',
  '.8k2w4k4w2r3kir3w2k3w5k2.8',
  '.9g1k1w4k3w3r2kir2w2g1k3w4k1g1.9',
  '.9k2w4k3w4kkw3g1k2w5k2.9',
  '.ak2w4k2w2kog2k2w4k2.a',
  '.ak4w2kww2k4.a',
  '.akfrekf.a',
  '.ak2g1k8r2w1rfw2r1kb.b',
  '.bk3w3r4k1r2w1rew1r2k1r4w3k3.b',
  '.cr3w2r4k2r1w1rdw2r1k2r4w2r3.c',
  '.ck1r4w1r3k3r1w1rcw1r1k3r3w1r4k1.c',
  '.ck3r6k4w1rbw2k3r6k4.c',
  '.ck6g1r3k4w1raw1k4r3g1k5.d',
  '.cg1k7g1r2k4r9w1k4r2k8g1.c',
  '.ek1g1k3g1k3r2ker2k3g1k1g1k3.e',
  '.fg4k6r1kcr1k5g5.f',
  '.fg3k9rak8g4.f',
  '.7g8k1g2krg3k1g7k1.7',
  '.fkvg2k1.f',
  '.gkug1k3g2.c',
  '.gkxg4k2.9',
  '.gksg1k4g1w4g2.8',
  '.fktg1k3g2k4g2.8',
  '.fk3g1ktg2k5g1.8',
  '.fk2g2ktg7.9',
  '.fk3g1ks.1k2g2k1.b',
  '.fk2w1g1ks.h',
  '.eg1k1g3krg1.h',
  '.gk1g2kr.i',
  '.hk1g1kq.j',
  '.ig1km.n',
  '.ikn.n',
  '.jk2.1kj.n',
  '.mkj.n',
  '.mkj.n',
  '.mkj.n',
  '.mkj.n',
  '.mkj.n',
  '.mkj.n',
  '.nki.n',
  '.okf.p',
  '.rka.r'
];
const BIKE_REF_SIZE = [913, 2297]; // width and height of the reference in its own pixels, the bike's bounding box
function drawRefBike(g, Tm, rows = BIKE_REF, size = BIKE_REF_SIZE) {
  const N = rows.length, s = 2.04 / size[1], cw = size[0] / N, rh = size[1] / N;
  const col = { r: Tm.c1, w: Tm.c2, k: '#17191b', g: '#6e757c' };
  for (let j = 0; j < N; j++) {
    const x0 = 1.02 - j * rh * s, x1 = 1.02 - (j + 1) * rh * s; let i = 0;
    for (let p = 0; p < rows[j].length; p += 2) {
      const c = rows[j][p], n = parseInt(rows[j][p + 1], 36);
      if (c !== '.') { g.fillStyle = col[c]; g.fillRect(Math.min(x0, x1) - 0.004, (i * cw - size[0] / 2) * s, Math.abs(x1 - x0) + 0.008, n * cw * s + 0.004); }
      i += n;
    }
  }
}
// --- rider rig (GDD 11i, 2026-11-02): the parts of rig_art.js move from the approved formula. A part moves across the bike
// by its weight times the shoulder shift for the lean (70 px at 46 deg, as the approved offset). The thighs stretch from the
// hip (weight 0.4) to the knee (0.1), the shins from the knee (0.1) to the ankle (0), so the legs stay attached to the torso
// and the boots stay on the pegs.
const RIG_LEAN_SCALE = 1.5; // 1.5 x the approved offset: the lean reads better at game scale (Petr 2026-11-02)
const RIG_SHIFT_PER_DEG = RIG_LEAN_SCALE * (70 / (0.5 * 46)) * (2.04 / 1828) * 100; // sprite units x100 per degree of lean
const RIG_WEIGHT = { helmet: 0.4, torso: 0.4, boot: 0 };
function rigWeight(name, u, v) {
  if (name.startsWith('thigh_')) return rigSegWeight(u, v, RIG_JOINTS['hip_' + name.slice(-1)], RIG_JOINTS['knee_' + name.slice(-1)], 0.4, 0.1);
  if (name.startsWith('shin_')) return rigSegWeight(u, v, RIG_JOINTS['knee_' + name.slice(-1)], RIG_JOINTS['ankle_' + name.slice(-1)], 0.1, 0);
  // the arms: the upper arm from the shoulder (0.5) to the elbow (0.25), the forearm from the elbow to the wrist (0), so the
  // hands stay on the handlebars; the gloves sit at the wrist and do not move
  if (name.startsWith('upper_arm_')) return rigSegWeight(u, v, RIG_JOINTS['shoulder_' + name.slice(-1)], RIG_JOINTS['elbow_' + name.slice(-1)], 0.5, 0.25);
  if (name.startsWith('forearm_')) return rigSegWeight(u, v, RIG_JOINTS['elbow_' + name.slice(-1)], RIG_JOINTS['wrist_' + name.slice(-1)], 0.25, 0);
  for (const k in RIG_WEIGHT) if (name.startsWith(k)) return RIG_WEIGHT[k];
  return 0;
}
// the weight at a point, along the segment a-b from wa at a to wb at b (the point is projected onto the segment)
function rigSegWeight(u, v, a, b, wa, wb) {
  const du = b[0] - a[0], dv = b[1] - a[1], l2 = du * du + dv * dv || 1;
  const t = clamp(((u - a[0]) * du + (v - a[1]) * dv) / l2, 0, 1);
  return wa + (wb - wa) * t;
}
function drawRigRider(g, Tm, lean) {
  // the size of the lean only: the bike's flip for left bends sets the direction (GDD 11i)
  const L = Math.abs(lean);
  const col = { r: Tm.c1, w: Tm.c2, k: '#17191b' };
  for (const name in RIG_ART) {
    const part = RIG_ART[name], p = part.p;
    g.fillStyle = col[part.c]; g.beginPath();
    for (let i = 0; i < p.length; i += 2) {
      const u = p[i], v = p[i + 1], dv = rigWeight(name, u, v) * RIG_SHIFT_PER_DEG * L / DEG;
      if (i === 0) g.moveTo(u / 100, (v + dv) / 100); else g.lineTo(u / 100, (v + dv) / 100);
    }
    g.closePath(); g.fill();
  }
}
// --- traced bike and rider (GDD 11i): the bike and a rider morph from bike_art.js. The rider's place on the morph path
// (97 frames: 0 accelerating, 32 upright, 64 corner, 96 limit, the frames between are blended shapes) follows the riding
// state: lean from 0 to 40 deg moves upright to corner, from 40 deg to 60 deg moves corner to limit, and with no
// lean, throttle moves upright to accelerating. Braking keeps the upright rider.
const ART_UPRIGHT = 32, ART_CORNER = 64, ART_LIMIT = 96, ART_CORNER_LEAN = 40 * DEG;
function riderFrameIndex(b) {
  const L = Math.abs(b.lean);
  if (L > 0.02) {
    if (L <= ART_CORNER_LEAN) return ART_UPRIGHT + (L / ART_CORNER_LEAN) * (ART_CORNER - ART_UPRIGHT);
    return ART_CORNER + clamp((L - ART_CORNER_LEAN) / (60 * DEG - ART_CORNER_LEAN), 0, 1) * (ART_LIMIT - ART_CORNER);
  }
  return ART_UPRIGHT; // braking and accelerating both use the upright picture (Petr 2026-11-01: the accelerating pose did not look right)
}
function drawArtParts(g, Tm, parts) {
  // one path per colour, filled even-odd, so the shapes of a colour cut each other's holes
  const col = { b: '#202428', k: '#17191b', g: '#6e757c', r: Tm.c1, w: Tm.c2 }; // b: the dark base under the rider (GDD 11i)
  for (const c of ['b', 'k', 'g', 'r', 'w']) {
    const mine = parts.filter(p => p[0] === c); if (!mine.length) continue;
    g.fillStyle = col[c]; g.beginPath();
    for (const [, v] of mine) {
      g.moveTo(v[0] / 100, v[1] / 100);
      for (let i = 2; i < v.length; i += 2) g.lineTo(v[i] / 100, v[i + 1] / 100);
      g.closePath();
    }
    g.fill('evenodd');
  }
}
function artSprite(team, key, parts) {
  const k = 'art_' + team + '_' + key; if (SPRITES[k]) return SPRITES[k];
  const c = mkCanvas(SPW, SPH), g = c.getContext('2d'); g.translate(SPW / 2, SPH / 2); g.scale(SPR, SPR);
  drawArtParts(g, TEAMS[team], parts);
  SPRITES[k] = { c, r: null };
  return SPRITES[k];
}
// --- alternative bike drawings (preview, GDD 11i). Five racing styles that differ in fairing, livery, air intakes,
// mirrors, exhaust, wheels and lights. The rider is the same in all of them.
const BIKE_STYLES = [null,
  { name: 'Race', stripes: 2, intakes: false, winglets: true, mirrors: false, exh: 0.035, spokes: false, headlight: false, sponsor: true, carbon: false, round: false },
  { name: 'Ducted', stripes: 1, intakes: true, winglets: true, mirrors: false, exh: 0.04, spokes: false, headlight: true, sponsor: true, carbon: false, round: false },
  { name: 'Bold', stripes: 3, intakes: false, winglets: false, mirrors: true, exh: 0.035, spokes: true, headlight: true, sponsor: false, carbon: false, round: false },
  { name: 'Carbon', stripes: 0, intakes: true, winglets: true, mirrors: false, exh: 0.05, spokes: false, headlight: false, sponsor: false, carbon: true, round: false },
  { name: 'Classic', stripes: 2, intakes: false, winglets: false, mirrors: true, exh: 0.045, spokes: true, headlight: true, sponsor: true, carbon: false, round: true },
  { name: 'Rig', art: true, rig: true, stripes: 0, intakes: false, winglets: false, mirrors: false, exh: 0, spokes: false, headlight: false, sponsor: false, carbon: false, round: false },
  { name: 'Traced', art: true, stripes: 0, intakes: false, winglets: false, mirrors: false, exh: 0, spokes: false, headlight: false, sponsor: false, carbon: false, round: false },
  { name: 'Reference', ref: true, stripes: 0, intakes: false, winglets: false, mirrors: false, exh: 0, spokes: false, headlight: false, sponsor: false, carbon: false, round: false }];
// shared pieces of the alternatives
function styleTyre(g, x0, x1, hw, st) {
  g.fillStyle = acrossGrad(g, hw, '#0a0a0a', '#383c40'); spriteRect(g, x0, -hw, x1 - x0, 2 * hw, hw * 0.8); g.fill();
  if (st.spokes) { g.strokeStyle = 'rgba(200,205,210,.6)'; g.lineWidth = 0.014; g.beginPath(); g.ellipse((x0 + x1) / 2, 0, (x1 - x0) * 0.3, hw * 0.55, 0, 0, TAU); g.stroke(); } // rim
}
function styleExhaust(g, st, x, y) {
  const r = st.exh, grad = g.createLinearGradient(0, y - r, 0, y + r); grad.addColorStop(0, '#f2f4f5'); grad.addColorStop(0.5, '#8d949a'); grad.addColorStop(1, '#3d4246');
  g.fillStyle = grad; spriteRect(g, x, y - r, 0.3, 2 * r, r); g.fill();
  g.fillStyle = '#16181a'; g.beginPath(); g.ellipse(x + 0.3, y, r * 0.5, r, 0, 0, TAU); g.fill();
}
function styleLivery(g, Tm, st, cut) {
  // stripes run along the fairing, in the second colour, with pinstripes on the sides
  if (st.stripes >= 1) { g.fillStyle = Tm.c2; g.fillRect(cut[0], -0.05, cut[1], 0.1); }
  if (st.stripes === 2) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(cut[0], -0.085, cut[1], 0.015); g.fillRect(cut[0], 0.07, cut[1], 0.015); }
  if (st.stripes === 3) { g.fillStyle = Tm.c2; g.fillRect(cut[0], -0.2, cut[1], 0.04); g.fillRect(cut[0], 0.16, cut[1], 0.04); }
}
function styleMirrors(g, x, y) {
  g.strokeStyle = '#2a2d31'; g.lineWidth = 0.02; g.beginPath(); g.moveTo(x, 0.1 * Math.sign(y)); g.lineTo(x - 0.12, y); g.stroke();
  g.fillStyle = '#16181a'; g.beginPath(); g.ellipse(x - 0.14, y, 0.05, 0.03, 0.4 * Math.sign(y), 0, TAU); g.fill();
}
// top view, bike pointing +x
function drawTopStyled(g, Tm, num, st) {
  const carb = st.carbon;
  styleTyre(g, -1.02, -0.4, 0.105, st); styleTyre(g, 0.44, 1.02, 0.068, st);
  g.fillStyle = carb ? '#0c0d0e' : '#2a2e33'; spriteRect(g, -0.9, -0.05, 0.9, 0.1, 0.04); g.fill(); // swingarm
  styleExhaust(g, st, -0.95, 0.13);
  if (st.mirrors) { styleMirrors(g, 0.3, 0.36); styleMirrors(g, 0.3, -0.36); }
  const b = new Path2D(); // fairing outline
  if (st.round) { b.moveTo(1.0, 0); b.bezierCurveTo(0.96, 0.2, 0.7, 0.3, 0.4, 0.33); b.lineTo(-0.25, 0.27); b.bezierCurveTo(-0.7, 0.22, -0.9, 0.12, -0.96, 0); b.bezierCurveTo(-0.9, -0.12, -0.7, -0.22, -0.25, -0.27); b.lineTo(0.4, -0.33); b.bezierCurveTo(0.7, -0.3, 0.96, -0.2, 1.0, 0); }
  else { b.moveTo(1.02, 0); b.bezierCurveTo(0.98, 0.1, 0.8, 0.2, 0.5, 0.29); b.lineTo(0.2, 0.31); b.bezierCurveTo(0.0, 0.3, -0.1, 0.28, -0.3, 0.2); b.lineTo(-0.7, 0.14); b.bezierCurveTo(-0.9, 0.1, -0.98, 0.05, -0.98, 0); b.bezierCurveTo(-0.98, -0.05, -0.9, -0.1, -0.7, -0.14); b.lineTo(-0.3, -0.2); b.bezierCurveTo(-0.1, -0.28, 0.0, -0.3, 0.2, -0.31); b.lineTo(0.5, -0.29); b.bezierCurveTo(0.8, -0.2, 0.98, -0.1, 1.02, 0); }
  b.closePath();
  if (carb) { g.fillStyle = '#17191b'; } else { g.fillStyle = acrossGrad(g, 0.32, shade(Tm.c1, -0.5), shade(Tm.c1, 0.25)); }
  g.fill(b);
  g.save(); g.clip(b);
  styleLivery(g, Tm, st, [-1, 2]);
  if (carb) { g.fillStyle = Tm.c1; g.fillRect(0.0, -0.31, 0.7, 0.03); g.fillRect(0.0, 0.28, 0.7, 0.03); } // team accent edges on carbon
  if (st.intakes) { g.fillStyle = '#050505'; for (const sg of [-1, 1]) { spriteRect(g, 0.2, sg * 0.18 - 0.05, 0.3, 0.1, 0.04); g.fill(); } }
  if (st.sponsor) { g.fillStyle = Tm.c2; g.fillRect(-0.2, 0.22, 0.35, 0.05); g.fillRect(-0.2, -0.27, 0.35, 0.05); }
  g.restore();
  g.lineWidth = 0.012; g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke(b);
  if (st.winglets) { g.fillStyle = '#16181a'; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(0.66, sg * 0.27); g.lineTo(0.5, sg * 0.4); g.lineTo(0.43, sg * 0.4); g.lineTo(0.5, sg * 0.28); g.closePath(); g.fill(); } }
  if (st.headlight) { g.fillStyle = 'rgba(255,250,220,.95)'; g.beginPath(); g.ellipse(0.98, 0, 0.05, 0.1, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(25,35,48,.82)'; g.beginPath(); g.ellipse(0.66, 0, 0.17, 0.13, 0, 0, TAU); g.fill(); // windscreen
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(0.7, -0.04, 0.08, 0.035, 0, 0, TAU); g.fill(); // glint
  g.fillStyle = '#1b1d20'; spriteRect(g, -0.56, -0.13, 0.32, 0.26, 0.06); g.fill(); // seat
  tailNumber(g, num, -0.74);
  g.fillStyle = '#b8bcc0'; g.beginPath(); g.arc(-0.95, 0.06, 0.035, 0, TAU); g.arc(-0.95, -0.06, 0.035, 0, TAU); g.fill(); // tail lights
  g.fillStyle = '#c0191a'; g.beginPath(); g.arc(-0.96, 0, 0.03, 0, TAU); g.fill();
}
// rear three-quarter view (k 0.5 Behind, 1 CLOSE), same geometry as drawChassisRear
function drawRearStyled(g, Tm, num, k, st) {
  const tl = 0.36 + 0.22 * k, tw = 0.11 + 0.025 * k, nose = 0.98 - 0.3 * k, sh = nose - 0.45, carb = st.carbon;
  styleTyre(g, -1.1, -1.1 + tl, tw, st);
  g.fillStyle = '#16181a'; spriteRect(g, nose - 0.08, -0.06, 0.2, 0.12, 0.05); g.fill(); // front tyre under the nose
  styleExhaust(g, st, -0.99, 0.2);
  if (st.mirrors) { g.strokeStyle = '#2a2d31'; g.lineWidth = 0.02; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(sh - 0.05, sg * 0.2); g.lineTo(sh + 0.1, sg * 0.42); g.stroke(); g.fillStyle = '#16181a'; g.beginPath(); g.ellipse(sh + 0.12, sg * 0.43, 0.05, 0.03, 0, 0, TAU); g.fill(); } }
  const body = new Path2D();
  body.moveTo(nose, 0); body.bezierCurveTo(nose - 0.02, 0.14, sh + 0.12, 0.27, sh, 0.31); body.bezierCurveTo(sh - 0.3, 0.31, -0.2, 0.26, -0.42, 0.19);
  body.bezierCurveTo(-0.7, 0.15, -0.86, 0.12, -0.9, 0); body.bezierCurveTo(-0.86, -0.12, -0.7, -0.15, -0.42, -0.19);
  body.bezierCurveTo(-0.2, -0.26, sh - 0.3, -0.31, sh, -0.31); body.bezierCurveTo(sh + 0.12, -0.27, nose - 0.02, -0.14, nose, 0); body.closePath();
  g.fillStyle = carb ? '#17191b' : acrossGrad(g, 0.32, shade(Tm.c1, -0.5), shade(Tm.c1, 0.25)); g.fill(body);
  g.save(); g.clip(body); styleLivery(g, Tm, st, [-1, 2]);
  if (st.intakes) { g.fillStyle = '#050505'; for (const sg of [-1, 1]) { spriteRect(g, sh - 0.2, sg * 0.2 - 0.04, 0.3, 0.08, 0.03); g.fill(); } }
  if (carb) { g.fillStyle = Tm.c1; g.fillRect(-1, -0.2, 2, 0.03); }
  g.restore();
  g.lineWidth = 0.012; g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(body);
  if (st.winglets) { g.fillStyle = '#16181a'; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(sh + 0.1, sg * 0.28); g.lineTo(sh - 0.04, sg * 0.4); g.lineTo(sh - 0.11, sg * 0.4); g.lineTo(sh - 0.04, sg * 0.29); g.closePath(); g.fill(); } }
  if (st.headlight) { g.fillStyle = 'rgba(255,250,220,.9)'; g.beginPath(); g.ellipse(nose - 0.02, 0, 0.04, 0.06, 0, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(25,35,48,.82)'; g.beginPath(); g.ellipse(nose - 0.2, 0, 0.12, 0.11, 0, 0, TAU); g.fill();
  g.fillStyle = '#1b1d20'; spriteRect(g, -0.62, -0.12, 0.26, 0.24, 0.06); g.fill();
  tailNumber(g, num, -0.73);
  g.fillStyle = carb ? '#2a0606' : shade(Tm.c1, -0.55); spriteRect(g, -0.97, -0.09, 0.09, 0.18, 0.04); g.fill();
  g.fillStyle = '#c0191a'; spriteRect(g, -0.955, -0.065, 0.035, 0.13, 0.015); g.fill();
}
function tailNumber(g, num, x) {
  g.save(); g.translate(x, 0); g.rotate(Math.PI / 2); g.fillStyle = '#fff'; g.font = '800 0.2px "Saira Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 0.03; g.strokeStyle = '#000'; g.strokeText(String(num), 0, 0); g.fillText(String(num), 0, 0); g.restore();
}
// the top-view rider sits 1/10 of the bike length (2.0 units) forward of the seat, as Petr asked (2026-10-31)
const RIDER_TOP_FWD = 0.2;
function drawRiderTop(h, Tm, p = RIDER_REST) {
  h.save(); h.translate(RIDER_TOP_FWD, 0);
  h.lineCap = 'round';
  for (const sg of [-1, 1]) drawLeg(h, Tm, p, sg, [-0.32, sg * 0.18 + p.base + p.hip], [-0.05, sg * 0.27 * p.q + p.base], [-0.3, sg * 0.29 * p.q + p.base], 0.12);
  const xh = -0.4, xs = 0.15;
  h.save(); riderBend(h, p, xh, xs);
  h.fillStyle = 'rgba(0,0,0,.22)'; h.beginPath(); h.ellipse(-0.15, 0.05, 0.34, 0.2, 0, 0, TAU); h.fill(); // the rider's shadow on the bike
  h.fillStyle = acrossGrad(h, 0.22, shade(Tm.c1, -0.5), shade(Tm.c1, 0.2)); h.beginPath(); h.ellipse(-0.12, 0, 0.34, 0.205, 0, 0, TAU); h.fill();
  h.fillStyle = Tm.c2; h.beginPath(); h.ellipse(-0.16, 0, 0.3, 0.05, 0, 0, TAU); h.fill();
  h.fillStyle = shade(Tm.c2, -0.1); h.beginPath(); h.ellipse(-0.42, 0, 0.12, 0.12, 0, 0, TAU); h.fill();
  h.restore();
  for (const sg of [-1, 1]) drawArm(h, Tm, riderAt(p, xh, xs, 0.02, sg * 0.19), [0.44, sg * 0.29 * p.q + p.base], sg * p.sg > 0 ? p.elbow : 0);
  drawHelmet(h, Tm, 0.26 + p.fwd + p.hf, p.base + p.hel, 0.145, 1);
  h.restore();
}
// helmet seen from above (visor 1) or from behind (visor 0): shell in the third team colour, a stripe in the first
function drawHelmet(h, Tm, x, y, r, visor) {
  const hg = h.createRadialGradient(x - 0.04, y - 0.05, 0.02, x, y, r + 0.015); hg.addColorStop(0, shade(Tm.c3, 0.5)); hg.addColorStop(0.7, Tm.c3); hg.addColorStop(1, shade(Tm.c3, -0.5));
  h.fillStyle = hg; h.beginPath(); h.arc(x, y, r, 0, TAU); h.fill();
  h.fillStyle = Tm.c1; h.fillRect(x - r * 0.85, y - 0.025, r * 1.65, 0.05);
  if (visor > 0) { h.globalAlpha = visor; h.fillStyle = 'rgba(10,14,20,.9)'; h.beginPath(); h.arc(x, y, r, -0.75, 0.75); h.lineTo(x + 0.04, y); h.closePath(); h.fill(); h.globalAlpha = 1; }
}
// --- rider on the bike (GDD 11i): the hands stay on the grips and the boots on the pegs; the body bends from the seat
// to the inside of the bend (hips 0.12, shoulders 0.30, helmet 0.40 x sin(lean)), sits up and back when braking and
// tucks in at full throttle. base and q follow the chassis (its shift and narrowing with lean)
const RIDER_REST = { base: 0, q: 1, hip: 0, sh: 0, hel: 0, hf: 0, fwd: 0, sg: 0, elbow: 0, knee: 0 };
function riderPose(b) {
  const sl = Math.sin(b.lean), brk = clamp(b.ctl.brk, 0, 1), tuck = clamp((b.ctl.thr - 0.7) / 0.3, 0, 1) * (1 - brk);
  return { base: sl * 0.16, q: 0.72 + 0.28 * Math.cos(b.lean), hip: 0.12 * sl, sh: 0.3 * sl, hel: 0.4 * sl, hf: 0.05 * Math.abs(sl), fwd: 0.06 * tuck - 0.08 * brk, sg: Math.sign(sl), elbow: 0.08 * Math.abs(sl), knee: 0.19 * clamp((Math.abs(b.lean) - 0.3) / 0.5, 0, 1) };
}
// bend what is drawn next: the hips (at x xh) move by the hip shift, the shoulders (at x xs) by the shoulder shift and
// forward or back, everything between in proportion
function riderBend(h, p, xh, xs) {
  const sx = (xs + p.fwd - xh) / (xs - xh), k = (p.sh - p.hip) / (xs - xh);
  h.transform(sx, k, 0, 1, xh * (1 - sx), p.base + p.hip - k * xh);
}
// where the point (x, y) of the unbent body is after riderBend
function riderAt(p, xh, xs, x, y) {
  const sx = (xs + p.fwd - xh) / (xs - xh), k = (p.sh - p.hip) / (xs - xh);
  return [xh + (x - xh) * sx, y + p.base + p.hip + (x - xh) * k];
}
// a leg: thigh from the hip to the knee, shin from the knee back to the peg, one piece. The inside knee (side sg of the
// lean) goes out by the knee value, far enough to clear the bent body, with a knee cap and the slider on it
function drawLeg(h, Tm, p, sg, [hx, hy], [kx, ky], [px, py], w) {
  const out = sg * p.sg > 0 ? sg * p.knee : 0, k = [kx, ky + out];
  h.strokeStyle = shade(Tm.c1, -0.42); h.lineWidth = w * 0.8; h.beginPath(); h.moveTo(k[0], k[1]); h.lineTo(px, py); h.stroke(); // shin
  h.strokeStyle = shade(Tm.c1, -0.3); h.lineWidth = w; h.beginPath(); h.moveTo(hx, hy); h.lineTo(k[0], k[1]); h.stroke(); // thigh
  if (Math.abs(out) > 0.04) { // knee cap with the slider on its outside
    h.fillStyle = shade(Tm.c1, -0.3); h.beginPath(); h.arc(k[0], k[1], w * 0.6, 0, TAU); h.fill();
    h.fillStyle = '#e8e8e8'; h.beginPath(); h.arc(k[0], k[1] + sg * w * 0.3, 0.045, 0, TAU); h.fill();
  }
}
// an arm from the shoulder to the grip with a glove; out pushes the elbow away from the bike (the inside elbow)
function drawArm(h, Tm, [sx, sy], [gx, gy], out) {
  const ey = (sy + gy) / 2 + Math.sign(gy) * (0.04 + out);
  h.strokeStyle = shade(Tm.c1, -0.15); h.lineWidth = 0.085; h.beginPath(); h.moveTo(sx, sy); h.quadraticCurveTo((sx + gx) / 2, ey, gx, gy); h.stroke();
  h.fillStyle = '#151515'; h.beginPath(); h.arc(gx, gy, 0.045, 0, TAU); h.fill();
}
// rear three-quarter chassis (GDD 11i): k 0.5 Behind, 1 CLOSE. The lower the camera, the more of the rear tyre and
// the tail is seen and the less of the fairing ahead of the rider
function drawChassisRear(g, Tm, num, k) {
  const tl = 0.36 + 0.22 * k, tw = 0.11 + 0.025 * k, nose = 0.98 - 0.3 * k, sh = nose - 0.45;
  g.fillStyle = acrossGrad(g, tw, '#0a0a0a', '#383c40'); spriteRect(g, -1.1, -tw, tl, 2 * tw, tw * 0.9); g.fill(); // rear tyre
  g.fillStyle = '#16181a'; spriteRect(g, nose - 0.08, -0.06, 0.2, 0.12, 0.05); g.fill(); // front tyre, under the nose
  g.fillStyle = '#3a3e42'; spriteRect(g, -0.98, 0.13, 0.3, 0.1, 0.045); g.fill(); g.fillStyle = '#a3a9ae'; g.beginPath(); g.arc(-0.96, 0.18, 0.045, 0, TAU); g.fill(); // exhaust
  const body = new Path2D();
  body.moveTo(nose, 0); body.bezierCurveTo(nose - 0.02, 0.14, sh + 0.12, 0.27, sh, 0.31); body.bezierCurveTo(sh - 0.3, 0.31, -0.2, 0.26, -0.42, 0.19);
  body.bezierCurveTo(-0.7, 0.15, -0.86, 0.12, -0.9, 0); body.bezierCurveTo(-0.86, -0.12, -0.7, -0.15, -0.42, -0.19);
  body.bezierCurveTo(-0.2, -0.26, sh - 0.3, -0.31, sh, -0.31); body.bezierCurveTo(sh + 0.12, -0.27, nose - 0.02, -0.14, nose, 0); body.closePath();
  g.fillStyle = acrossGrad(g, 0.32, shade(Tm.c1, -0.5), shade(Tm.c1, 0.25)); g.fill(body);
  g.save(); g.clip(body); g.fillStyle = Tm.c2; g.fillRect(-1, -0.05, 2, 0.1); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-1, -0.21, 2, 0.06); g.restore();
  g.lineWidth = 0.012; g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(body);
  g.fillStyle = '#16181a'; for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(sh + 0.1, sg * 0.28); g.lineTo(sh - 0.04, sg * 0.4); g.lineTo(sh - 0.11, sg * 0.4); g.lineTo(sh - 0.04, sg * 0.29); g.closePath(); g.fill(); } // winglets
  g.fillStyle = 'rgba(25,35,48,.82)'; g.beginPath(); g.ellipse(nose - 0.2, 0, 0.12, 0.11, 0, 0, TAU); g.fill(); // windscreen
  g.fillStyle = '#1b1d20'; spriteRect(g, -0.62, -0.12, 0.26, 0.24, 0.06); g.fill(); // seat
  tailNumber(g, num, -0.73);
  // the back of the tail, facing the camera, with the tail light
  g.fillStyle = shade(Tm.c1, -0.55); spriteRect(g, -0.97, -0.09, 0.09, 0.18, 0.04); g.fill();
  g.fillStyle = '#5a0c0c'; spriteRect(g, -0.955, -0.065, 0.035, 0.13, 0.015); g.fill();
}
// rider from behind (GDD 11i): boots, thighs, the back with the hump and the rear of the helmet; the lower the camera
// (k 1 CLOSE), the longer the back looks and the further forward the helmet sits
function drawRiderRear(h, Tm, k, p = RIDER_REST) {
  const xs = 0.04 + 0.16 * k, xh = -0.42, hr = 0.15 + 0.03 * k;
  h.save(); h.translate(RIDER_TOP_FWD, 0); // the same forward move as the top view, in every camera
  h.lineCap = 'round';
  for (const sg of [-1, 1]) {
    const py = sg * 0.29 * p.q + p.base;
    h.fillStyle = '#151515'; spriteRect(h, -0.52, py - 0.05, 0.24, 0.1, 0.04); h.fill(); h.fillStyle = Tm.c1; h.fillRect(-0.52, py - 0.02, 0.05, 0.04); // boots on the pegs
    drawLeg(h, Tm, p, sg, [xh, sg * 0.15 + p.base + p.hip], [-0.12, sg * 0.28 * p.q + p.base], [-0.3, py], 0.13);
  }
  h.save(); riderBend(h, p, xh, xs);
  h.fillStyle = 'rgba(0,0,0,.22)'; h.beginPath(); h.ellipse(-0.18, 0.05, 0.36, 0.2, 0, 0, TAU); h.fill();
  const back = new Path2D();
  back.moveTo(-0.52, 0); back.bezierCurveTo(-0.52, 0.16, -0.36, 0.17, -0.2, 0.17); back.bezierCurveTo(xs - 0.15, 0.2, xs, 0.23, xs + 0.02, 0.12);
  back.bezierCurveTo(xs + 0.04, 0.04, xs + 0.04, -0.04, xs + 0.02, -0.12); back.bezierCurveTo(xs, -0.23, xs - 0.15, -0.2, -0.2, -0.17); back.bezierCurveTo(-0.36, -0.17, -0.52, -0.16, -0.52, 0); back.closePath();
  h.fillStyle = acrossGrad(h, 0.22, shade(Tm.c1, -0.5), shade(Tm.c1, 0.22)); h.fill(back);
  h.save(); h.clip(back); h.fillStyle = Tm.c2; h.fillRect(-0.6, -0.045, xs + 0.7, 0.09); h.fillStyle = 'rgba(0,0,0,.28)'; h.fillRect(-0.4, -0.3, 0.04, 0.6); h.restore(); // spine stripe, belt
  h.fillStyle = shade(Tm.c2, -0.1); h.beginPath(); h.ellipse(xs - 0.17, 0, 0.13, 0.09, 0, 0, TAU); h.fill(); // aero hump
  h.fillStyle = 'rgba(255,255,255,.25)'; h.beginPath(); h.ellipse(xs - 0.2, -0.03, 0.06, 0.03, 0, 0, TAU); h.fill();
  h.restore();
  const gx = xs + 0.26 - 0.06 * k;
  for (const sg of [-1, 1]) drawArm(h, Tm, riderAt(p, xh, xs, xs - 0.04, sg * 0.19), [gx, sg * 0.3 * p.q + p.base], sg * p.sg > 0 ? p.elbow : 0);
  drawHelmet(h, Tm, xs + 0.12 + p.fwd + p.hf, p.base + p.hel, hr, 1 - k);
  h.restore();
}

// the drawing and the stretch for the camera in use (GDD 11i): in Behind and CLOSE the drawing is stretched along the
// screen's up direction so the road's squash at that spot is cancelled: the tilt (cos(tilt)) and the perspective (rows
// further up are squashed more, by the row's scale), with the tilt of the moment; at most 2.5 near the horizon
function bikeView() { return BIKE_VIEW[CAM.mode] || 'top'; }
function bikeStretch(x, y) {
  if (!camTilted()) return 1;
  const P = tiltP(), a = tiltA(), yy = worldToCanvas(x, y)[1] - RH, sc = P / (P - yy * Math.sin(a));
  return clamp(1 / (Math.cos(a) * sc), 1, 2.5);
}
// stretch what is drawn next around the world point (x, y), along the camera's forward direction
function stretchAt(x, y) {
  const s = bikeStretch(x, y); if (s === 1) return;
  ctx.translate(x, y); ctx.rotate(-CAM.rot); ctx.scale(1, s); ctx.rotate(CAM.rot); ctx.translate(-x, -y);
}

// --- camera: 'behind' and 'close' = tilted chase views with their own values, 'chase' = top-down rotating (GDD 11a)
const CAM = { x: 0, y: 0, rot: 0, v: 0, ppm: 10, mode: 'behind', init: false, ax: 0.5, ay: 0.6, boost: 1, w: 0, dec: 0 }; // w: wider view at speed, dec: deceleration in m/s2 (GDD 11h)
const CAM_ORDER = ['behind', 'close', 'chase'], CAM_NAME = { behind: 'Behind', close: 'CLOSE', chase: 'Top-down' }; // C goes through them in this order
const camTilted = () => CAM.mode !== 'chase';
function setCamMode(m) { if (CAM.mode === m || !CAM_NAME[m]) { return; } CAM.mode = m; if (m in CAM_KEY) { camLoad(m); } CAM.init = false; resize(); }
function updateCamera(dt) {
  const b = W.player; if (!b) return;
  let px = b.x, py = b.y, h = b.h, v = b.v;
  if (b.crashed && b.crash) { px = b.crash.rd.x; py = b.crash.rd.y; v = Math.hypot(b.crash.rd.vx, b.crash.rd.vy); }
  if (dt > 0.001) CAM.dec += ((CAM.v - v) / dt - CAM.dec) * (1 - Math.exp(-dt * 10));
  CAM.v = v; // the speed the camera follows, also for the speed blur (GDD 11f)
  const ww = camTilted() && UI.opts.fx !== 'off' ? sstep((v * 3.6 - 200) / 140) : 0; // wider view above 200 km/h (GDD 11h)
  CAM.w = CAM.init ? CAM.w + (ww - CAM.w) * (1 - Math.exp(-dt / 0.4)) : ww;
  let tx, ty, targetPpm;
  if (camTilted()) {
    CAM.ay = 1 - tiltBikeH() / RH;
    targetPpm = Math.min(TILT.zMax, Math.min(VW, VH * 1.25) / (TILT.zBase + v * TILT.zK));
    tx = px; ty = py;
  } else {
    CAM.ay = 0.6;
    targetPpm = Math.min(24, Math.min(VW, VH * 1.25) / (34 + v * 0.95));
    const look = Math.min(55, v * 0.62, VH * 0.24 / targetPpm); // keeps the bike on screen at top speed
    tx = px + Math.cos(h) * look; ty = py + Math.sin(h) * look;
  }
  const tr = -h - Math.PI / 2;
  if (!CAM.init) { CAM.x = tx; CAM.y = ty; CAM.rot = tr; CAM.ppm = targetPpm; CAM.init = true; }
  if (camTilted()) { CAM.x = tx; CAM.y = ty; }
  else { const k = 1 - Math.exp(-dt * 6); CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k; }
  CAM.rot += angWrap(tr - CAM.rot) * (1 - Math.exp(-dt * 4.5));
  CAM.ppm += (targetPpm - CAM.ppm) * (1 - Math.exp(-dt * 1.8));
  CAM.boost = camTilted() ? Math.max(1, TILT.minLen / (2.5 * PHYS.VS * CAM.ppm)) : 1; // keep bikes readable when zoomed out
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
  if (!camTilted()) return [cx, cy];
  // same projection as the CSS perspective(P) rotateX(a) about the canvas bottom centre
  const P = tiltP(), yy = cy - RH, sc = P / (P - yy * Math.sin(tiltA()));
  return [VW / 2 + (cx - RW / 2) * sc, VH + yy * Math.cos(tiltA()) * sc];
}

// --- static world baked into cached tiles (track, run-off, walls, paint, buildings, trees)
// detail levels: 40 m tiles close up, 80 m and 160 m tiles when zoomed out or far away in the tilted view
const TILE_PX = 512;
const TLV = [{ m: 40, map: new Map(), cap: 160 }, { m: 80, map: new Map(), cap: 140 }, { m: 160, map: new Map(), cap: 140 }];
let tileFrame = 0;
function drawStatic(vis, x0, y0, w, h) {
  ctx.fillStyle = TEX.pGrass; ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = 'rgba(255,255,235,.06)'; ctx.fill(GEO.mowL); ctx.fillStyle = 'rgba(0,25,0,.07)'; ctx.fill(GEO.mowD); // mowing stripes (GDD 11h)
  ctx.fillStyle = TEX.pRun; for (const p of GEO.runoff) ctx.fill(p);
  ctx.fillStyle = TEX.pGravel; for (const p of GEO.gravel) ctx.fill(p);
  ctx.fillStyle = TEX.pPit; ctx.fill(GEO.pit);
  ctx.strokeStyle = 'rgba(240,240,240,.85)'; ctx.lineWidth = 0.3; ctx.stroke(GEO.hatch);
  ctx.lineWidth = 0.22; ctx.stroke(GEO.pitLines);
  ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,214,40,.8)'; ctx.stroke(GEO.pitDash); ctx.setLineDash([]);
  ctx.fillStyle = TEX.pAsph; ctx.fill(GEO.track, 'evenodd');
  ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 0.15; ctx.stroke(GEO.joints); // asphalt joints (GDD 11h)
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
  for (const q of GEO.posts) { // distance posts (GDD 11h)
    if (!vis(q.x, q.y, 2)) continue;
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.h);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-0.25 + 0.25, -0.25 + 0.3, 0.5, 0.5);
    ctx.fillStyle = '#f4f4f2'; ctx.fillRect(-0.25, -0.25, 0.5, 0.5); ctx.fillStyle = '#151515'; ctx.fillRect(-0.15, -0.15, 0.3, 0.3);
    ctx.restore();
  }
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
  if (!t) { if (!allowRender) { return null; } t = { c: renderTile(L, tx, ty), used: tileFrame }; L.map.set(key, t);
    if (L.map.size > L.cap) { let old = null, ok = 0; for (const [k, v] of L.map) { if (!old || v.used < old.used) { old = v; ok = k; } } L.map.delete(ok); } }
  t.used = tileFrame; return t.c;
}
// --- frame-time overlay (GDD 11n): P toggles it; times each part of the frame, averaged over PERF_N frames
const PERF = { on: false, cur: {}, sum: {}, n: 0, last: 0, show: null, gl3d: 0, no3d: false }; // no3d: test switch (GDD 11n)
const PERF_N = 30;
const PERF_PARTS = [['sim', 'physics'], ['camera', 'camera'], ['world', '2D world'], ['project', 'projection + blur'],
  ['gl3d', '3D bikes (CPU)'], ['hud', 'HUD']];
function perfToggle() { PERF.on = !PERF.on; PERF.cur = {}; PERF.sum = {}; PERF.n = 0; PERF.show = null; PERF.last = 0; }
// adds the time since t0 to a part of this frame (nothing when the overlay is off)
// test switch 8: the road projection draws one strip per 1, 2, 4 or 8 device rows (fewer draw calls, coarser picture)
function perfRows() { TILT.rows = TILT.rows >= 8 ? 1 : TILT.rows * 2; }
// test switch 9: the 3D bikes on or off
function perfNo3D() { PERF.no3d = !PERF.no3d; }
function perfAdd(name, t0) { if (PERF.on) { PERF.cur[name] = (PERF.cur[name] || 0) + performance.now() - t0; } }
// at the start of a frame: books the last frame's parts and its length, and every PERF_N frames the averages to show
function perfFrame(now) {
  if (!PERF.on) { return; }
  if (PERF.last) {
    PERF.sum.frame = (PERF.sum.frame || 0) + now - PERF.last;
    for (const k in PERF.cur) { PERF.sum[k] = (PERF.sum[k] || 0) + PERF.cur[k]; }
    if (++PERF.n >= PERF_N) {
      const avg = {}; for (const k in PERF.sum) { avg[k] = PERF.sum[k] / PERF.n; }
      PERF.show = avg; PERF.sum = {}; PERF.n = 0;
    }
  }
  PERF.last = now; PERF.cur = {};
}
// the overlay, on the right edge of the HUD under the track map
function drawPerf() {
  if (!PERF.on) { return; }
  const a = PERF.show, lines = ['Frame time (P to hide)'];
  if (a) {
    lines.push(`${(1000 / a.frame).toFixed(0)} fps   ${a.frame.toFixed(1)} ms per frame`);
    for (const [k, label] of PERF_PARTS) { lines.push(`${label.padEnd(20)} ${(a[k] || 0).toFixed(2)} ms`); }
  } else { lines.push('measuring...'); }
  lines.push(`3D bikes ${PERF.no3d ? 'off' : PERF.gl3d}   canvas ${cv.width}x${cv.height}   DPR ${DPR}`);
  lines.push(`8: road strips ${TILT.rows} px   9: 3D bikes`);
  const hgt = 18 * lines.length + 12, x0 = VW - 316, y0 = 220; // right edge, under the track map and clear of the standings
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(x0, y0, 310, hgt);
  ctx.fillStyle = '#e9edf0'; ctx.font = '13px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x0 + 8, y0 + 6 + 18 * i));
}
function drawWorld() {
  tileFrame++;
  let sx = 0, sy = 0; if (HUD.shake > 0.01) { sx = (Math.random() - 0.5) * 8 * HUD.shake; sy = (Math.random() - 0.5) * 8 * HUD.shake; }
  const A = speedVib(); if (A > 0) { sx += (Math.random() - 0.5) * 2 * A; sy += (Math.random() - 0.5) * 2 * A; }
  let t = performance.now();
  try { for (const Ly of LAYERS) { ctx = Ly.g; drawWorldLayer(Ly, sx, sy); } } finally { ctx = mainCtx; }
  perfAdd('world', t);
  if (camTilted()) { t = performance.now(); projectTilted(); speedBlur(); perfAdd('project', t); gl3DDraw(PERF.no3d ? [] : W.bikes.filter(gl3DOn)); } else { gl3DShow(false); }
}
// --- speed blur (GDD 11f): at top speed the surroundings smear into zoom streaks from the horizon point straight
// ahead, on a 1/4 resolution copy of the screen; the road with its kerbs (+0.3 m) and the bikes are cut out of it
const BLUR = { a: mkCanvas(1, 1), b: mkCanvas(1, 1), s: 0 };
BLUR.ga = BLUR.a.getContext('2d', { alpha: false }); BLUR.gb = BLUR.b.getContext('2d');
function blurStrength() {
  if (!camTilted() || TILT.q < 1 || TILT.bs <= 0 || UI.opts.blur === 'off') return 0; // TILT.q < 1: slow machine, off for the session
  const t = clamp((CAM.v * 3.6 - TILT.bv0) / (TILT.bv1 - TILT.bv0), 0, 1); return t * t * (3 - 2 * t);
}
function speedBlur() {
  const s = BLUR.s = blurStrength(); if (s <= 0.01) return;
  const Q = 0.25, w = Math.max(1, Math.ceil(VW * Q)), h = Math.max(1, Math.ceil(VH * Q)), A = BLUR.a, B = BLUR.b, ga = BLUR.ga, gb = BLUR.gb;
  if (A.width !== w || A.height !== h) { A.width = B.width = w; A.height = B.height = h; }
  ga.setTransform(1, 0, 0, 1, 0, 0); ga.imageSmoothingEnabled = true; ga.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, w, h);
  // zoom about the horizon point: every pixel moves by k times its distance from it, so streaks grow to the edges
  const P = tiltP(), uTop = RH * Math.cos(tiltA()) * P / (P + RH * Math.sin(tiltA())), hx = VW / 2, hy = Math.max(0, VH - uTop);
  const far = Math.hypot(VW / 2, Math.max(hy, VH - hy)), k = TILT.bs * s / far;
  gb.globalCompositeOperation = 'source-over'; gb.imageSmoothingEnabled = true;
  for (const [z, al] of [[1 + k, 1], [1 + k / 2, 1 / 2], [1, 1 / 3]]) { // equal thirds
    gb.globalAlpha = al; gb.setTransform(z, 0, 0, z, hx * Q * (1 - z), hy * Q * (1 - z)); gb.drawImage(A, 0, 0);
  }
  gb.globalAlpha = 1; gb.setTransform(Q, 0, 0, Q, 0, 0); gb.globalCompositeOperation = 'destination-out';
  gb.fillStyle = gb.strokeStyle = '#000'; gb.lineWidth = 6; gb.lineJoin = 'round'; // the stroke keeps the soft mask edge outside the margin
  for (const run of blurRoadRuns()) { gb.beginPath(); gb.moveTo(run[0], run[1]); for (let j = 2; j < run.length; j += 2) { gb.lineTo(run[j], run[j + 1]); } gb.closePath(); gb.fill(); gb.stroke(); }
  gb.beginPath(); for (const [x, y, rx, ry] of blurBikeSpots()) { gb.moveTo(x + rx, y); gb.ellipse(x, y, rx, ry, 0, 0, TAU); } gb.fill();
  gb.globalCompositeOperation = 'source-over';
  const g = mainCtx; g.setTransform(ODPR, 0, 0, ODPR, 0, 0); g.imageSmoothingEnabled = true; g.globalAlpha = s; g.drawImage(B, 0, 0, VW, VH); g.globalAlpha = 1;
}
// the road (both edges plus kerb plus 0.3 m) on screen, as polygons of contiguous runs of track points in the ground area
function blurRoadRuns() {
  const N = T.N, P = tiltP(), yMax = RH + 0.5 * P / Math.sin(tiltA()), runs = [];
  const inside = i => { const [cx, cy] = worldToCanvas(T.X[i], T.Y[i]); return cx > -0.3 * RW && cx < 1.3 * RW && cy > -0.05 * RH && cy < yMax; };
  const flags = new Uint8Array(N); let start = -1;
  for (let i = 0; i < N; i++) { flags[i] = inside(i) ? 1 : 0; if (!flags[i] && start < 0) start = i; }
  if (start < 0) start = 0; // the whole track in view
  for (let n = 0; n < N; n++) {
    if (!flags[(start + n) % N]) continue;
    const idx = []; while (n < N && flags[(start + n) % N]) { idx.push((start + n) % N); n++; }
    if (idx.length === N) idx.push(idx[0]);
    idx.unshift((idx[0] - 1 + N) % N); idx.push((idx[idx.length - 1] + 1) % N); // one point beyond each end
    const L = [], R = [];
    for (const i of idx) {
      const [lx, ly] = worldToScreen(...T.pt(i, -(T.WL[i] + T.KERB[1][i] + 0.3))), [rx, ry] = worldToScreen(...T.pt(i, T.WR[i] + T.KERB[0][i] + 0.3));
      L.push(lx, ly); R.push(rx, ry);
    }
    for (let j = R.length - 2; j >= 0; j -= 2) L.push(R[j], R[j + 1]);
    runs.push(L);
  }
  return runs;
}
// an ellipse around each bike and ghost on screen, 1.3 x its drawn length across (also off the road and crashed)
function blurBikeSpots() {
  const out = [], r = 0.65 * 2.5 * PHYS.VS * CAM.boost * CAM.ppm, P = tiltP(), sa = Math.sin(tiltA()), ca = Math.cos(tiltA());
  const add = (x, y) => {
    const [cx, cy] = worldToCanvas(x, y), yy = cy - RH; if (P - (yy + r) * sa <= 0) return;
    const scr = q => P / (P - q * sa), y0 = VH + (yy - r) * ca * scr(yy - r), y1 = VH + (yy + r) * ca * scr(yy + r);
    out.push([VW / 2 + (cx - RW / 2) * scr(yy), (y0 + y1) / 2, r * scr(yy + r), Math.max(1, (y1 - y0) / 2)]);
  };
  for (const b of W.bikes.concat(W.ghosts.filter(g => g.show))) {
    if (b.crashed && b.crash) { add(b.crash.bk.x, b.crash.bk.y); add(b.crash.rd.x, b.crash.rd.y); } else if (!b.dnf) add(b.x, b.y);
  }
  return out;
}
// --- sense of speed (GDD 11h): camera vibration and speed lines, only while the session or the replay runs
const fxLive = () => UI.opts.fx !== 'off' && ((UI.state === 'play' && !W.paused) || (UI.state === 'replay' && RP.playing));
const VIBP = { i: 0, s: 0, d: 0 };
function speedVib() { // amplitude in px: speed, kerbs above 50 km/h, braking harder than 1 g
  const b = W.player; if (!b || b.crashed || !fxLive()) return 0;
  const vib = camTilted() ? TILT.vib : CAM_DEF.behind.vib, kmh = CAM.v * 3.6;
  T.project(b.x, b.y, b.i ?? -1, VIBP);
  const k = kmh > 50 && T.surface(VIBP.i, VIBP.s, VIBP.d) === SURF.KERB ? 1 : 0;
  const braking = UI.state === 'replay' ? b.ctl.brk > 0.5 && CAM.v > 5 : CAM.dec > 9.81;
  const br = braking ? 0.5 : 0;
  return vib * Math.min(2, sstep((kmh - 180) / 165) + k + br);
}
const SPL = { lines: [], acc: 0 };
function speedOrigin() { // the point the lines streak out from: the horizon point straight ahead, or ahead of the bike in Top-down
  if (!camTilted()) return [VW / 2, VH * 0.25];
  const P = tiltP(), uTop = RH * Math.cos(tiltA()) * P / (P + RH * Math.sin(tiltA())); return [VW / 2, Math.max(0, VH - uTop)];
}
function drawSpeedLines(dt) { // on the HUD layer, before the HUD
  const l = fxLive() && W.player && !W.player.crashed ? sstep((CAM.v * 3.6 - 280) / 60) : 0, L = SPL.lines;
  if (l <= 0) { L.length = 0; SPL.acc = 0; return; }
  const [ox, oy] = speedOrigin(), life = 0.15;
  SPL.acc += dt * 16 * l / life;
  for (; SPL.acc >= 1; SPL.acc--) { // a new line in the outer 30 % of the screen width, pointing away from the origin
    const x = Math.random() < 0.5 ? Math.random() * 0.3 * VW : VW - Math.random() * 0.3 * VW, y = oy + Math.random() * (VH - oy);
    const dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy) || 1;
    L.push({ x, y, ux: dx / d, uy: dy / d, len: 40 + Math.random() * 80, age: 0 });
  }
  const g = ctx; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.lineWidth = 1; g.lineCap = 'butt';
  for (const q of L) {
    q.age += dt; const f = q.age / life; if (f >= 1) continue;
    const mv = f * q.len * 1.5, a = 0.3 * l * Math.sin(Math.PI * f);
    g.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`; g.beginPath();
    g.moveTo(q.x + q.ux * mv, q.y + q.uy * mv); g.lineTo(q.x + q.ux * (mv + q.len), q.y + q.uy * (mv + q.len)); g.stroke();
  }
  SPL.lines = L.filter(q => q.age < life);
}
// perspective: screen height u above the bottom edge <-> plane distance h, as seen from tiltP() away at angle TILT.a
function projectTilted() {
  const P = tiltP(), sa = Math.sin(tiltA()), ca = Math.cos(tiltA());
  const hOf = u => u * P / (ca * P - u * sa), uTop = RH * ca * P / (P + RH * sa);
  const g = mainCtx; g.setTransform(ODPR, 0, 0, ODPR, 0, 0); g.imageSmoothingEnabled = true;
  const sky = g.createLinearGradient(0, 0, 0, VH - uTop + 2); sky.addColorStop(0, '#6fa3d2'); sky.addColorStop(1, '#c9d8de');
  g.fillStyle = sky; g.fillRect(0, 0, VW, VH - uTop + 2);
  g.fillStyle = '#c9d8de'; g.fillRect(0, VH - uTop, VW, uTop); // haze where a narrow ground area does not reach the screen sides
  const near = LAYERS[1], far = LAYERS[0], hN = near.h;
  // one strip per screen row: the horizontal scale changes from row to row, so taller strips drew straight lines
  // as small steps, worst where the near and far bands join (GDD 1.11.5)
  // the sharper near band fades into the far band over the last hB of the near band, so the picture does not
  // get blurrier in one step where they join (GDD 1.11.6)
  const hB = far.hB, hF = hN - hB;
  const row = (Ly, u0, u1, h0, h1, sc) => {
    const d = Ly.dpr, cw = Ly.c.width;
    const sy0 = Math.max(0, (RH - h1 - Ly.y0) * d), sh = Math.min(Ly.c.height, (RH - h0 - Ly.y0) * d) - sy0; if (sh <= 0) return;
    g.drawImage(Ly.c, 0, sy0, cw, sh, VW / 2 + (Ly.x0 - RW / 2) * sc, VH - u1, cw / d * sc, u1 - u0 + 0.5 * du);
  };
  // one strip per TILT.rows device rows. The horizontal scale is linear down the screen (1 - u tan(a) / P), so a strip of
  // n rows is off by at most n/2 * tan(a) / P * VW/2 at the screen sides: about 0.3 px for 1 row, 0.6 px for 2 (GDD 11n)
  const du = TILT.rows / ODPR;
  for (let u0 = 0; u0 < uTop; u0 += du) {
    const u1 = Math.min(uTop, u0 + du), h0 = hOf(u0), h1 = hOf(u1), hm = (h0 + h1) / 2, sc = P / (P + hm * sa);
    if (hm < hN) row(near, u0, u1, h0, h1, sc);
    if (hm > hF) { const a = hm >= hN ? 1 : (hm - hF) / hB; if (a < 1) { g.globalAlpha = a; } row(far, u0, u1, h0, h1, sc); g.globalAlpha = 1; }
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
  let budget = coarse ? 3 : 4;
  if (L.map.size < 6) budget = 40;
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
    for (let n = 0; n < FX.mn; n++) { const k = n * 6; if (M[k + 4] !== a) { continue; } if (!vis(M[k + 2], M[k + 3], 2)) { continue; } ctx.moveTo(M[k], M[k + 1]); ctx.lineTo(M[k + 2], M[k + 3]); }
    ctx.stroke();
  }
  if (W.guide && W.player && !W.player.crashed) {
    const b = W.player, N = T.N; ctx.lineWidth = 0.55; ctx.lineCap = 'round';
    for (let o = 1; o < 170; o += 1) {
      const k = (b.i + o) % N, n = (k + 1) % N; const dv = T.VP[n] - T.VP[k];
      let col = 'rgba(255,214,40,.75)';
      if (dv < -0.02) col = 'rgba(235,50,40,.75)'; else if (dv > 0.02) col = 'rgba(60,210,120,.7)';
      ctx.strokeStyle = col;
      ctx.globalAlpha = o > 130 ? (170 - o) / 40 : 1;
      ctx.beginPath(); ctx.moveTo(T.RX[k], T.RY[k]); ctx.lineTo(T.RX[n], T.RY[n]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (W.mode === 'race' && W.player && W.player.llPend?.length && vis(T.X[T.idx(T.LL.sM)], T.Y[T.idx(T.LL.sM)], 120)) { // Long Lap pending (GDD 6a)
    if (!GEO.llPath) { GEO.llPath = llPath(); } ctx.strokeStyle = 'rgba(255,207,31,.95)'; ctx.lineWidth = 0.4; ctx.setLineDash([2, 1.5]); ctx.stroke(GEO.llPath); ctx.setLineDash([]);
  }
  ctx.lineCap = 'butt';
  drawPitBoxes(vis, false);
  drawBuildings(vis, false);
  // bikes
  const list = W.bikes.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
  ctx.globalAlpha = 0.42; for (const g of W.ghosts) { if (g.show) drawBike(g, vis); } ctx.globalAlpha = 1;
  for (const b of list) if (!b.dnf || b.crash) drawBikeShadow(b, vis);
  for (const b of list) if (!gl3DOn(b)) drawBike(b, vis);
  drawParticles(vis);
  ctx.setTransform(Ly.dpr, 0, 0, Ly.dpr, 0, 0);
  if (camTilted() && Ly.y0 === 0) { // haze towards the horizon
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
  // Long Lap loop (GDD 6a): dashed white lane edges and LONG LAP on the tarmac
  { const LL = T.LL, i = T.idx(LL.sM); if (vis(T.X[i], T.Y[i], 120)) {
    ctx.strokeStyle = 'rgba(245,245,245,.85)'; ctx.lineWidth = 0.25; ctx.setLineDash([2, 1.5]); ctx.stroke(llPath()); ctx.setLineDash([]);
    groundText('LONG LAP', ...P(i, LL.sg * LL.off(LL.sM)), T.H[i], 2.4, 'rgba(255,255,255,.75)');
  } }
  // corner names painted on run-off
  for (const c of T.corners) {
    if (/Straight/.test(c.name)) { continue; } const i = c.i; const sg = T.KS[i] > 0 ? -1 : 1; const side = sg > 0 ? 0 : 1;
    const [x, y] = P(i, sg * (T.EDGE[side][i] + T.KERB[side][i] + Math.min(6, T.RUN[side][i] * 0.4 + 2))); if (!vis(x, y, 20)) continue;
    groundText(c.name.toUpperCase(), x, y, T.H[i], 2.6, 'rgba(255,255,255,.55)');
  }
}
function llPath() { // both edges of the Long Lap lane
  const LL = T.LL, p = new Path2D();
  for (const e of [-1, 1]) for (let s = LL.sA, j = 0; s <= LL.sB + 0.01; s += 2, j++) { const [x, y] = T.pt(T.idx(s), LL.sg * (LL.off(s) + e * LL.w / 2)); j ? p.lineTo(x, y) : p.moveTo(x, y); }
  return p;
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
  if (b.crashed && b.crash) { for (const o of [b.crash.bk, b.crash.rd]) { if (!vis(o.x, o.y, 4)) { continue; } ctx.save(); stretchAt(o.x, o.y); ctx.translate(o.x + 0.35, o.y + 0.45); ctx.rotate(o.rot); ctx.globalAlpha = 0.6; ctx.drawImage(TEX.shadow, -1.2 * VS, -0.55 * VS, 2.4 * VS, 1.1 * VS); ctx.restore(); } ctx.globalAlpha = 1; return; }
  if (b.dnf || !vis(b.x, b.y, 4)) return;
  const sl = Math.sin(b.lean);
  ctx.save(); stretchAt(b.x, b.y);
  ctx.save(); ctx.translate(b.x + 0.25, b.y + 0.35); ctx.rotate(b.h); ctx.translate(0, sl * 0.55 * VS); ctx.globalAlpha = 0.7; ctx.drawImage(TEX.shadow, -1.2 * VS, -0.45 * VS, 2.4 * VS, 0.9 * VS); ctx.restore();
  // darker where the tyres touch the road (GDD 11i)
  ctx.translate(b.x, b.y); ctx.rotate(b.h); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
  // the patches follow the suspension: the front one moves back and widens under braking, the rear one moves forward and
  // widens under squat (GDD 11j)
  const fk = (b.fork || 0), sq = (b.squat || 0);
  for (const [x, grow] of [[0.73 - fk, 1 + 0.3 * fk / FORK_TRAVEL], [-0.72 + sq, 1 + 0.3 * sq / SQUAT_TRAVEL]]) { ctx.beginPath(); ctx.ellipse(x * VS, sl * 0.1 * VS, 0.28 * grow * VS, 0.1 * VS, 0, 0, TAU); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
}
// Bike graphics 3D (GDD 11l): the bikes are drawn by three.js (src/bike3dgl.js); Classic keeps this 2D drawing
function useBike3D() { return UI.opts.gfx !== 'classic'; }
function drawBike(b, vis) {
  const VS = PHYS.VS * CAM.boost; const sp = bikeSprite(b.team, b.num, bikeView()); const w = SPW / SPR, h = SPH / SPR;
  if (b.crashed && b.crash) {
    const C = b.crash;
    if (vis(C.bk.x, C.bk.y, 4)) { ctx.save(); stretchAt(C.bk.x, C.bk.y); ctx.translate(C.bk.x, C.bk.y); ctx.rotate(C.bk.rot); ctx.scale(VS, VS * 0.8); ctx.translate(0, C.bk.side * 0.2); if (topTyresLive(bikeView())) { drawTyresTop(ctx, 0, 0, 0); } ctx.drawImage(sp.c, -w / 2, -h / 2, w, h); ctx.restore(); }
    if (vis(C.rd.x, C.rd.y, 4)) { ctx.save(); stretchAt(C.rd.x, C.rd.y); ctx.translate(C.rd.x, C.rd.y); ctx.rotate(C.rd.rot); ctx.scale(VS, VS); ctx.drawImage(sp.r, -w / 2, -h / 2, w, h); ctx.restore(); }
    return;
  }
  if (b.dnf || !vis(b.x, b.y, 4)) return;
  updateBikeMotion(b, performance.now());
  const sl = Math.sin(b.lean), cl = Math.cos(b.lean);
  if (artStyle()) { drawArtBike(b, VS, w, h); return; }
  const live = topTyresLive(bikeView());
  ctx.save(); stretchAt(b.x, b.y); ctx.translate(b.x, b.y); ctx.rotate(b.h); ctx.scale(VS, VS);
  if (b.wheelie > 0.05) ctx.scale(1 + b.wheelie * 0.04, 1);
  ctx.save(); ctx.translate(0, sl * 0.16); ctx.scale(1, 0.72 + 0.28 * cl);
  if (live) drawTyresTop(ctx, b.steer, b.fork, b.squat); // the tyres under the frame, turned and moved (GDD 11j)
  // (the drawing is scaled by BIKE_SHORT, GDD 11k: the brake light and the rider are scaled the same way)
  ctx.drawImage(sp.c, -w / 2, -h / 2, w, h); ctx.restore();
  // brake light on the tail of the drawing (GDD 11i)
  if (b.ctl.brk > 0.3 && b.v > 5) { ctx.fillStyle = 'rgba(255,40,30,.6)'; ctx.beginPath(); ctx.arc(-0.94 * BIKE_SHORT, sl * 0.16, 0.13, 0, TAU); ctx.fill(); }
  // the rider, posed each frame, with the inside knee out as part of the leg (GDD 11i), scaled like the body (GDD 11k)
  const p = riderPose(b), Tm = TEAMS[b.team], k = BIKE_REAR[bikeView()];
  ctx.save(); ctx.scale(BIKE_SHORT, 1);
  if (k) drawRiderRear(ctx, Tm, k, p); else drawRiderTop(ctx, Tm, p);
  ctx.restore();
  ctx.restore();
}
function artStyle() { const st = BIKE_STYLES[BIKE_STYLE]; return st && st.art ? st : null; }
// the bike, then the rider in the pose for the riding state, mirrored for left-hand bends, with the race number on the tail
// the rider's frame moves towards its target at a limited speed, so a change of throttle or lean reads as movement in both
// directions (GDD 11i): ART_FRAMES_PER_S frames a second, about a third of a second from accelerating to upright
const ART_FRAMES_PER_S = 110;
function approachFrame(cur, target, dt) {
  const step = ART_FRAMES_PER_S * dt;
  return cur + clamp(target - cur, -step, step);
}
// the rider sits off the centre line on the seat (Petr 2026-11-01): 0 upright, 50 px at 10 deg, 70 px from 45 deg on, in
// picture pixels of the bike art (one bike length is 1828 px = 2.04 units); the offset goes to the inside of the bend
const ART_UNITS_PER_PX = 2.04 / 1828;
function riderOffsetPx(lean) {
  const L = Math.abs(lean) / DEG;
  if (L <= 10) return 50 * L / 10;
  if (L <= 45) return 50 + 20 * (L - 10) / 35;
  return 70;
}
// the rider is drawn in bands along the bike (GDD 11i, 2026-11-01): the boots and lower legs stay near the pegs, the hips
// move part of the way, and the shoulders and helmet move most. The upper bands also tilt against the lean about the hips,
// so the head stays nearer level. Each band is [from, to, share of the offset] in bike units along x (nose +).
const RIDER_BANDS = [[-1.3, -0.4, 0.3], [-0.4, -0.3, 0.6], [-0.3, 1.3, 1.0]]; // the upper body (x > -0.3) is one rigid block: torso, arms and helmet
const RIDER_HIP_X = -0.2, RIDER_HEAD_TURN = 0.33;
function drawRiderBands(sprite, w, h, offsetPx, lean) {
  const off = offsetPx * ART_UNITS_PER_PX, turn = -RIDER_HEAD_TURN * Math.abs(lean);
  for (const [x0, x1, share] of RIDER_BANDS) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x0 - 0.03, -2, x1 - x0 + 0.06, 4); ctx.clip(); // overlap the neighbours, so no seam shows
    if (x0 >= -0.3) { ctx.translate(RIDER_HIP_X, 0); ctx.rotate(turn); ctx.translate(-RIDER_HIP_X, 0); }
    ctx.translate(0, off * share);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
function drawArtBike(b, VS, w, h) {
  const now = performance.now(), dt = clamp((now - (b.artT ?? now)) / 1000, 0, 0.1);
  b.artT = now;
  b.artFrame = b.artFrame === undefined ? riderFrameIndex(b) : approachFrame(b.artFrame, riderFrameIndex(b), dt);
  const flip = b.lean < 0 ? -1 : 1, f = b.artFrame, i0 = Math.floor(f), i1 = Math.min(i0 + 1, BIKE_ART.rider.length - 1), mix = f - i0;
  ctx.save(); stretchAt(b.x, b.y); ctx.translate(b.x, b.y); ctx.rotate(b.h); ctx.scale(VS, VS * flip);
  ctx.drawImage(artSprite(b.team, 'bike', BIKE_ART.bike).c, -w / 2, -h / 2, w, h);
  if (BIKE_STYLES[BIKE_STYLE] && BIKE_STYLES[BIKE_STYLE].rig) { drawRigRider(ctx, TEAMS[b.team], b.lean); ctx.restore(); return; }
  // the rider, moved sideways on the seat towards the inside of the bend (after the flip, so it follows the bend)
  const off = riderOffsetPx(b.lean);
  drawRiderBands(artSprite(b.team, 'rider' + i0, BIKE_ART.rider[i0]).c, w, h, off, b.lean); // the rider frame, then the next one blended in
  if (mix > 0.001 && i1 !== i0) { ctx.globalAlpha = mix; drawRiderBands(artSprite(b.team, 'rider' + i1, BIKE_ART.rider[i1]).c, w, h, off, b.lean); ctx.globalAlpha = 1; }
  ctx.restore();
  ctx.save(); stretchAt(b.x, b.y); ctx.translate(b.x, b.y); ctx.rotate(b.h); ctx.scale(VS, VS);
  tailNumber(ctx, b.num, -0.74);
  if (b.ctl.brk > 0.3 && b.v > 5) { ctx.fillStyle = 'rgba(255,40,30,.6)'; ctx.beginPath(); ctx.arc(-0.94, 0, 0.13, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawParticles(vis) {
  for (const p of FX.parts) {
    if (!vis(p.x, p.y, 3)) { continue; } const f = 1 - p.age / p.life;
    if (p.t === 'spark') { ctx.strokeStyle = `rgba(255,${180 + (f * 60) | 0},80,${f})`; ctx.lineWidth = 0.08; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); }
    else if (p.t === 'smoke') { ctx.fillStyle = `rgba(215,215,215,${p.a * f})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    else if (p.t === 'dust') { ctx.fillStyle = `rgba(200,180,140,${0.4 * f})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = `rgba(70,120,40,${0.6 * f})`; ctx.fillRect(p.x, p.y, 0.25, 0.25); }
  }
}
